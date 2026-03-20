import { scrapeProductList } from "@/lib/agentql/queries";
import type { Product } from "@/lib/ai/types";

const DOMAIN_PROBE_TIMEOUT_MS = 3_000;
const SHOPIFY_SUGGEST_TIMEOUT_MS = 5_000;

// ---------------------------------------------------------------------------
// Domain Resolution
// ---------------------------------------------------------------------------

interface ResolvedStore {
  url: string;
  isShopify: boolean;
}

/**
 * Resolve a store name to its domain URL.
 * Phase 1: Fast parallel domain probing (.com, .myshopify.com variants).
 * Phase 2: SerpAPI web search fallback if Phase 1 finds nothing.
 */
export async function resolveStoreDomain(
  storeName: string
): Promise<ResolvedStore | null> {
  console.log(`[StoreSearch] resolveStoreDomain START storeName="${storeName}"`);
  const t0 = Date.now();

  // Normalize: lowercase, strip special chars
  const cleaned = storeName.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  const nospaces = cleaned.replace(/\s+/g, "");
  const hyphenated = cleaned.replace(/\s+/g, "-");

  // Phase 1 — Fast domain probing (parallel, 3s timeout)
  const candidates = [
    { domain: `${nospaces}.com`, isMyShopify: false },
    { domain: `${hyphenated}.com`, isMyShopify: false },
    { domain: `${nospaces}.myshopify.com`, isMyShopify: true },
    { domain: `${hyphenated}.myshopify.com`, isMyShopify: true },
  ];

  const probeResults = await Promise.allSettled(
    candidates.map(async ({ domain, isMyShopify }) => {
      const url = `https://${domain}`;
      const res = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
        signal: AbortSignal.timeout(DOMAIN_PROBE_TIMEOUT_MS),
      });
      if (res.ok || (res.status >= 300 && res.status < 400)) {
        let isShopify = isMyShopify;
        if (!isMyShopify) {
          // Check Shopify headers on .com domains
          isShopify =
            res.headers.has("x-shopify-stage") ||
            res.headers.has("x-shopid");
        }
        return { url: new URL(res.url || url).origin, isShopify };
      }
      throw new Error(`${res.status}`);
    })
  );

  for (const result of probeResults) {
    if (result.status === "fulfilled") {
      console.log(
        `[StoreSearch] resolveStoreDomain PROBE_HIT url=${result.value.url} isShopify=${result.value.isShopify} elapsed=${Date.now() - t0}ms`
      );
      return result.value;
    }
  }

  // Phase 2 — SerpAPI web search fallback
  console.log(`[StoreSearch] resolveStoreDomain Phase 1 failed, trying SerpAPI web search`);
  const serpResult = await searchWebForStore(storeName);
  if (serpResult) {
    console.log(
      `[StoreSearch] resolveStoreDomain SERP_HIT url=${serpResult.url} isShopify=${serpResult.isShopify} elapsed=${Date.now() - t0}ms`
    );
    return serpResult;
  }

  console.log(`[StoreSearch] resolveStoreDomain FAILED storeName="${storeName}" elapsed=${Date.now() - t0}ms`);
  return null;
}

/**
 * SerpAPI web search fallback for domain resolution.
 * Searches for the store's official site and probes for Shopify headers.
 */
