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
 * Confidence-weighted merge of a numeric value.
 * Formula: merged = (existing * existingConf + new * newConf) / (existingConf + newConf)
 *          confidence = min(1, existingConf + newConf * 0.3)
 */
function weightedMerge(
  existing: number,
  existingConf: number,
  incoming: number,
  incomingConf: number
): { value: number; confidence: number } {
  const totalConf = existingConf + incomingConf;
  if (totalConf === 0) return { value: incoming, confidence: 0 };
  return {
    value: (existing * existingConf + incoming * incomingConf) / totalConf,
    confidence: Math.min(1, existingConf + incomingConf * 0.3),
  };
}

/**
 * Compute overall persona confidence as the average of all per-dimension confidences.
 * Returns 0 when no confidence data exists (cold start).
 */
function computeOverallConfidence(persona: UserPersona): number {
  const values: number[] = [];

  if (persona._brandConfidence) {
    values.push(...Object.values(persona._brandConfidence));
  }
  if (persona._categoryConfidence) {
    values.push(...Object.values(persona._categoryConfidence));
  }
  if (persona._featureConfidence) {
    values.push(...Object.values(persona._featureConfidence));
  }
  if (persona._priceQualityConfidence != null) {
    values.push(persona._priceQualityConfidence);
  }
  if (persona._orderValueConfidence != null) {
    values.push(persona._orderValueConfidence);
  }

  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Apply extracted signals to update the user's persona.
 * Uses confidence-weighted merging: each dimension tracks its own confidence,
 * and the overall score reflects signal coverage breadth.
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

  for (const signal of signals) {
    switch (signal.type) {
      case "brand_preference": {
        if (!persona.brandAffinities) persona.brandAffinities = {};
        if (!persona._brandConfidence) persona._brandConfidence = {};
        const current = persona.brandAffinities[signal.key] ?? 0;
        const currentConf = persona._brandConfidence[signal.key] ?? 0;
        const result = weightedMerge(current, currentConf, signal.value as number, signal.confidence);
        persona.brandAffinities[signal.key] = result.value;
        persona._brandConfidence[signal.key] = result.confidence;
        break;
      }

      case "budget_signal": {
        if (signal.key === "actual_spend") {
          const prevAvg = persona.averageOrderValue ?? (signal.value as number);
          const prevConf = persona._orderValueConfidence ?? 0;
          const result = weightedMerge(prevAvg, prevConf, signal.value as number, signal.confidence);
          persona.averageOrderValue = result.value;
          persona._orderValueConfidence = result.confidence;
        }
        break;
      }

      case "category_interest": {
        if (!persona.categoryInterests) persona.categoryInterests = {};
        if (!persona._categoryConfidence) persona._categoryConfidence = {};
        const current = persona.categoryInterests[signal.key] ?? 0;
        const currentConf = persona._categoryConfidence[signal.key] ?? 0;
        const result = weightedMerge(current, currentConf, signal.value as number, signal.confidence);
        persona.categoryInterests[signal.key] = result.value;
        persona._categoryConfidence[signal.key] = result.confidence;
        break;
      }

      case "quality_preference": {
        const numericValue = signal.value === "quality_focused" ? 1 : -1;
        const current = persona.priceQualitySpectrum ?? 0;
        const currentConf = persona._priceQualityConfidence ?? 0;
        const result = weightedMerge(current, currentConf, numericValue, signal.confidence);
        persona.priceQualitySpectrum = Math.max(-1, Math.min(1, result.value));
        persona._priceQualityConfidence = result.confidence;
        break;
      }

      case "feature_preference": {
        if (!persona.featurePreferences) persona.featurePreferences = {};
        if (!persona._featureConfidence) persona._featureConfidence = {};
        const current = persona.featurePreferences[signal.key] ?? 0;
        const currentConf = persona._featureConfidence[signal.key] ?? 0;
        const result = weightedMerge(current, currentConf, signal.value as number, signal.confidence);
        persona.featurePreferences[signal.key] = result.value;
        persona._featureConfidence[signal.key] = result.confidence;
        break;
      }

      case "retailer_preference": {
        if (!persona.preferredRetailers) persona.preferredRetailers = [];
        const retailer = signal.key;
        if (!persona.preferredRetailers.includes(retailer)) {
          persona.preferredRetailers.push(retailer);
        }
        break;
      }

      case "lifestyle": {
        if (signal.key === "dietary") {
          if (!persona.dietaryRestrictions) persona.dietaryRestrictions = [];
          const restriction = signal.value as string;
          if (!persona.dietaryRestrictions.includes(restriction)) {
            persona.dietaryRestrictions.push(restriction);
          }
        }
        break;
      }
    }
  }

  // Update persona in DB
  const supabase = createServiceClient();
  const newConfidence = computeOverallConfidence(persona);

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
 * Update user locale, country, and currency on their persona via JSONB merge.
 */
export async function updateLocale(
  userId: string,
  locale: string,
  country: string,
  currency: string,
): Promise<void> {
  const supabase = createServiceClient();
  const existing = await getPersona(userId);

  if (!existing) {
    await initializePersona(userId, { locale, country, currency });
    return;
  }

  const updatedPersona = { ...existing.persona, locale, country, currency };
  await supabase
    .from("user_personas")
    .update({ persona: updatedPersona })
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
