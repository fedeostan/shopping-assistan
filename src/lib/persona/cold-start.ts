import type { PersonaSignal } from "./types";

/**
 * Aggressively extract persona signals from a first message.
 * Designed for cold-start users where even weak signals are valuable.
 * All signals use low confidence (0.3–0.4) so they refine quickly.
 */
export function inferColdStartSignals(message: string): PersonaSignal[] {
  const signals: PersonaSignal[] = [];
  const lower = message.toLowerCase();

  // Price sensitivity: budget vs premium
  if (/\b(cheap|cheapest|affordable|budget|bargain|deal|under \$?\d|less than \$?\d)\b/.test(lower)) {
    signals.push({
      type: "quality_preference",
      key: "price_sensitivity",
      value: "price_focused",
      confidence: 0.4,
      source: "chat",
    });
  } else if (/\b(premium|luxury|best|high[- ]end|top[- ]tier|professional|flagship)\b/.test(lower)) {
    signals.push({
      type: "quality_preference",
      key: "price_sensitivity",
      value: "quality_focused",
      confidence: 0.4,
      source: "chat",
    });
  }

  // Budget from explicit amounts
  const budgetMatch = lower.match(
    /(?:budget|spend|afford|under|less than|max|no more than|around)\s*\$?\s*(\d+)/
  );
  if (budgetMatch) {
    signals.push({
      type: "budget_signal",
      key: "stated_budget",
      value: parseFloat(budgetMatch[1]),
      confidence: 0.4,
      source: "chat",
    });
  }

  // Category inference from keywords
  const categoryKeywords: Record<string, string[]> = {
    electronics: ["phone", "laptop", "tablet", "headphone", "speaker", "camera", "tv", "monitor", "iphone", "samsung", "macbook", "airpods", "earbuds", "computer", "keyboard", "mouse"],
    clothing: ["shirt", "pants", "dress", "shoes", "jacket", "sneaker", "boot", "hat", "hoodie", "jeans", "coat"],
    home: ["furniture", "lamp", "chair", "table", "sofa", "bed", "pillow", "blanket", "kitchen", "appliance"],
    sports: ["fitness", "gym", "yoga", "running", "bike", "bicycle", "ball", "racket", "workout"],
    beauty: ["skincare", "makeup", "perfume", "shampoo", "cream", "serum", "moisturizer"],
    toys: ["toy", "lego", "game", "puzzle", "doll", "action figure", "gift for kid"],
    grocery: ["food", "snack", "coffee", "tea", "organic", "milk", "bread"],
  };

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      signals.push({
        type: "category_interest",
        key: category,
        value: 1,
        confidence: 0.3,
        source: "chat",
      });
    }
  }

  // Brand mentions (common brands)
  const brands = [
    "apple", "samsung", "sony", "nike", "adidas", "bose", "dell", "hp",
    "lenovo", "asus", "lg", "philips", "dyson", "kitchenaid", "nintendo",
  ];
  for (const brand of brands) {
    if (lower.includes(brand)) {
      signals.push({
        type: "brand_preference",
        key: brand,
        value: 1,
        confidence: 0.3,
        source: "chat",
      });
    }
  }

  return signals;
}

/**
 * Build a system prompt addendum for cold-start users.
 * Returns null if the user has enough persona data (confidence >= 0.2).
 */
export function buildColdStartPromptAddendum(confidence: number): string | null {
  if (confidence >= 0.2) return null;

  return `## Getting to Know You
This is a new user with limited preference data. After helping with their request, naturally weave in ONE brief question to learn about their preferences. Examples:
- "By the way, do you generally prefer saving money or getting the best quality?"
- "Are there any brands you particularly like or want to avoid?"
- "What's your typical budget range for [category they asked about]?"

Do NOT interrogate them or ask multiple questions. Be helpful first, curious second. If their message already reveals clear preferences, skip the question.`;
}
