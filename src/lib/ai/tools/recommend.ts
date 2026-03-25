import { tool } from "ai";
import { z } from "zod";
import { getPersona } from "@/lib/persona/engine";
import { scrapeGoogleShoppingSearch } from "@/lib/agentql/queries";
import type { Product } from "@/lib/ai/types";

export function createRecommendations(userId: string | null) {
  return tool({
    description:
      "Get personalized product recommendations based on the user's preferences, purchase history, and browsing patterns. Use this when the user asks for suggestions or wants to discover products.",
    inputSchema: z.object({
      category: z
        .string()
        .optional()
        .describe(
          "Product category to get recommendations for (e.g., 'electronics', 'clothing')"
        ),
      budget: z
        .number()
        .optional()
        .describe("Maximum budget for recommendations"),
      currency: z
        .string()
        .optional()
        .default("USD")
        .describe("Currency for the budget"),
      occasion: z
        .string()
        .optional()
        .describe(
          "Special occasion or context (e.g., 'birthday gift', 'back to school')"
        ),
    }),
    execute: async ({ category, budget, currency, occasion }) => {
      console.log(`[Tool:recommend] START category=${category ?? "none"} budget=${budget ?? "none"} occasion=${occasion ?? "none"}`);
      const t0 = Date.now();

      const personaRow = userId ? await getPersona(userId) : null;
      const persona = personaRow?.persona ?? null;
      console.log(`[Tool:recommend] Persona: ${persona ? `confidence=${personaRow?.confidence_score} categories=${Object.keys(persona.categoryInterests ?? {}).length}` : "none"}`);

      // Build search queries from persona + request
      const queries: string[] = [];

      // Start with explicit request
      if (category) {
        queries.push(occasion ? `${category} ${occasion}` : category);
      }

      // Add persona-derived queries
      if (persona?.categoryInterests) {
        const topCategories = Object.entries(persona.categoryInterests)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 2)
          .map(([cat]) => cat);
        for (const cat of topCategories) {
          if (cat !== category) queries.push(cat);
        }
      }

      // If no queries from persona or request, use generic
      if (queries.length === 0) {
        queries.push("best deals today", "trending products");
      }

      // Get preferred brands for enriching queries
      const brandHints = persona?.brandAffinities
        ? Object.entries(persona.brandAffinities)
            .filter(([, score]) => score > 0.3)
            .sort(([, a], [, b]) => b - a)
            .map(([brand]) => brand)
            .slice(0, 3)
        : [];

      // Search all queries in parallel (max 3) — turns 3x latency into 1x
      const allProducts: Product[] = [];
      const errors: string[] = [];

      const searchQueries = queries.slice(0, 3).map((q) =>
        brandHints.length > 0 ? `${q} ${brandHints[0]}` : q
      );
      console.log(`[Tool:recommend] Searching ${searchQueries.length} queries in parallel: ${JSON.stringify(searchQueries)} brandHints=${JSON.stringify(brandHints)}`);

      const searchPromises = searchQueries.map((q) =>
        scrapeGoogleShoppingSearch(q)
      );

      const results = await Promise.allSettled(searchPromises);
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === "fulfilled") {
          console.log(`[Tool:recommend] Search "${searchQueries[i]}" OK: ${result.value.length} products`);
          allProducts.push(...result.value);
        } else {
          const msg = `Search for "${queries[i]}" failed: ${result.reason instanceof Error ? result.reason.message : "unknown"}`;
          errors.push(msg);
          console.error(`[Tool:recommend] Search "${searchQueries[i]}" FAILED:`, result.reason instanceof Error ? result.reason.message : result.reason);
        }
      }

      // Filter by budget
      let filtered = allProducts;
      if (budget) {
        filtered = filtered.filter((p) => p.currentPrice <= budget);
      }

      // Dedupe by title similarity, take top 6
      const seen = new Set<string>();
      const unique = filtered
        .filter((p) => {
          const key = p.title.toLowerCase().slice(0, 30);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 6);

      const confidenceScore = personaRow?.confidence_score ?? 0;
      const sourcesSearched = [...new Set(unique.map((p) => p.source))];
      console.log(`[Tool:recommend] DONE total=${allProducts.length} afterBudgetFilter=${filtered.length} unique=${unique.length} sources=${sourcesSearched.join(",")} errors=${errors.length} elapsed=${Date.now() - t0}ms`);

      // Sort: highest rated first, then lowest price as tiebreaker
      unique.sort((a, b) => {
        const ratingDiff = (b.rating ?? 0) - (a.rating ?? 0);
        if (Math.abs(ratingDiff) > 0.3) return ratingDiff;
        return a.currentPrice - b.currentPrice;
      });

      const topPick = unique[0];
      const topPickReason = topPick ? buildTopPickReason(topPick, unique, brandHints) : undefined;

      return {
        productsEvaluated: allProducts.length,
        sourcesSearched,
        topPickReason,
        recommendations: unique.map((p, i) => ({
          title: p.title,
          reason: i === 0 && topPickReason
            ? topPickReason
            : brandHints.includes(p.brand ?? "")
              ? `Matches your preferred brand: ${p.brand}`
              : category
                ? `Top result in ${category}`
                : "Based on your interests",
          product: {
            title: p.title,
            currentPrice: p.currentPrice,
            currency: p.currency ?? currency,
            rating: p.rating,
            source: p.source,
            retailerUrl: p.retailerUrl,
          },
          action: (budget && p.currentPrice <= budget * 0.6
            ? "buy_now"
            : "wait") as "buy_now" | "wait",
          confidence: persona
            ? Math.min(confidenceScore + 0.2, 1)
            : 0.3,
        })),
        errors: errors.length > 0 ? errors : undefined,
        note:
          unique.length === 0
            ? "Could not find recommendations. Try specifying a category or sharing what you're looking for."
            : undefined,
      };
    },
  });
}

/** Generate a 1-sentence reason why the top pick stands out */
function buildTopPickReason(top: Product, all: Product[], brandHints: string[]): string {
  const cheapest = all.every((p) => top.currentPrice <= p.currentPrice);
  const highestRated = top.rating != null && all.every((p) => (top.rating ?? 0) >= (p.rating ?? 0));
  const isFavBrand = top.brand != null && brandHints.includes(top.brand);

  if (isFavBrand && highestRated && top.rating) {
    return `Matches your favorite brand ${top.brand} — and rated ${top.rating} stars`;
  }
  if (isFavBrand && cheapest) {
    return `Matches your favorite brand ${top.brand} — and the lowest price`;
  }
  if (isFavBrand) {
    return `Matches your favorite brand ${top.brand} from ${all.length} options`;
  }
  if (cheapest && highestRated && top.rating) {
    return `Best value — lowest price and highest rated (${top.rating} stars)`;
  }
  if (cheapest) {
    return `Lowest price across ${all.length} options evaluated`;
  }
  if (highestRated && top.rating) {
    return `Highest rated at ${top.rating} stars across ${all.length} options`;
  }
  if (top.rating && top.rating >= 4.0) {
    return `Strong ${top.rating}-star rating with competitive pricing`;
  }
  return `Best overall match from ${all.length} products evaluated`;
}
