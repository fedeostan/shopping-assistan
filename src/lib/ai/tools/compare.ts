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
    const errors: string[] = [];

    // Search MercadoLibre — API then AgentQL fallback
    try {
      const { products } = await searchMercadoLibre({
        query: productName,
        country: country ?? "AR",
        limit: 5,
        sort: "price_asc",
      });

      let meliProducts = products;
      if (meliProducts.length === 0) {
        try {
          meliProducts = await scrapeMercadoLibreSearch(
            productName,
            country ?? "AR"
          );
        } catch (scrapeError) {
          errors.push(
            `MercadoLibre: ${scrapeError instanceof Error ? scrapeError.message : "scraping failed"}`
          );
        }
      }

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
      errors.push(
        `MercadoLibre: ${error instanceof Error ? error.message : "API failed"}`
      );
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
      errors.push(
        `Amazon: ${error instanceof Error ? error.message : "scraping failed"}`
      );
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
      errors: errors.length > 0 ? errors : undefined,
      recommendation:
        results.length > 1
          ? `Found ${results.length} options for "${productName}". The cheapest is "${cheapest.title}" at ${cheapest.currency} ${cheapest.price.toLocaleString()} on ${cheapest.source}.`
          : results.length === 1
            ? `Found 1 option for "${productName}" on ${cheapest.source} at ${cheapest.currency} ${cheapest.price.toLocaleString()}.`
            : `No results found. Data sources may be temporarily unavailable. Tell the user which sources failed and why.`,
    };
  },
});
