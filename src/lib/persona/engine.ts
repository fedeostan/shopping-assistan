import { createServiceClient } from "@/lib/db/supabase";
import type { UserPersona, PersonaSignal, InteractionRecord, PersonaRow } from "./types";

/**
 * Get or create a user's persona.
 */
export async function getPersona(userId: string): Promise<PersonaRow | null> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("user_personas")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = no rows found
    console.error("Error fetching persona:", error);
  }

  return data;
}

/**
 * Initialize a new persona for a user (called on first interaction or onboarding).
 */
export async function initializePersona(
  userId: string,
  initial?: Partial<UserPersona>
): Promise<PersonaRow> {
  const supabase = createServiceClient();

  const persona: UserPersona = {
    locale: "en",
    currency: "USD",
    priceQualitySpectrum: 0, // neutral default
    brandAffinities: {},
    categoryInterests: {},
    budgetRanges: {},
    ...initial,
  };

  const { data, error } = await supabase
    .from("user_personas")
    .upsert(
      {
        user_id: userId,
        persona,
        confidence_score: initial ? 0.2 : 0.0,
        last_refreshed_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select()
    .single();

  if (error) throw new Error(`Failed to initialize persona: ${error.message}`);
  return data;
}

/**
 * Log an interaction and apply persona signals.
 */
export async function logInteraction(
  interaction: InteractionRecord
): Promise<void> {
  const supabase = createServiceClient();

  // Store the interaction
  const { error: insertError } = await supabase
    .from("user_interactions")
    .insert({
      user_id: interaction.userId,
      type: interaction.type,
      payload: interaction.payload,
      persona_signals: interaction.personaSignals,
    });

  if (insertError) {
    console.error("Error logging interaction:", insertError);
    return;
  }

  // Apply signals to persona if present
  if (interaction.personaSignals && interaction.personaSignals.length > 0) {
    await applySignals(interaction.userId, interaction.personaSignals);
  }
}

/**
 * Apply extracted signals to update the user's persona.
 * Uses a weighted merge: high-confidence signals override, low-confidence accumulate.
 */
async function applySignals(
  userId: string,
  signals: PersonaSignal[]
): Promise<void> {
  const existing = await getPersona(userId);
  if (!existing) {
    await initializePersona(userId);
    return applySignals(userId, signals);
  }

  const persona = { ...existing.persona } as UserPersona;
  let confidenceBoost = 0;

  for (const signal of signals) {
    switch (signal.type) {
      case "brand_preference": {
        if (!persona.brandAffinities) persona.brandAffinities = {};
        const current = persona.brandAffinities[signal.key] ?? 0;
        // Weighted moving average
        persona.brandAffinities[signal.key] =
          current * (1 - signal.confidence) +
          (signal.value as number) * signal.confidence;
        confidenceBoost += 0.02;
        break;
      }

      case "budget_signal": {
        if (signal.key === "actual_spend") {
          // Update average order value
          const prevAvg = persona.averageOrderValue ?? (signal.value as number);
          persona.averageOrderValue =
            prevAvg * 0.7 + (signal.value as number) * 0.3;
          confidenceBoost += 0.05;
        }
        break;
      }

      case "category_interest": {
        if (!persona.categoryInterests) persona.categoryInterests = {};
        const current = persona.categoryInterests[signal.key] ?? 0;
        persona.categoryInterests[signal.key] =
          current + (signal.value as number) * signal.confidence;
        confidenceBoost += 0.01;
        break;
      }

      case "quality_preference": {
        const shift = signal.value === "quality_focused" ? 0.2 : -0.2;
        persona.priceQualitySpectrum = Math.max(
          -1,
          Math.min(1, (persona.priceQualitySpectrum ?? 0) + shift * signal.confidence)
        );
        confidenceBoost += 0.03;
        break;
      }

      case "retailer_preference": {
        if (!persona.preferredRetailers) persona.preferredRetailers = [];
        const retailer = signal.key;
        if (!persona.preferredRetailers.includes(retailer)) {
          persona.preferredRetailers.push(retailer);
        }
        confidenceBoost += 0.01;
        break;
      }

      case "lifestyle": {
        if (signal.key === "dietary") {
          if (!persona.dietaryRestrictions) persona.dietaryRestrictions = [];
          const restriction = signal.value as string;
          if (!persona.dietaryRestrictions.includes(restriction)) {
            persona.dietaryRestrictions.push(restriction);
          }
          confidenceBoost += 0.05;
        }
        break;
      }
    }
  }

  // Update persona in DB
  const supabase = createServiceClient();
  const newConfidence = Math.min(1, existing.confidence_score + confidenceBoost);

  await supabase
    .from("user_personas")
    .update({
      persona,
      confidence_score: newConfidence,
      last_refreshed_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

/**
 * Get the confidence level as a human-readable label.
 */
export function getConfidenceLabel(score: number): string {
  if (score < 0.2) return "Just getting to know you";
  if (score < 0.4) return "Learning your preferences";
  if (score < 0.6) return "Getting a good sense of your style";
  if (score < 0.8) return "Know your preferences well";
  return "Highly personalized";
}
