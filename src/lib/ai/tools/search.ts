import { tool } from "ai";
import { z } from "zod";
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
  execute: async ({ query, maxResults, sources, country }) => {
    // TODO: Wire up MercadoLibre API + AgentQL scraping
    // For now, return mock data to validate the tool loop
    const mockProducts: Product[] = [
      {
        id: "mock-1",
        source: "mercadolibre",
        title: `${query} - Premium Option`,
        brand: "Top Brand",
        currency: country === "US" ? "USD" : "ARS",
        currentPrice: 299.99,
        originalPrice: 399.99,
        rating: 4.5,
        reviewCount: 1234,
        availability: "in_stock",
        productUrl: "https://mercadolibre.com.ar/mock-1",
        imageUrl: "https://via.placeholder.com/200",
      },
      {
        id: "mock-2",
        source: "mercadolibre",
        title: `${query} - Budget Option`,
        brand: "Value Brand",
        currency: country === "US" ? "USD" : "ARS",
        currentPrice: 149.99,
        rating: 4.0,
        reviewCount: 567,
        availability: "in_stock",
        productUrl: "https://mercadolibre.com.ar/mock-2",
        imageUrl: "https://via.placeholder.com/200",
      },
      {
        id: "mock-3",
        source: "amazon",
        title: `${query} - Best Seller`,
        brand: "Popular Brand",
        currency: "USD",
        currentPrice: 249.99,
        originalPrice: 299.99,
        rating: 4.7,
        reviewCount: 5678,
        availability: "in_stock",
        productUrl: "https://amazon.com/mock-3",
        imageUrl: "https://via.placeholder.com/200",
      },
    ];

    return {
      query,
      sources: sources?.includes("all")
        ? ["mercadolibre", "amazon"]
        : sources,
      country,
      resultCount: Math.min(mockProducts.length, maxResults ?? 10),
      products: mockProducts.slice(0, maxResults),
    };
  },
});
