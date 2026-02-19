import { tool } from "ai";
import { z } from "zod";

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
    // TODO: Wire up real price comparison across platforms
    const currency = country === "US" ? "USD" : "ARS";

    return {
      product: productName,
      results: [
        {
          source: "MercadoLibre",
          price: 249999,
          currency,
          url: "https://mercadolibre.com.ar/mock",
          availability: "in_stock",
          shipping: "Free shipping",
        },
        {
          source: "Amazon",
          price: 279.99,
          currency: "USD",
          url: "https://amazon.com/mock",
          availability: "in_stock",
          shipping: "$5.99 shipping",
        },
      ],
      cheapest: {
        source: "MercadoLibre",
        price: 249999,
        currency,
        savings: "10% cheaper than Amazon",
      },
      recommendation: `Based on current prices, MercadoLibre offers the best deal on ${productName}. The price has been stable for the past week.`,
    };
  },
});
