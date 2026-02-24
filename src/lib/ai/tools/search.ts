import { tool } from "ai";
import { z } from "zod";
import { scrapeGoogleShoppingSearch } from "@/lib/agentql/queries";
import type { Product } from "../types";

export const searchProducts = tool({
  description:
    "Search for products across many retailers via Google Shopping. Use this when the user wants to find products, browse items, explore what's available, or compare prices across stores. Set sortByPrice to 'asc' to find the cheapest option.",
  inputSchema: z.object({
    query: z.string().describe("The product search query"),
    maxResults: z
      .number()
      .optional()
      .default(5)
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
    const errors: string[] = [];
    let products: Product[] = [];

    try {
      products = await scrapeGoogleShoppingSearch(query, country ?? "US");
    } catch (error) {
      errors.push(
        `Google Shopping: Scraping failed (${error instanceof Error ? error.message : "unknown error"})`
      );
    }

    // Apply price filters
    let filtered = products;
    if (minPrice !== undefined) {
      filtered = filtered.filter((p) => p.currentPrice >= minPrice);
    }
    if (maxPrice !== undefined) {
      filtered = filtered.filter((p) => p.currentPrice <= maxPrice);
    }

    // Sort by price if requested
    if (sortByPrice) {
      filtered.sort((a, b) =>
        sortByPrice === "asc"
          ? a.currentPrice - b.currentPrice
          : b.currentPrice - a.currentPrice
      );
    }

    const cheapest = filtered.length > 0 ? filtered.reduce((min, p) => p.currentPrice < min.currentPrice ? p : min) : null;

    // Project slim shape — keep display-critical fields, strip metadata
    const slimProducts = filtered.slice(0, maxResults).map((p) => ({
      id: p.id,
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

    return {
      query,
      sources: ["google-shopping"],
      country,
      resultCount: filtered.length,
      products: slimProducts,
      cheapest: cheapest ? { title: cheapest.title, price: cheapest.currentPrice, currency: cheapest.currency, source: cheapest.source } : undefined,
      errors: errors.length > 0 ? errors : undefined,
      note:
        filtered.length === 0
          ? "No products found. Google Shopping may be temporarily unavailable. Tell the user and suggest they provide a direct product URL for you to analyze."
          : undefined,
    };
  },
});
