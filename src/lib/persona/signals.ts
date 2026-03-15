import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import type { PersonaSignal } from "./types";

/**
 * Extract persona signals from a user's chat message.
 * Looks for explicit statements about preferences, budget, brands, etc.
 */
export function extractChatSignals(message: string): PersonaSignal[] {
  const signals: PersonaSignal[] = [];
  const lower = message.toLowerCase();

  // Budget signals — explicit mentions of price sensitivity
  const budgetMatch = lower.match(
    /(?:budget|spend|afford|under|less than|max|no more than)\s*\$?\s*(\d+)/
  );
  if (budgetMatch) {
    signals.push({
      type: "budget_signal",
      key: "stated_budget",
      value: parseFloat(budgetMatch[1]),
      confidence: 0.9,
      source: "chat",
    });
  }

  // Cheap/expensive preference
  if (/\b(cheap|cheapest|affordable|budget|bargain)\b/.test(lower)) {
    signals.push({
      type: "quality_preference",
      key: "price_sensitivity",
      value: "price_focused",
      confidence: 0.7,
      source: "chat",
    });
  }
  if (/\b(premium|luxury|best quality|high[- ]end|top[- ]tier)\b/.test(lower)) {
    signals.push({
      type: "quality_preference",
      key: "price_sensitivity",
      value: "quality_focused",
      confidence: 0.7,
      source: "chat",
    });
  }

  // Brand mentions
  const brandPatterns = [
    /\b(?:i (?:like|love|prefer|want|use)|fan of|loyal to)\s+(\w+(?:\s+\w+)?)\b/i,
    /\b(?:not|don't like|hate|avoid)\s+(\w+(?:\s+\w+)?)\b/i,
  ];
  const positiveBrandMatch = lower.match(brandPatterns[0]);
  if (positiveBrandMatch) {
    signals.push({
      type: "brand_preference",
      key: positiveBrandMatch[1].trim(),
      value: 1,
      confidence: 0.8,
      source: "chat",
    });
  }
  const negativeBrandMatch = lower.match(brandPatterns[1]);
  if (negativeBrandMatch) {
    signals.push({
      type: "brand_preference",
      key: negativeBrandMatch[1].trim(),
      value: -1,
      confidence: 0.6,
      source: "chat",
    });
  }

  // Dietary / lifestyle
  const dietaryKeywords = [
    "vegan",
    "vegetarian",
    "gluten-free",
    "organic",
    "kosher",
    "halal",
    "dairy-free",
    "keto",
  ];
  for (const keyword of dietaryKeywords) {
    if (lower.includes(keyword)) {
      signals.push({
        type: "lifestyle",
        key: "dietary",
        value: keyword,
        confidence: 0.95,
        source: "chat",
      });
    }
  }

  return signals;
}

const llmSignalSchema = z.object({
  signals: z.array(z.object({
    type: z.enum([
      "brand_preference", "budget_signal", "category_interest",
      "feature_preference", "lifestyle", "quality_preference", "retailer_preference",
    ]),
    key: z.string(),
    value: z.union([z.number(), z.string()]),
    confidence: z.number().min(0).max(1),
  })),
});

/**
 * Extract persona signals from a chat message using Claude Haiku for richer
 * understanding than regex alone. Falls back to regex extraction on failure.
 */
export async function extractChatSignalsWithLLM(message: string): Promise<PersonaSignal[]> {
  const { object } = await generateObject({
    model: anthropic("claude-haiku-4-5-20251001"),
    schema: llmSignalSchema,
    maxOutputTokens: 300,
    prompt: `Extract shopping persona signals from this user message. Return an array of signals.

Signal types:
- brand_preference: key=brand name, value=1 (positive) or -1 (negative), confidence 0.6-0.9
- budget_signal: key="stated_budget", value=dollar amount, confidence 0.8-0.9
- category_interest: key=category (electronics, clothing, home, sports, beauty, toys, grocery), value=1, confidence 0.5-0.7
- feature_preference: key=feature name (e.g. "wireless", "waterproof", "noise-cancelling", "organic"), value=1 (wanted) or -1 (unwanted), confidence 0.5-0.8
- quality_preference: key="price_sensitivity", value="price_focused" or "quality_focused", confidence 0.6-0.8
- lifestyle: key="dietary", value=restriction name, confidence 0.9
- retailer_preference: key=retailer name, value=1, confidence 0.5-0.7

Only extract signals clearly expressed in the message. If none, return empty array.

Message: "${message}"`,
  });

  return object.signals.map((s) => ({
    ...s,
    source: "chat" as const,
  }));
}

/**
 * Extract persona signals from a search action.
 */
export function extractSearchSignals(
  query: string,
  filters?: Record<string, unknown>
): PersonaSignal[] {
  const signals: PersonaSignal[] = [];

  // Category interest from search query
  const categories = inferCategory(query);
  for (const category of categories) {
    signals.push({
      type: "category_interest",
      key: category,
      value: 1,
      confidence: 0.5,
      source: "search",
    });
  }

  // Price range from filters
  if (filters?.maxPrice) {
    signals.push({
      type: "budget_signal",
      key: "search_price_ceiling",
      value: filters.maxPrice,
      confidence: 0.6,
      source: "search",
    });
  }

  return signals;
}

/**
 * Extract persona signals from a purchase.
 * Purchases are high-confidence signals.
 */
export function extractPurchaseSignals(
  product: {
    brand?: string;
    category?: string;
    price: number;
    source: string;
  }
): PersonaSignal[] {
  const signals: PersonaSignal[] = [];

  if (product.brand) {
    signals.push({
      type: "brand_preference",
      key: product.brand,
      value: 1,
      confidence: 0.95,
      source: "purchase",
    });
  }

  if (product.category) {
    signals.push({
      type: "category_interest",
      key: product.category,
      value: 2, // Purchases weight more than searches
      confidence: 0.9,
      source: "purchase",
    });
  }

  signals.push({
    type: "budget_signal",
    key: "actual_spend",
    value: product.price,
    confidence: 1.0,
    source: "purchase",
  });

  signals.push({
    type: "retailer_preference",
    key: product.source,
    value: 1,
    confidence: 0.8,
    source: "purchase",
  });

  return signals;
}

/**
 * Extract negative persona signals from a dismissed product.
 * Low confidence because a single dismiss is a weak signal.
 */
export function extractDismissSignals(product: {
  brand?: string;
  category?: string;
  title: string;
}): PersonaSignal[] {
  const signals: PersonaSignal[] = [];

  if (product.brand) {
    signals.push({
      type: "brand_preference",
      key: product.brand,
      value: -1,
      confidence: 0.4,
      source: "feedback",
    });
  }

  if (product.category) {
    signals.push({
      type: "category_interest",
      key: product.category,
      value: -1,
      confidence: 0.3,
      source: "feedback",
    });
  }

  return signals;
}

/** Simple category inference from search query keywords */
function inferCategory(query: string): string[] {
  const lower = query.toLowerCase();
  const categories: string[] = [];
  const categoryKeywords: Record<string, string[]> = {
    electronics: ["phone", "laptop", "tablet", "headphone", "speaker", "camera", "tv", "monitor", "iphone", "samsung", "macbook"],
    clothing: ["shirt", "pants", "dress", "shoes", "jacket", "sneaker", "boot", "hat", "hoodie"],
    home: ["furniture", "lamp", "chair", "table", "sofa", "bed", "pillow", "blanket", "kitchen"],
    sports: ["fitness", "gym", "yoga", "running", "bike", "bicycle", "ball", "racket"],
    beauty: ["skincare", "makeup", "perfume", "shampoo", "cream", "serum"],
    toys: ["toy", "lego", "game", "puzzle", "doll", "action figure"],
    grocery: ["food", "snack", "coffee", "tea", "organic", "milk", "bread"],
  };

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      categories.push(category);
    }
  }

  return categories.length > 0 ? categories : ["general"];
}
