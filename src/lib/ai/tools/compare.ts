import { tool } from "ai";
import { z } from "zod";
import { scrapeGoogleShoppingSearch } from "@/lib/agentql/queries";

export const comparePrices = tool({
  description:
    "Compare prices for a specific product across multiple retailers via Google Shopping. Use this when the user wants to find the best deal or see price differences between stores.",
  inputSchema: z.object({
    productName: z
      .string()
      .describe("The product name or description to compare"),
    country: z
      .enum(["AR", "BR", "MX", "CL", "CO", "US"])
      .optional()
      .default("US")
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

    try {
      const products = await scrapeGoogleShoppingSearch(
        productName,
        country ?? "US"
      );

      for (const p of products.slice(0, 10)) {
        results.push({
          source: p.source,
          price: p.currentPrice,
          currency: p.currency,
          url: p.productUrl ?? "",
          title: p.title,
          availability: p.availability,
        });
      }
    } catch (error) {
      errors.push(
        `Google Shopping: ${error instanceof Error ? error.message : "scraping failed"}`
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
          ? `Found ${results.length} options for "${productName}". The cheapest is "${cheapest.title}" at ${cheapest.currency} ${cheapest.price.toLocaleString()} from ${cheapest.source}.`
          : results.length === 1
            ? `Found 1 option for "${productName}" at ${cheapest.currency} ${cheapest.price.toLocaleString()} from ${cheapest.source}.`
            : `No results found. Google Shopping may be temporarily unavailable. Tell the user and suggest they provide a direct product URL.`,
    };
  },
});
