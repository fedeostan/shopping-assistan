import { tool } from "ai";
import { z } from "zod";
import { logInteraction } from "@/lib/persona/engine";
import { extractPurchaseSignals } from "@/lib/persona/signals";
import { tryShopifyCart, resolveRedirectUrl } from "@/lib/shopify/client";
import { buildCartPermalink } from "@/lib/cart/permalink";
import { findConnectorForUrl } from "@/lib/connectors";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isGoogleShoppingUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname.includes("google.") &&
      (u.pathname.includes("/shopping/") || u.pathname.includes("/product/") ||
       u.searchParams.has("prds") || u.searchParams.has("tbm"));
  } catch { return false; }
}

function isGoogleUrl(url: string): boolean {
  try {
    return new URL(url).hostname.includes("google.");
  } catch { return true; }
}

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

export function createPurchase(userId: string | null) {
  return tool({
    description:
      "Add a product to the user's cart. For supported retailers (Amazon, MercadoLibre, Shopify), builds a direct cart link. For other stores, returns the product URL for the user to open directly.",
    inputSchema: z.object({
      productUrl: z
        .string()
        .url()
        .describe(
          "URL to the product page — can be a Google Shopping link or a direct retailer URL"
        ),
      productName: z
        .string()
        .describe("Name of the product (for display)"),
      quantity: z
        .number()
        .optional()
        .default(1)
        .describe("Number of items to add"),
    }),
    execute: async ({ productUrl, productName, quantity }) => {
      console.log(`[Tool:purchase] START product="${productName}" url=${productUrl} qty=${quantity}`);
      const t0 = Date.now();

      const isGoogleShopping = isGoogleShoppingUrl(productUrl);

      // 1. Resolve Google Shopping redirects
      const resolvedUrl = isGoogleShopping
        ? await resolveRedirectUrl(productUrl)
        : productUrl;
      console.log(`[Tool:purchase] resolvedUrl=${resolvedUrl}`);

      // Pre-flight: reject if still on Google
      if (isGoogleUrl(resolvedUrl)) {
        console.warn(`[Tool:purchase] BLOCKED — resolved URL is still Google: ${resolvedUrl}`);
        return {
          success: false,
          addedToCart: false,
          productName,
          productUrl: resolvedUrl,
          quantity,
          cartMethod: "direct_link" as const,
          error: "This product only has a Google Shopping link — no direct retailer URL could be found. Try searching again with preferDirectLinks: true, or use search_store to find this product on a specific retailer.",
          statusMessages: [],
        };
      }

      // 2. Try cart permalink (Amazon)
      const cartResult = buildCartPermalink(resolvedUrl, quantity);
      if (cartResult) {
        console.log(`[Tool:purchase] Cart permalink SUCCESS retailer=${cartResult.retailer} elapsed=${Date.now() - t0}ms`);

        if (userId) {
          let source: string;
          try { source = new URL(resolvedUrl).hostname; } catch { source = "unknown"; }
          const signals = extractPurchaseSignals({ brand: undefined, category: undefined, price: 0, source });
          logInteraction({
            userId,
            type: "add_to_cart",
            payload: { productName, productUrl: resolvedUrl, quantity, retailer: cartResult.retailer },
            personaSignals: signals,
          }).catch(console.error);
        }

        return {
          success: true,
          addedToCart: true,
          productName,
          productUrl: resolvedUrl,
          quantity,
          cartMethod: cartResult.method,
          cartUrl: cartResult.cartUrl,
          retailer: cartResult.retailer,
          statusMessages: [],
        };
      }

      // 3. Try marketplace connector cart (MercadoLibre)
      const connector = findConnectorForUrl(resolvedUrl);
      if (connector?.tryCart) {
        const connectorResult = await connector.tryCart(resolvedUrl, quantity);
        if (connectorResult?.success) {
          console.log(`[Tool:purchase] ${connector.displayName} cart SUCCESS elapsed=${Date.now() - t0}ms`);

          if (userId) {
            const signals = extractPurchaseSignals({ brand: undefined, category: undefined, price: 0, source: connector.id });
            logInteraction({
              userId,
              type: "add_to_cart",
              payload: { productName, productUrl: resolvedUrl, quantity, connector: connector.id },
              personaSignals: signals,
            }).catch(console.error);
          }

          return {
            success: true,
            addedToCart: true,
            productName,
            productUrl: resolvedUrl,
            quantity,
            cartMethod: "cart_permalink" as const,
            cartUrl: connectorResult.checkoutUrl,
            retailer: connector.id,
            statusMessages: [],
          };
        }
      }

      // 4. Try Shopify cart permalink
      const shopifyResult = await tryShopifyCart(resolvedUrl, quantity);
      if (shopifyResult.success) {
        console.log(`[Tool:purchase] Shopify cart SUCCESS elapsed=${Date.now() - t0}ms`);

        if (userId) {
          const signals = extractPurchaseSignals({
            brand: undefined,
            category: undefined,
            price: parseFloat(shopifyResult.variant.price) || 0,
            source: shopifyResult.storeDomain,
          });
          logInteraction({
            userId,
            type: "add_to_cart",
            payload: { productName, productUrl: resolvedUrl, quantity, shopify: true },
            personaSignals: signals,
          }).catch(console.error);
        }

        return {
          success: true,
          addedToCart: true,
          productName,
          productUrl: resolvedUrl,
          quantity,
          cartMethod: "shopify_permalink" as const,
          cartUrl: shopifyResult.checkoutUrl,
          retailer: "shopify",
          shopifyVariant: {
            title: shopifyResult.variant.title,
            price: shopifyResult.variant.price,
          },
          statusMessages: [],
        };
      }

      // 5. Fallback: direct link
      console.log(`[Tool:purchase] No cart permalink available — direct link fallback elapsed=${Date.now() - t0}ms`);

      if (userId) {
        let source: string;
        try { source = new URL(resolvedUrl).hostname; } catch { source = "unknown"; }
        const signals = extractPurchaseSignals({ brand: undefined, category: undefined, price: 0, source });
        logInteraction({
          userId,
          type: "add_to_cart",
          payload: { productName, productUrl: resolvedUrl, quantity, directLink: true },
          personaSignals: signals,
        }).catch(console.error);
      }

      return {
        success: true,
        addedToCart: false,
        productName,
        productUrl: resolvedUrl,
        quantity,
        cartMethod: "direct_link" as const,
        statusMessages: [],
      };
    },
  });
}
