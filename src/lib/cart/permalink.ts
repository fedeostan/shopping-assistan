// src/lib/cart/permalink.ts
// Client-safe cart permalink builders for major retailers.
// Used by product cards (canBuildCartLink) and buy tool (buildCartPermalink).

export interface CartPermalinkResult {
  cartUrl: string;
  retailer: string;
  method: "cart_permalink";
}

// --- Amazon ---

const AMAZON_HOSTS = [
  "amazon.com", "amazon.co.uk", "amazon.de", "amazon.fr", "amazon.it",
  "amazon.es", "amazon.co.jp", "amazon.ca", "amazon.com.au", "amazon.com.br",
  "amazon.com.mx", "amazon.in", "amazon.nl", "amazon.sg", "amazon.se",
  "amazon.pl", "amazon.com.be", "amazon.com.tr", "amazon.sa", "amazon.ae",
];

const ASIN_REGEX = /\/(?:dp|gp\/product)\/(B[A-Z0-9]{9})/;

function isAmazonHost(hostname: string): boolean {
  return AMAZON_HOSTS.some(
    (h) => hostname === h || hostname === `www.${h}`,
  );
}

function extractAsin(url: string): string | null {
  const match = url.match(ASIN_REGEX);
  return match ? match[1] : null;
}

function buildAmazonCartUrl(
  origin: string,
  asin: string,
  quantity: number,
): string {
  return `${origin}/gp/aws/cart/add.html?ASIN.1=${asin}&Quantity.1=${quantity}`;
}

// --- MercadoLibre (client-safe hostname check only) ---

function isMercadoLibreHost(hostname: string): boolean {
  return hostname.includes("mercadoli");
}

function hasMeliItemId(url: string): boolean {
  return /\/p\/ML[A-Z]\d+/.test(url) || /ML[A-Z]-?\d+/.test(url);
}

// --- Registry ---

/**
 * Synchronous check — can we build a cart permalink for this URL?
 * Used at render time in product cards to decide button label.
 * Covers: Amazon (via ASIN extraction), MercadoLibre (via item ID detection).
 * Shopify is async (header probe) so NOT included here — it's handled server-side.
 */
export function canBuildCartLink(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const { hostname } = new URL(url);
    if (isAmazonHost(hostname) && extractAsin(url)) return true;
    if (isMercadoLibreHost(hostname) && hasMeliItemId(url)) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Build a direct "add to cart" URL for supported retailers.
 * Returns null for unsupported stores — caller falls through to connector/Shopify/direct link.
 * Uses the same origin as the input URL (no hardcoded domains).
 */
export function buildCartPermalink(
  url: string,
  quantity: number = 1,
): CartPermalinkResult | null {
  try {
    const parsed = new URL(url);
    const { hostname, origin } = parsed;

    // Amazon
    if (isAmazonHost(hostname)) {
      const asin = extractAsin(url);
      if (asin) {
        return {
          cartUrl: buildAmazonCartUrl(origin, asin, quantity),
          retailer: "amazon",
          method: "cart_permalink",
        };
      }
    }

    // MercadoLibre — detected here for canBuildCartLink symmetry,
    // but actual cart URL is built server-side by the existing connector.
    // This branch is only reached if buildCartPermalink is called client-side
    // (it shouldn't be — buy.ts uses the connector directly).
    return null;
  } catch {
    return null;
  }
}
