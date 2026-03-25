import type { CartResult } from "../types";

/**
 * Check if a URL belongs to Mercado Libre (any country variant).
 * Covers mercadolibre.com.ar, mercadolivre.com.br, etc.
 */
export function ownsMeliUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return hostname.includes("mercadoli");
  } catch {
    return false;
  }
}

/**
 * Build a Mercado Libre checkout URL from a product URL.
 * MeLi item IDs follow the pattern: MLA123456789 (site prefix + digits).
 */
export async function tryMeliCart(
  productUrl: string,
  quantity: number
): Promise<CartResult | null> {
  if (!ownsMeliUrl(productUrl)) return null;

  const itemId = extractItemId(productUrl);
  if (!itemId) {
    return {
      success: false,
      reason: "item_id_not_found",
      message: "Could not extract Mercado Libre item ID from URL",
    };
  }

  // MeLi's buy URL pattern — opens the checkout flow directly
  try {
    const parsed = new URL(productUrl);
    const origin = parsed.origin;
    const checkoutUrl =
      quantity > 1
        ? `${origin}/checkout/buy?item_id=${itemId}&quantity=${quantity}`
        : `${origin}/checkout/buy?item_id=${itemId}`;

    return {
      success: true,
      checkoutUrl,
      method: "mercadolibre_cart",
      metadata: { itemId, quantity },
    };
  } catch {
    return {
      success: false,
      reason: "url_build_failed",
      message: "Failed to build Mercado Libre checkout URL",
    };
  }
}

/**
 * Extract MeLi item ID from a permalink URL.
 * Examples:
 *   https://www.mercadolibre.com.ar/zapatillas-adidas.../p/MLA12345678
 *   https://articulo.mercadolibre.com.ar/MLA-1234567890-title_JM
 */
function extractItemId(url: string): string | null {
  // Pattern 1: /p/MLA12345678
  const catalogMatch = url.match(/\/p\/(ML[A-Z]\d+)/);
  if (catalogMatch) return catalogMatch[1];

  // Pattern 2: /MLA-1234567890-
  const itemMatch = url.match(/(ML[A-Z])-?(\d+)/);
  if (itemMatch) return `${itemMatch[1]}${itemMatch[2]}`;

  return null;
}