async function searchWebForStore(
  storeName: string
): Promise<ResolvedStore | null> {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) return null;

  try {
    const params = new URLSearchParams({
      engine: "google",
      q: `"${storeName}" official store site`,
      api_key: apiKey,
      num: "5",
    });

    const res = await fetch(`https://serpapi.com/search?${params}`, {
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      organic_results?: Array<{ link?: string; title?: string }>;
    };

    const results = data.organic_results ?? [];

    // Find the first result that looks like a store homepage
    for (const result of results) {
      if (!result.link) continue;
      try {
        const parsed = new URL(result.link);
        // Skip known non-store domains
        if (
          parsed.hostname.includes("google.") ||
          parsed.hostname.includes("wikipedia.") ||
          parsed.hostname.includes("facebook.") ||
          parsed.hostname.includes("instagram.") ||
          parsed.hostname.includes("twitter.") ||
          parsed.hostname.includes("youtube.") ||
          parsed.hostname.includes("linkedin.") ||
          parsed.hostname.includes("reddit.")
        ) {
          continue;
        }

        const origin = parsed.origin;
        // Probe for Shopify headers
        let isShopify = parsed.hostname.endsWith(".myshopify.com");
        if (!isShopify) {
          try {
            const headRes = await fetch(origin, {
              method: "HEAD",
              redirect: "follow",
              signal: AbortSignal.timeout(DOMAIN_PROBE_TIMEOUT_MS),
            });
            isShopify =
              headRes.headers.has("x-shopify-stage") ||
              headRes.headers.has("x-shopid");
          } catch {
            // Probe failed, assume not Shopify
          }
        }

        return { url: origin, isShopify };
      } catch {
        continue;
      }
    }

    return null;
  } catch (err) {
    console.error(
      `[StoreSearch] searchWebForStore FAILED:`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Store Search
// ---------------------------------------------------------------------------

interface ShopifySuggestProduct {
  title: string;
  handle: string;
  id: number;
  price: string;
  price_min: string;
  price_max: string;
  image: string;
  url: string;
  vendor?: string;
  available: boolean;
}

/**
 * Search a store's website for products.
 * - Shopify stores: hit the fast suggest JSON API first.
 * - Any store (including Shopify fallback): scrape via AgentQL.
 */
export async function searchStore(
  storeOrigin: string,
  query: string,
  isShopify: boolean,
  limit: number = 6
): Promise<Product[]> {
  console.log(
    `[StoreSearch] searchStore START origin=${storeOrigin} query="${query}" isShopify=${isShopify} limit=${limit}`
  );
  const t0 = Date.now();
  const hostname = new URL(storeOrigin).hostname;

  // Try Shopify suggest API first
  if (isShopify) {
    try {
      const products = await shopifySuggestSearch(storeOrigin, query, limit);
      if (products.length > 0) {
        console.log(
          `[StoreSearch] searchStore SHOPIFY_SUGGEST OK count=${products.length} elapsed=${Date.now() - t0}ms`
        );
        return products;
      }
      console.log(`[StoreSearch] searchStore SHOPIFY_SUGGEST empty, falling through to AgentQL`);
    } catch (err) {
      console.warn(
        `[StoreSearch] searchStore SHOPIFY_SUGGEST failed, falling through to AgentQL:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  // AgentQL scrape — works on any e-commerce site
  const searchUrl = `${storeOrigin}/search?q=${encodeURIComponent(query)}`;
  console.log(`[StoreSearch] searchStore AgentQL scrape url=${searchUrl}`);
  const products = await scrapeProductList(searchUrl, { stealth: false });

  const normalized = products.slice(0, limit).map((p) => ({
    ...p,
    source: hostname,
    retailerUrl: p.retailerUrl ?? p.productUrl,
  }));

  console.log(
    `[StoreSearch] searchStore AGENTQL OK count=${normalized.length} elapsed=${Date.now() - t0}ms`
  );
  return normalized;
}

/**
 * Shopify Search Suggest API — fast JSON endpoint, no scraping needed.
 */
async function shopifySuggestSearch(
  storeOrigin: string,
  query: string,
  limit: number
): Promise<Product[]> {
  const url = `${storeOrigin}/search/suggest.json?q=${encodeURIComponent(query)}&resources[type]=product&resources[limit]=${limit}`;
  console.log(`[StoreSearch] shopifySuggestSearch url=${url}`);

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(SHOPIFY_SUGGEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`Shopify suggest API returned ${res.status}`);
  }

  const data = (await res.json()) as {
    resources?: {
      results?: {
        products?: ShopifySuggestProduct[];
      };
    };
  };

  const items = data.resources?.results?.products ?? [];
  const hostname = new URL(storeOrigin).hostname;

  return items.map((item, idx) => ({
    id: `shopify-suggest-${Date.now()}-${idx}`,
    source: hostname,
    title: item.title,
    brand: item.vendor,
    currency: "USD", // Shopify suggest doesn't return currency; caller can override
    currentPrice: parseFloat(item.price_min || item.price) / 100 || 0,
    imageUrl: item.image || undefined,
    productUrl: `${storeOrigin}${item.url}`,
    retailerUrl: `${storeOrigin}${item.url}`,
    availability: item.available ? "in_stock" : "out_of_stock",
  }));
}
