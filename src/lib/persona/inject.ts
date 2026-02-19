import { getPersona, getConfidenceLabel } from "./engine";
import type { UserPersona } from "./types";

/**
 * Generate a persona context block to inject into the orchestrator's system prompt.
 * Returns null if no persona exists yet.
 */
export async function injectPersona(userId: string): Promise<string | null> {
  const row = await getPersona(userId);
  if (!row) return null;

  const persona = row.persona as UserPersona;
  const confidence = row.confidence_score;

  const sections: string[] = [
    `## User Profile (Confidence: ${Math.round(confidence * 100)}% — ${getConfidenceLabel(confidence)})`,
  ];

  // Identity
  if (persona.locale || persona.country || persona.currency) {
    sections.push(
      `**Location & Currency:** ${[persona.country, persona.locale, persona.currency].filter(Boolean).join(", ")}`
    );
  }

  // Budget
  if (persona.averageOrderValue) {
    sections.push(
      `**Average spend:** ${persona.currency ?? "USD"} ${persona.averageOrderValue.toFixed(0)}`
    );
  }
  if (persona.budgetRanges && Object.keys(persona.budgetRanges).length > 0) {
    const ranges = Object.entries(persona.budgetRanges)
      .map(([cat, r]) => `${cat}: ${r.currency} ${r.min}-${r.max}`)
      .join(", ");
    sections.push(`**Budget ranges:** ${ranges}`);
  }

  // Price vs Quality
  if (persona.priceQualitySpectrum !== undefined) {
    const pq = persona.priceQualitySpectrum;
    const label =
      pq < -0.5
        ? "Strongly price-focused"
        : pq < -0.1
          ? "Leans toward value"
          : pq < 0.1
            ? "Balanced price/quality"
            : pq < 0.5
              ? "Leans toward quality"
              : "Strongly quality-focused";
    sections.push(`**Price/Quality preference:** ${label}`);
  }

  // Brand affinities
  if (persona.brandAffinities && Object.keys(persona.brandAffinities).length > 0) {
    const liked = Object.entries(persona.brandAffinities)
      .filter(([, score]) => score > 0.3)
      .map(([brand]) => brand);
    const disliked = Object.entries(persona.brandAffinities)
      .filter(([, score]) => score < -0.3)
      .map(([brand]) => brand);

    if (liked.length > 0) sections.push(`**Preferred brands:** ${liked.join(", ")}`);
    if (disliked.length > 0) sections.push(`**Avoided brands:** ${disliked.join(", ")}`);
  }

  // Category interests
  if (persona.categoryInterests && Object.keys(persona.categoryInterests).length > 0) {
    const top = Object.entries(persona.categoryInterests)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([cat]) => cat);
    sections.push(`**Top interests:** ${top.join(", ")}`);
  }

  // Preferred retailers
  if (persona.preferredRetailers && persona.preferredRetailers.length > 0) {
    sections.push(`**Preferred stores:** ${persona.preferredRetailers.join(", ")}`);
  }

  // Lifestyle
  if (persona.dietaryRestrictions && persona.dietaryRestrictions.length > 0) {
    sections.push(`**Dietary:** ${persona.dietaryRestrictions.join(", ")}`);
  }
  if (persona.hobbies && persona.hobbies.length > 0) {
    sections.push(`**Hobbies:** ${persona.hobbies.join(", ")}`);
  }

  return sections.join("\n");
}

/**
 * Get a slim persona slice for a specific worker.
 * Workers don't need the full persona — just the relevant bits.
 */
export function getPersonaSlice(
  persona: UserPersona,
  worker: "search" | "compare" | "buy" | "recommend"
): Partial<UserPersona> {
  switch (worker) {
    case "search":
      return {
        brandAffinities: persona.brandAffinities,
        budgetRanges: persona.budgetRanges,
        categoryInterests: persona.categoryInterests,
        currency: persona.currency,
        country: persona.country,
      };
    case "compare":
      return {
        priceQualitySpectrum: persona.priceQualitySpectrum,
        preferredRetailers: persona.preferredRetailers,
        currency: persona.currency,
      };
    case "buy":
      return {
        sizeData: persona.sizeData,
        currency: persona.currency,
        country: persona.country,
      };
    case "recommend":
      // Recommender gets the full persona for deep personalization
      return persona;
  }
}
