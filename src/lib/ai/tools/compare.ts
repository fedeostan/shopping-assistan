import { tool } from "ai";
import { z } from "zod";
import { searchMercadoLibre } from "@/lib/mercadolibre/client";
import {
  scrapeMercadoLibreSearch,
  scrapeAmazonSearch,
} from "@/lib/agentql/queries";

export const comparePrices = tool({
  description:
    "Compare prices for a specific product across multiple retailers. Use this when the user wants to find the best deal or see price differences between stores.",
  inputSchema: z.object({
    productName: z
      .string()
      .describe("The product name or description to compare"),
    sources: z
      .array(z.enum(["mercadolibre", "amazon", "all"]))
      .optional()
      .default(["all"])
      .describe("Which platforms to compare"),
    country: z
      .enum(["AR", "BR", "MX", "CL", "CO", "US"])
      .optional()
      .default("AR")
      .describe("Country code for localized results"),
  }),
  execute: async ({ productName, country }) => {
    const results: {
      source: string;
      price: number;
      currency: string;
      url: string;
      title: string;
      availability?: string;
    }[] = [];

    // Search MercadoLibre — API then AgentQL fallback
    try {
      const { products } = await searchMercadoLibre({
        query: productName,
        country: country ?? "AR",
        limit: 5,
        sort: "price_asc",
      });

      const meliProducts =
        products.length > 0
          ? products
          : await scrapeMercadoLibreSearch(productName, country ?? "AR");

      for (const p of meliProducts.slice(0, 5)) {
        results.push({
          source: "MercadoLibre",
          price: p.currentPrice,
          currency: p.currency,
          url: p.productUrl ?? "",
          title: p.title,
          availability: p.availability,
        });
      }
    } catch (error) {
      console.error("[compare] MercadoLibre error:", error);
    }

    // Search Amazon via AgentQL
    try {
      const amazonProducts = await scrapeAmazonSearch(productName);
      for (const p of amazonProducts.slice(0, 5)) {
        results.push({
          source: "Amazon",
          price: p.currentPrice,
          currency: p.currency,
          url: p.productUrl ?? "",
          title: p.title,
          availability: p.availability,
        });
      }
    } catch (error) {
      console.error("[compare] Amazon error:", error);
    }

    // Sort by price ascending
    results.sort((a, b) => a.price - b.price);
    const cheapest = results[0];

    return {
      product: productName,
      resultCount: results.length,
      results,
      cheapest: cheapest
        ? {
            source: cheapest.source,
            price: cheapest.price,
            currency: cheapest.currency,
            title: cheapest.title,
          }
        : null,
      recommendation:
        results.length > 1
          ? `Found ${results.length} options for "${productName}". The cheapest is "${cheapest.title}" at ${cheapest.currency} ${cheapest.price.toLocaleString()} on ${cheapest.source}.`
          : results.length === 1
            ? `Found 1 option for "${productName}" on ${cheapest.source} at ${cheapest.currency} ${cheapest.price.toLocaleString()}.`
            : `No results found for "${productName}". Try a different search term.`,
    };
  },
});
