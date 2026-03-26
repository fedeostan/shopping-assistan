import { tool } from "ai";
import { z } from "zod";
import { searchMultiSource } from "@/lib/search/multi-source";
import { searchWithConnectors, selectRelevantConnectors } from "@/lib/search/authenticated-search";
import { getPersona, logInteraction } from "@/lib/persona/engine";
import { extractSearchSignals } from "@/lib/persona/signals";
import type { Product } from "@/lib/ai/types";

export function createSearchProducts(userId: string | null) {
  return tool({
  description:
    "Search for products across Google Shopping and major retailers (Amazon, Best Buy, Walmart, Target). Returns results from multiple sources with direct retailer URLs. Set sortByPrice to 'asc' to find the cheapest option.",
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
    preferDirectLinks: z
      .boolean()
      .optional()
      .default(false)
      .describe("When true, filter out products without direct retailer URLs"),
  }),
  execute: async ({ query, maxResults, country, minPrice, maxPrice, sortByPrice, preferDirectLinks }) => {
    console.log(`[Tool:search] START query="${query}" country=${country} maxResults=${maxResults} minPrice=${minPrice} maxPrice=${maxPrice} sort=${sortByPrice} preferDirect=${preferDirectLinks}`);
    const t0 = Date.now();

    // Check for active connectors from persona
    let activeConnectors: string[] = [];
    if (userId) {
      try {
        const personaRow = await getPersona(userId);
        activeConnectors = personaRow?.persona?.activeConnectors ?? [];
      } catch (err) {
        console.warn("[Tool:search] Failed to fetch persona for connectors:", err instanceof Error ? err.message : "unknown");
      }
    }

    let products: Product[];
    let errors: string[];
    let stale: boolean;
    let circuitOpen: boolean;
    let sources: string[];

    if (activeConnectors.length > 0 && userId) {
      // Select up to 3 most relevant connectors for this query
      const selected = selectRelevantConnectors(activeConnectors, query, 3);
      console.log(`[Tool:search] Running authenticated search with ${selected.length} connector(s) alongside public search`);

      // Run authenticated + public searches in parallel
      const [authProducts, publicResult] = await Promise.all([
        searchWithConnectors(query, selected, userId).catch((err) => {
          console.warn("[Tool:search] Authenticated search failed:", err instanceof Error ? err.message : "unknown");
          return [] as Product[];
        }),
        searchMultiSource(query, country ?? "US"),
      ]);

      // Auth products go first — they have direct URLs and potentially member prices
      products = [...authProducts, ...publicResult.products];
      errors = publicResult.errors;
      stale = publicResult.stale;
      circuitOpen = publicResult.circuitOpen;
      sources = publicResult.sources;

      if (authProducts.length > 0) {
        const authSources = [...new Set(authProducts.map((p) => p.source))];
        sources = [...authSources.map((s) => `${s} (authenticated)`), ...sources];
        console.log(`[Tool:search] Authenticated search returned ${authProducts.length} product(s) from ${authSources.join(", ")}`);
      }
    } else {
      const result = await searchMultiSource(query, country ?? "US");
      products = result.products;
      errors = result.errors;
      stale = result.stale;
      circuitOpen = result.circuitOpen;
      sources = result.sources;
    }

    console.log(`[Tool:search] MultiSource OK query="${query}" rawCount=${products.length} sources=${sources.join(",")} stale=${stale}`);

    // Filter out products with no usable price ($0 = extraction failed)
    const beforePriceFilter = products.length;
    products = products.filter((p) => p.currentPrice > 0);
    if (beforePriceFilter !== products.length) {
      console.log(`[Tool:search] Filtered out ${beforePriceFilter - products.length} products with $0 price`);
    }

    // Filter to direct links only if requested
    if (preferDirectLinks) {
      const before = products.length;
      products = products.filter((p) => p.urlReliability !== "google");
      console.log(`[Tool:search] Filtered to direct links: ${before} → ${products.length}`);
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
      urlReliability: p.urlReliability ?? (p.retailerUrl ? "direct" : "google"),
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
    const directCount = slimProducts.filter(p => p.urlReliability === "direct").length;
    console.log(`[Tool:search] DONE query="${query}" returned=${slimProducts.length} withRetailerUrl=${withRetailer} direct=${directCount} elapsed=${Date.now() - t0}ms`);

    return {
      query,
      sources,
      country,
      resultCount: filtered.length,
      products: slimProducts,
      cheapest: cheapest ? { title: cheapest.title, price: cheapest.currentPrice, currency: cheapest.currency, source: cheapest.source } : undefined,
      urlReliabilityStats: {
        direct: slimProducts.filter(p => p.urlReliability === "direct").length,
        redirect: slimProducts.filter(p => p.urlReliability === "redirect").length,
        googleOnly: slimProducts.filter(p => p.urlReliability === "google").length,
      },
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
