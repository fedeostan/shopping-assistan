import { tool } from "ai";
import { z } from "zod";
import { scrapeProductDetail } from "@/lib/agentql/queries";

export const getProductDetails = tool({
  description:
    "Get detailed information about a specific product from its URL. Use this when the user asks about a specific product from search results, shares a product link, or wants more details, specs, or availability for any item. Always prefer calling this over answering from search result summaries.",
  inputSchema: z.object({
    url: z.string().url().describe("The product page URL to extract details from"),
  }),
  execute: async ({ url }) => {
    try {
      const product = await scrapeProductDetail(url);

      return {
        success: true,
        product: {
          title: product.title,
          brand: product.brand,
          price: product.currentPrice,
          originalPrice: product.originalPrice,
          currency: product.currency,
          rating: product.rating,
          reviewCount: product.reviewCount,
          description: product.description?.slice(0, 200),
          ...(product.availability && product.availability !== "unknown" ? { availability: product.availability } : {}),
          specifications: product.specifications,
          source: product.source,
          url: product.productUrl,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Could not extract product details from ${url}. The page may be protected or the format is unsupported.`,
      };
    }
  },
});
