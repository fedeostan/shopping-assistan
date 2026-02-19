import { tool } from "ai";
import { z } from "zod";
import { scrapeGoogleShoppingSearch } from "@/lib/agentql/queries";
import type { Product } from "../types";

export const searchProducts = tool({
  description:
    "Search for products across many retailers via Google Shopping. Use this when the user wants to find products, browse items, or explore what's available.",
  inputSchema: z.object({
    query: z.string().describe("The product search query"),
    maxResults: z
      .number()
      .optional()
      .default(10)
      .describe("Maximum number of results to return"),
    country: z
      .enum(["AR", "BR", "MX", "CL", "CO", "US"])
      .optional()
      .default("US")
      .describe("Country code for localized results"),
    minPrice: z.number().optional().describe("Minimum price filter"),
    maxPrice: z.number().optional().describe("Maximum price filter"),
  }),
  execute: async ({ query, maxResults, country, minPrice, maxPrice }) => {
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

    return {
      query,
      sources: ["google-shopping"],
      country,
      resultCount: filtered.length,
      products: filtered.slice(0, maxResults),
      errors: errors.length > 0 ? errors : undefined,
      note:
        filtered.length === 0
          ? "No products found. Google Shopping may be temporarily unavailable. Tell the user and suggest they provide a direct product URL for you to analyze."
          : undefined,
    };
  },
});
