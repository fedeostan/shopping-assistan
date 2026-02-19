import { tool } from "ai";
import { z } from "zod";
import { searchMercadoLibre } from "@/lib/mercadolibre/client";
import {
  scrapeMercadoLibreSearch,
  scrapeAmazonSearch,
} from "@/lib/agentql/queries";
import type { Product } from "../types";

export const searchProducts = tool({
  description:
    "Search for products across multiple platforms (MercadoLibre, Amazon, etc). Use this when the user wants to find products, browse items, or explore what's available.",
  inputSchema: z.object({
    query: z.string().describe("The product search query"),
    maxResults: z
      .number()
      .optional()
      .default(10)
      .describe("Maximum number of results to return"),
    sources: z
      .array(z.enum(["mercadolibre", "amazon", "all"]))
      .optional()
      .default(["all"])
      .describe("Which platforms to search"),
    country: z
      .enum(["AR", "BR", "MX", "CL", "CO", "US"])
      .optional()
      .default("AR")
      .describe("Country code for localized results"),
    minPrice: z.number().optional().describe("Minimum price filter"),
    maxPrice: z.number().optional().describe("Maximum price filter"),
  }),
  execute: async ({
    query,
    maxResults,
    sources,
    country,
    minPrice,
    maxPrice,
  }) => {
    const allProducts: Product[] = [];
    const errors: string[] = [];
    const activeSources =
      sources?.includes("all")
        ? ["mercadolibre", "amazon"]
        : sources ?? ["mercadolibre"];

    // Search MercadoLibre — try API first, fall back to AgentQL scraping
    if (activeSources.includes("mercadolibre")) {
      try {
        const { products } = await searchMercadoLibre({
          query,
          country: country ?? "AR",
          limit: maxResults ?? 10,
        });

        if (products.length > 0) {
          allProducts.push(...products);
        } else {
          // API returned empty (likely 403) — fall back to AgentQL
          try {
            const scraped = await scrapeMercadoLibreSearch(
              query,
              country ?? "AR"
            );
            allProducts.push(...scraped);
          } catch (scrapeError) {
            errors.push(
              `MercadoLibre: API requires OAuth and AgentQL scraping failed (${scrapeError instanceof Error ? scrapeError.message : "unknown error"})`
            );
          }
        }
      } catch (error) {
        try {
          const scraped = await scrapeMercadoLibreSearch(
            query,
            country ?? "AR"
          );
          allProducts.push(...scraped);
        } catch (scrapeError) {
          errors.push(
            `MercadoLibre: Both API and scraping failed (${scrapeError instanceof Error ? scrapeError.message : "unknown error"})`
          );
        }
      }
    }

    // Search Amazon via AgentQL scraping
    if (activeSources.includes("amazon")) {
      try {
        const scraped = await scrapeAmazonSearch(query);
        allProducts.push(...scraped);
      } catch (error) {
        errors.push(
          `Amazon: Scraping failed (${error instanceof Error ? error.message : "unknown error"})`
        );
      }
    }

    // Apply price filters
    let filtered = allProducts;
    if (minPrice !== undefined) {
      filtered = filtered.filter((p) => p.currentPrice >= minPrice);
    }
    if (maxPrice !== undefined) {
      filtered = filtered.filter((p) => p.currentPrice <= maxPrice);
    }

    return {
      query,
      sources: activeSources,
      country,
      resultCount: filtered.length,
      products: filtered.slice(0, maxResults),
      errors: errors.length > 0 ? errors : undefined,
      note:
        filtered.length === 0
          ? "No products found. Data sources may be temporarily unavailable. Tell the user which sources failed and suggest they try again later or provide a direct product URL for you to analyze."
          : undefined,
    };
  },
});
