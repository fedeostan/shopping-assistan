import { tool } from "ai";
import { z } from "zod";
import { logInteraction } from "@/lib/persona/engine";
import { extractPurchaseSignals } from "@/lib/persona/signals";
import { tryShopifyCart, resolveRedirectUrl } from "@/lib/shopify/client";
import { buildCartPermalink } from "@/lib/cart/permalink";
import { findConnectorForUrl } from "@/lib/connectors";
import { runAutomation } from "@/lib/tinyfish/client";
import { getCachedRetailerUrl } from "@/lib/agentql/queries";

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

/** Infer proxy config based on retailer URL — use geo-local proxies for region-locked sites */
function inferProxyConfig(url: string): { proxy_config?: { enabled: boolean; country_code: "US" | "GB" | "CA" | "DE" | "FR" | "JP" | "AU" } } {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes("mercadoli") && hostname.endsWith(".com.ar")) return { proxy_config: { enabled: true, country_code: "US" } };
    if (hostname.includes("mercadolivre") && hostname.endsWith(".com.br")) return { proxy_config: { enabled: true, country_code: "US" } };
    if (hostname.includes("mercadoli") && hostname.endsWith(".com.mx")) return { proxy_config: { enabled: true, country_code: "US" } };
  } catch { /* ignore */ }
  return {};
}

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

export function createPurchase(userId: string | null) {
  return tool({
    description:
      "Add a product to the user's cart. For supported retailers (Amazon, MercadoLibre, Shopify), builds a direct cart link. For other stores, uses TinyFish Web Agent to navigate the real site and add to cart. Falls back to a direct link if all else fails.",
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

      // 1. Resolve Google Shopping redirects — check background cache first
      let resolvedUrl = productUrl;
      if (isGoogleShopping) {
        const cachedRetailer = getCachedRetailerUrl(productUrl);
        if (cachedRetailer) {
          console.log(`[Tool:purchase] Using pre-resolved retailer URL from cache: ${cachedRetailer}`);
          resolvedUrl = cachedRetailer;
        } else {
          resolvedUrl = await resolveRedirectUrl(productUrl);
        }
      }
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

      // 5. Try TinyFish browser automation (real web navigation)
      const automationGoal = buildAutomationGoal(resolvedUrl);
      console.log(`[Tool:purchase] Trying TinyFish browser automation for ${resolvedUrl} (goal=${automationGoal.slice(0, 60)}...)`);
      try {
        const tfResult = await runAutomation(
            {
              url: resolvedUrl,
              goal: automationGoal,
              browser_profile: "stealth",
              ...inferProxyConfig(resolvedUrl),
            },
            {
              timeoutMs: 60_000,  // 60s — just adding to cart, not full checkout
              maxSteps: 25,
            }
          );

          if (tfResult.success) {
            console.log(`[Tool:purchase] TinyFish SUCCESS steps=${tfResult.statusMessages.length} elapsed=${Date.now() - t0}ms`);

            if (userId) {
              let source: string;
              try { source = new URL(resolvedUrl).hostname; } catch { source = "unknown"; }
              const signals = extractPurchaseSignals({ brand: undefined, category: undefined, price: 0, source });
              logInteraction({
                userId,
                type: "add_to_cart",
                payload: { productName, productUrl: resolvedUrl, quantity, tinyfish: true },
                personaSignals: signals,
              }).catch(console.error);
            }

            return {
              success: true,
              addedToCart: true,
              productName,
              productUrl: resolvedUrl,
              quantity,
              cartMethod: "tinyfish_automation" as const,
              retailer: (() => { try { return new URL(resolvedUrl).hostname; } catch { return "unknown"; } })(),
              statusMessages: tfResult.statusMessages,
              streamingUrl: tfResult.streamingUrl,
            };
          }

          console.warn(`[Tool:purchase] TinyFish FAILED: ${tfResult.error ?? "unknown"} elapsed=${Date.now() - t0}ms`);
      } catch (err) {
        console.warn(`[Tool:purchase] TinyFish error:`, err instanceof Error ? err.message : err);
      }

      // 6. Fallback: direct link
      console.log(`[Tool:purchase] No cart method available — direct link fallback elapsed=${Date.now() - t0}ms`);

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

/** Build a site-aware automation goal for TinyFish based on the retailer hostname */
function buildAutomationGoal(url: string): string {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return GENERIC_GOAL;
  }

  if (hostname.includes("mercadoli") || hostname.includes("mercadolivre")) {
    return `Navigate to this MercadoLibre product page. Close any cookie or notification popups. Click "Agregar al carrito" or "Comprar ahora". If asked to select color, size, or variant, pick the first available option. Return JSON: {"added": true/false, "cartTotal": "string or null", "error": "string or null"}`;
  }

  if (hostname.includes("amazon.")) {
    return `Navigate to this Amazon product page. Close any cookie consent banners. Click the "Add to Cart" button. If a "No thanks" upsell or warranty popup appears, dismiss it. Return JSON: {"added": true/false, "error": "string or null"}`;
  }

  if (hostname.includes("bestbuy.")) {
    return `Navigate to this Best Buy product page. Close any cookie or survey popups. Click "Add to Cart". If a membership or protection plan modal appears, click "No thanks" or close it. Return JSON: {"added": true/false, "error": "string or null"}`;
  }

  if (hostname.includes("walmart.")) {
    return `Navigate to this Walmart product page. Close any cookie or location popups. Click "Add to cart". If asked about Walmart+ or delivery options, dismiss the popup. Return JSON: {"added": true/false, "error": "string or null"}`;
  }

  if (hostname.includes("target.")) {
    return `Navigate to this Target product page. Close any cookie or survey popups. Click "Add to cart". If asked to choose a store for pickup, select the first option or switch to shipping. Return JSON: {"added": true/false, "error": "string or null"}`;
  }

  return GENERIC_GOAL;
}

const GENERIC_GOAL = `Navigate to this product page. Close any popups, cookie banners, or notification dialogs. Find and click the "Add to Cart" button — it may say "Add to Bag", "Buy Now", "Agregar al carrito", or similar in any language. If asked to select a size, color, or variant, choose the first available option. Return JSON: {"added": true/false, "error": "string or null"}`;
