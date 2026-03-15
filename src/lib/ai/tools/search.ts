import { tool } from "ai";
import { z } from "zod";
import { scrapeGoogleShoppingSearch } from "@/lib/agentql/queries";
import { logInteraction } from "@/lib/persona/engine";
import { extractSearchSignals } from "@/lib/persona/signals";
import { CircuitOpenError } from "@/lib/utils/service-error";
import type { Product } from "../types";

export function createSearchProducts(userId: string | null) {
  return tool({
  description:
    "Search for products across many retailers via Google Shopping. Use this when the user wants to find products, browse items, explore what's available, or compare prices across stores. Set sortByPrice to 'asc' to find the cheapest option.",
  inputSchema: z.object({
    query: z.string().describe("The product search query"),
    maxResults: z
      .number()
      .optional()
      .default(6)
      .describe("Maximum number of results to return"),
    country: z
      .enum(["AR", "BR", "MX", "CL", "CO", "US"])
      .optional()
      .default("US")
      .describe("Country code for localized results"),
    minPrice: z.number().optional().describe("Minimum price filter"),
    maxPrice: z.number().optional().describe("Maximum price filter"),
    sortByPrice: z
      .enum(["asc", "desc"])
      .optional()
      .describe("Sort results by price — use 'asc' to find cheapest deals"),
  }),
  execute: async ({ query, maxResults, country, minPrice, maxPrice, sortByPrice }) => {
    console.log(`[Tool:search] START query="${query}" country=${country} maxResults=${maxResults} minPrice=${minPrice} maxPrice=${maxPrice} sort=${sortByPrice}`);
    const t0 = Date.now();

    const errors: string[] = [];
    let products: Product[] = [];
    let stale = false;
    let circuitOpen = false;

    try {
      const results = await scrapeGoogleShoppingSearch(query, country ?? "US");
      if ((results as Product[] & { _stale?: boolean })._stale) {
        stale = true;
      }
      products = results;
      console.log(`[Tool:search] Scrape OK query="${query}" rawCount=${products.length} stale=${stale}`);
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        circuitOpen = true;
        errors.push(error.userMessage);
        console.warn(`[Tool:search] CIRCUIT_OPEN query="${query}": ${error.userMessage}`);
      } else {
        const msg = `Google Shopping: Scraping failed (${error instanceof Error ? error.message : "unknown error"})`;
        errors.push(msg);
        console.error(`[Tool:search] FAILED query="${query}":`, error instanceof Error ? error.message : error);
      }
    }

    // Apply price filters
    let filtered = products;
    if (minPrice !== undefined) {
      const before = filtered.length;
      filtered = filtered.filter((p) => p.currentPrice >= minPrice);
      console.log(`[Tool:search] Filtered by minPrice=${minPrice}: ${before} → ${filtered.length}`);
    }
    if (maxPrice !== undefined) {
      const before = filtered.length;
      filtered = filtered.filter((p) => p.currentPrice <= maxPrice);
      console.log(`[Tool:search] Filtered by maxPrice=${maxPrice}: ${before} → ${filtered.length}`);
    }

    // Sort by price if requested
    if (sortByPrice) {
      filtered.sort((a, b) =>
        sortByPrice === "asc"
          ? a.currentPrice - b.currentPrice
          : b.currentPrice - a.currentPrice
      );
      console.log(`[Tool:search] Sorted by price ${sortByPrice}`);
    }

    const cheapest = filtered.length > 0 ? filtered.reduce((min, p) => p.currentPrice < min.currentPrice ? p : min) : null;

    // Project slim shape — keep display-critical fields, strip metadata
    const slimProducts = filtered.slice(0, maxResults).map((p) => ({
      id: p.id,
      externalId: p.externalId,
      title: p.title,
      brand: p.brand,
      currentPrice: p.currentPrice,
      ...(p.originalPrice && p.originalPrice !== p.currentPrice ? { originalPrice: p.originalPrice } : {}),
      currency: p.currency,
      rating: p.rating,
      source: p.source,
      imageUrl: p.imageUrl,
      productUrl: p.productUrl,
      retailerUrl: p.retailerUrl,
      ...(p.availability && p.availability !== "unknown" ? { availability: p.availability } : {}),
      ...(p.description ? { description: p.description.slice(0, 100) } : {}),
    }));

    // Log search signals for persona learning
    if (userId) {
      const signals = extractSearchSignals(query, { maxPrice, minPrice });
      logInteraction({
        userId,
        type: "search",
        payload: { query, country, resultCount: filtered.length },
        personaSignals: signals,
      }).catch(console.error);
    }

    const withRetailer = slimProducts.filter(p => p.retailerUrl).length;
    console.log(`[Tool:search] DONE query="${query}" returned=${slimProducts.length} withRetailerUrl=${withRetailer} elapsed=${Date.now() - t0}ms`);

    return {
      query,
      sources: ["google-shopping"],
      country,
      resultCount: filtered.length,
      products: slimProducts,
      cheapest: cheapest ? { title: cheapest.title, price: cheapest.currentPrice, currency: cheapest.currency, source: cheapest.source } : undefined,
      errors: errors.length > 0 ? errors : undefined,
      ...(stale ? { _stale: true } : {}),
      ...(circuitOpen ? { circuitOpen: true } : {}),
      note:
        filtered.length === 0
          ? "No products found. Google Shopping may be temporarily unavailable. Tell the user and suggest they provide a direct product URL for you to analyze."
          : stale
            ? "Results may be slightly outdated — showing cached data while services recover."
            : undefined,
    };
  },
});
}
