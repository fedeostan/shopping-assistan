import { tool } from "ai";
import { z } from "zod";
import { resolveStoreDomain, searchStore } from "@/lib/store/search";
import { logInteraction } from "@/lib/persona/engine";
import { extractSearchSignals } from "@/lib/persona/signals";
import type { Product } from "../types";

export function createSearchStore(userId: string | null) {
  return tool({
    description:
      "Search for products directly on a specific store's website by name. Use when user mentions a store/brand name with a product query (e.g. 'alfa hackers bath pool', 'adidas running shoes'). Works with any online store — Shopify, custom sites, brand stores.",
    inputSchema: z.object({
      storeName: z
        .string()
        .describe("The store/brand name (e.g. 'alfa hackers', 'adidas')"),
      storeUrl: z
        .string()
        .url()
        .optional()
        .describe("Full store URL if known — skips domain resolution"),
      query: z.string().describe("Product search terms (exclude the store name)"),
      maxResults: z.number().optional().default(6),
    }),
    execute: async ({ storeName, storeUrl, query, maxResults }) => {
      console.log(
        `[Tool:search_store] START storeName="${storeName}" storeUrl=${storeUrl ?? "none"} query="${query}" maxResults=${maxResults}`
      );
      const t0 = Date.now();

      let resolvedUrl: string;
      let isShopify = false;

      // 1. Resolve store domain
      if (storeUrl) {
        resolvedUrl = new URL(storeUrl).origin;
        // Quick Shopify check on provided URL
        try {
          const res = await fetch(resolvedUrl, {
            method: "HEAD",
            redirect: "follow",
            signal: AbortSignal.timeout(3_000),
          });
          isShopify =
            res.headers.has("x-shopify-stage") ||
            res.headers.has("x-shopid") ||
            new URL(resolvedUrl).hostname.endsWith(".myshopify.com");
        } catch {
          // Probe failed, assume not Shopify
        }
      } else {
        const resolved = await resolveStoreDomain(storeName);
        if (!resolved) {
          console.log(
            `[Tool:search_store] RESOLUTION_FAILED storeName="${storeName}" elapsed=${Date.now() - t0}ms`
          );
          return {
            query,
            storeName,
            sources: [`store:${storeName}`],
            country: "US",
            resultCount: 0,
            products: [],
            note: `Could not find store "${storeName}". Try providing the full URL (e.g. "search alfa hackers at https://alfahackers.com").`,
          };
        }
        resolvedUrl = resolved.url;
        isShopify = resolved.isShopify;
      }

      console.log(
        `[Tool:search_store] Resolved: url=${resolvedUrl} isShopify=${isShopify}`
      );

      // 2. Search the store
      let products: Product[] = [];
      const errors: string[] = [];

      try {
        products = await searchStore(resolvedUrl, query, isShopify, maxResults);
      } catch (err) {
        const msg = `Store search failed: ${err instanceof Error ? err.message : "unknown error"}`;
        errors.push(msg);
        console.error(`[Tool:search_store] SEARCH_FAILED:`, msg);
      }

      // 3. Slim projection (same shape as search.ts)
      const slimProducts = products.slice(0, maxResults).map((p) => ({
        id: p.id,
        externalId: p.externalId,
        title: p.title,
        brand: p.brand,
        currentPrice: p.currentPrice,
        ...(p.originalPrice && p.originalPrice !== p.currentPrice
          ? { originalPrice: p.originalPrice }
          : {}),
        currency: p.currency,
        rating: p.rating,
        source: p.source,
        imageUrl: p.imageUrl,
        productUrl: p.productUrl,
        retailerUrl: p.retailerUrl,
        ...(p.availability && p.availability !== "unknown"
          ? { availability: p.availability }
          : {}),
        ...(p.description ? { description: p.description.slice(0, 100) } : {}),
      }));

      // 4. Log persona signals
      if (userId) {
        const signals = extractSearchSignals(query, {});
        logInteraction({
          userId,
          type: "search",
          payload: {
            query: `${storeName} ${query}`,
            storeName,
            storeUrl: resolvedUrl,
            resultCount: slimProducts.length,
          },
          personaSignals: signals,
        }).catch(console.error);
      }

      console.log(
        `[Tool:search_store] DONE storeName="${storeName}" query="${query}" returned=${slimProducts.length} elapsed=${Date.now() - t0}ms`
      );

      return {
        query,
        storeName,
        storeUrl: resolvedUrl,
        sources: [`store:${new URL(resolvedUrl).hostname}`],
        country: "US",
        resultCount: slimProducts.length,
        products: slimProducts,
        errors: errors.length > 0 ? errors : undefined,
        note:
          slimProducts.length === 0
            ? `No products found on ${storeName}. The store may not have matching items, or try a different search term.`
            : undefined,
      };
    },
  });
}
