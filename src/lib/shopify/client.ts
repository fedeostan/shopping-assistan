// ---------------------------------------------------------------------------
// Shopify Direct Cart Integration
//
// For Shopify stores, bypass TinyFish by building permalink cart URLs:
//   https://{store}/cart/{variant_id}:{quantity}
// These open checkout in the user's browser with no session/expiry issues.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ShopifyVariant {
  id: number;
  title: string;
  price: string;
  available: boolean;
}

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  variants: ShopifyVariant[];
}

export type ShopifyCartResult = {
  success: true;
  checkoutUrl: string;
  storeDomain: string;
  product: { title: string; handle: string };
  variant: { id: number; title: string; price: string };
};

export type ShopifyCartError = {
  success: false;
  reason:
    | "not_shopify"
    | "product_not_found"
    | "json_disabled"
    | "out_of_stock"
    | "fetch_error";
  message: string;
};

// ---------------------------------------------------------------------------
// Detection helpers
// ---------------------------------------------------------------------------

/** Fast hostname check — no network. */
function isShopifyStore(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return hostname.endsWith(".myshopify.com");
  } catch {
    return false;
  }
}

/**
 * Follow redirects (e.g. Google Shopping → retailer) via HEAD request.
 * Returns the final URL after redirects, or the original on error.
 */
async function resolveRedirectUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(5_000),
    });
    return res.url || url;
  } catch {
    return url;
  }
}

/**
 * Detect Shopify on custom domains by probing response headers.
 * Shopify stores typically include `x-shopify-stage` or `X-ShopId`.
 */
async function probeShopifyHeaders(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(5_000),
    });
    return (
      res.headers.has("x-shopify-stage") || res.headers.has("x-shopid")
    );
  } catch {
    return false;
  }
}

/**
 * Full Shopify detection: hostname heuristic first, then header probe
 * for custom domains.
 */
async function detectShopifyStore(url: string): Promise<boolean> {
  if (isShopifyStore(url)) return true;
  return probeShopifyHeaders(url);
}

// ---------------------------------------------------------------------------
// URL parsing
// ---------------------------------------------------------------------------

/**
 * Extract the product handle from a Shopify URL path.
 * Handles both `/products/{handle}` and `/collections/.../products/{handle}`.
 */
function extractProductHandle(url: string): string | null {
  try {
    const { pathname } = new URL(url);
    const match = pathname.match(/\/products\/([^/?#]+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Product data
// ---------------------------------------------------------------------------

async function fetchShopifyProduct(
  storeUrl: string,
  handle: string
): Promise<
  | { ok: true; product: ShopifyProduct }
  | { ok: false; reason: "product_not_found" | "json_disabled" | "fetch_error"; message: string }
> {
  const { origin } = new URL(storeUrl);
  const endpoint = `${origin}/products/${handle}.json`;

  let res: Response;
  try {
    res = await fetch(endpoint, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
  } catch (err) {
    return {
      ok: false,
      reason: "fetch_error",
      message: err instanceof Error ? err.message : "Network error fetching Shopify product",
    };
  }

  if (res.status === 404) {
    return { ok: false, reason: "product_not_found", message: `Product "${handle}" not found` };
  }

  if (!res.ok) {
    // Many stores disable the .json endpoint (403/401)
    return {
      ok: false,
      reason: "json_disabled",
      message: `Shopify JSON API returned ${res.status}`,
    };
  }

  try {
    const data = (await res.json()) as { product: ShopifyProduct };
    return { ok: true, product: data.product };
  } catch {
    return { ok: false, reason: "json_disabled", message: "Failed to parse Shopify JSON response" };
  }
}

/** MVP: pick the first available variant. */
function selectVariant(product: ShopifyProduct): ShopifyVariant | null {
  return product.variants.find((v) => v.available) ?? null;
}

function buildCartUrl(storeDomain: string, variantId: number, qty: number): string {
  return `https://${storeDomain}/cart/${variantId}:${qty}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Orchestrator — attempts to build a Shopify direct cart URL.
 * Returns a discriminated union so the caller can fall through to TinyFish
 * on any failure.
 */
export async function tryShopifyCart(
  url: string,
  quantity: number
): Promise<ShopifyCartResult | ShopifyCartError> {
  console.log(`[Shopify] Attempting direct cart for url=${url} qty=${quantity}`);

  // 1. Detect Shopify
  const isShopify = await detectShopifyStore(url);
  if (!isShopify) {
    console.log(`[Shopify] Not a Shopify store: ${url}`);
    return { success: false, reason: "not_shopify", message: "Not a Shopify store" };
  }

  // 2. Extract product handle
  const handle = extractProductHandle(url);
  if (!handle) {
    console.log(`[Shopify] Could not extract product handle from: ${url}`);
    return {
      success: false,
      reason: "product_not_found",
      message: "Could not extract product handle from URL",
    };
  }

  // 3. Fetch product data
  const result = await fetchShopifyProduct(url, handle);
  if (!result.ok) {
    console.log(`[Shopify] Product fetch failed: reason=${result.reason} msg=${result.message}`);
    return { success: false, reason: result.reason, message: result.message };
  }

  // 4. Select variant
  const variant = selectVariant(result.product);
  if (!variant) {
    console.log(`[Shopify] All variants out of stock for "${result.product.title}"`);
    return {
      success: false,
      reason: "out_of_stock",
      message: `All variants of "${result.product.title}" are out of stock`,
    };
  }

  // 5. Build cart URL
  const storeDomain = new URL(url).hostname;
  const checkoutUrl = buildCartUrl(storeDomain, variant.id, quantity);
  console.log(`[Shopify] SUCCESS — checkoutUrl=${checkoutUrl} variant="${variant.title}" price=${variant.price}`);

  return {
    success: true,
    checkoutUrl,
    storeDomain,
    product: { title: result.product.title, handle: result.product.handle },
    variant: { id: variant.id, title: variant.title, price: variant.price },
  };
}

/**
 * Resolve Google Shopping redirects before Shopify detection.
 * Exported so buy.ts can call it independently.
 */
export { resolveRedirectUrl };
