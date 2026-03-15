import { tool } from "ai";
import { z } from "zod";
import { scrapeProductDetail } from "@/lib/agentql/queries";
import { logInteraction } from "@/lib/persona/engine";
import { CircuitOpenError } from "@/lib/utils/service-error";
import type { PersonaSignal } from "@/lib/persona/types";

export function createProductDetails(userId: string | null) {
  return tool({
    description:
      "Get detailed information about a specific product from its URL. Use this when the user asks about a specific product from search results, shares a product link, or wants more details, specs, or availability for any item. Always prefer calling this over answering from search result summaries.",
    inputSchema: z.object({
      url: z.string().url().describe("The product page URL to extract details from"),
    }),
    execute: async ({ url }) => {
      console.log(`[Tool:details] START url=${url}`);
      const t0 = Date.now();
      try {
        const product = await scrapeProductDetail(url);
        const stale = !!(product as { _stale?: boolean })._stale;
        console.log(`[Tool:details] Scraped: title="${product.title}" price=${product.currentPrice} source=${product.source} retailerUrl=${product.retailerUrl ?? "NONE"} stale=${stale} elapsed=${Date.now() - t0}ms`);

        // Log click signals for persona learning
        if (userId) {
          const signals: PersonaSignal[] = [];
          if (product.brand) {
            signals.push({
              type: "brand_preference",
              key: product.brand,
              value: 1,
              confidence: product.currentPrice ? 0.4 : 0.3,
              source: "click",
            });
          }
          if (product.source) {
            signals.push({
              type: "category_interest",
              key: product.source,
              value: 1,
              confidence: 0.3,
              source: "click",
            });
          }
          logInteraction({
            userId,
            type: "click",
            payload: {
              url,
              title: product.title,
              brand: product.brand,
              price: product.currentPrice,
              source: product.source,
            },
            personaSignals: signals,
          }).catch(console.error);
        }

        return {
          success: true,
          ...(stale ? { _stale: true } : {}),
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
            ...(product.retailerUrl ? { retailerUrl: product.retailerUrl } : {}),
          },
          // Signal when retailer URL couldn't be resolved from Google Shopping
          ...(product.source === "google-shopping" && !product.retailerUrl
            ? (() => {
                console.warn(`[Tool:details] HINT retailer_url_not_found for Google Shopping product "${product.title}"`);
                return {
                  hint: "retailer_url_not_found",
                  suggestion: "Search for this product by name on specific retailers (e.g., product name + site:retailer.com)",
                };
              })()
            : {}),
        };
      } catch (error) {
        if (error instanceof CircuitOpenError) {
          console.warn(`[Tool:details] CIRCUIT_OPEN url=${url}: ${error.userMessage}`);
          return {
            success: false,
            error: error.userMessage,
            circuitOpen: true,
            hint: "fallback_to_search_context",
          };
        }
        const isTimeout =
          error instanceof Error &&
          (error.name === "AbortError" || error.message.includes("timed out"));
        const message = isTimeout
          ? `Timed out loading product details from ${url}. The site may be slow or heavily protected.`
          : `Could not extract product details from ${url}. The page may be protected or the format is unsupported.`;
        console.error(`[Tool:details] FAILED url=${url} timeout=${isTimeout} elapsed=${Date.now() - t0}ms:`, error instanceof Error ? error.message : error);
        return {
          success: false,
          error: message,
          hint: "fallback_to_search_context",
        };
      }
    },
  });
}
