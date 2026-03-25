import type { Product } from "@/lib/ai/types";
import { HttpError } from "@/lib/utils/http-error";

const SERPAPI_BASE_URL = "https://serpapi.com/search";
const TIMEOUT_MS = 12_000;

// Warm the DNS + TLS connection on module load so the first real request
// doesn't pay cold-start cost (~2-5s DNS/TLS on fresh Node.js process).
// Uses HEAD to avoid consuming API quota.
const _warmup = fetch(SERPAPI_BASE_URL, {
  method: "HEAD",
  signal: AbortSignal.timeout(3_000),
}).catch(() => { /* swallow — best-effort warmup */ });

interface SerpAPIShoppingResult {
  title: string;
  price?: string;
  extracted_price?: number;
  old_price?: string;
  extracted_old_price?: number;
  rating?: number;
  reviews?: number;
  thumbnail?: string;
  serpapi_thumbnail?: string;
  link?: string;
  source?: string;
  product_link?: string;
  brand?: string;
}

interface SerpAPIResponse {
  shopping_results?: SerpAPIShoppingResult[];
  error?: string;
}

interface SerpAPIOrganicResult {
  title: string;
  link: string;
  snippet?: string;
  displayed_link?: string;
}

interface SerpAPIOrganicResponse {
  organic_results?: SerpAPIOrganicResult[];
  error?: string;
}

const COUNTRY_TO_GL: Record<string, string> = {
  AR: "ar",
  BR: "br",
  MX: "mx",
  CL: "cl",
  CO: "co",
  US: "us",
};

const COUNTRY_TO_CURRENCY: Record<string, string> = {
  AR: "ARS",
  BR: "BRL",
  MX: "MXN",
  CL: "CLP",
  CO: "COP",
  US: "USD",
};

/**
 * Search Google Shopping via SerpAPI's REST API.
 * Returns structured product results in ~500-1500ms (vs 3-10s with headless scraping).
 */
export async function searchViaSerpAPI(
  query: string,
  country: string = "US"
): Promise<Product[]> {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) {
    throw new Error("SERPAPI_API_KEY is not set in environment variables");
  }

  const gl = COUNTRY_TO_GL[country] ?? "us";
  const currency = COUNTRY_TO_CURRENCY[country] ?? "USD";

  const params = new URLSearchParams({
    engine: "google_shopping",
    q: query,
    api_key: apiKey,
    gl,
    num: "20",
  });

  console.log(`[SerpAPI] searchViaSerpAPI START query="${query}" gl=${gl} currency=${currency}`);
  const t0 = Date.now();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${SERPAPI_BASE_URL}?${params}`, {
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[SerpAPI] FAILED status=${response.status} elapsed=${Date.now() - t0}ms body=${errorText.slice(0, 200)}`);
      throw new HttpError(
        `SerpAPI error: ${response.status} ${response.statusText} — ${errorText}`,
        response.status
      );
    }

    const data: SerpAPIResponse = await response.json();

    if (data.error) {
      console.error(`[SerpAPI] API error: ${data.error} elapsed=${Date.now() - t0}ms`);
      throw new Error(`SerpAPI error: ${data.error}`);
    }

    if (!data.shopping_results || data.shopping_results.length === 0) {
      console.log(`[SerpAPI] EMPTY results query="${query}" elapsed=${Date.now() - t0}ms`);
      return [];
    }

    const items = data.shopping_results;

    const results = items.map((item, idx) =>
      normalizeSerpResult(item, currency, idx)
    );

    // Pass 1: Batch-resolve Google redirect URLs via HEAD requests
    const afterHead = await resolveRetailerUrls(results);

    // Pass 2: For remaining unresolved products, try organic web search
    const resolved = await resolveViaOrganicSearch(afterHead);

    // Sort by URL reliability: direct first, then redirect, then google-only
    const reliabilityOrder = { direct: 0, redirect: 1, google: 2 };
    resolved.sort((a, b) =>
      (reliabilityOrder[a.urlReliability ?? "google"]) -
      (reliabilityOrder[b.urlReliability ?? "google"])
    );

    const directCount = resolved.filter(r => r.urlReliability === "direct").length;
    const redirectCount = resolved.filter(r => r.urlReliability === "redirect").length;
    console.log(`[SerpAPI] OK query="${query}" results=${resolved.length} direct=${directCount} redirect=${redirectCount} googleOnly=${resolved.length - directCount - redirectCount} elapsed=${Date.now() - t0}ms`);

    return resolved;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      console.error(`[SerpAPI] TIMEOUT query="${query}" after ${TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

const REDIRECT_RESOLVE_TIMEOUT_MS = 3_000;
const REDIRECT_CONCURRENCY = 10;

/**
 * Batch-resolve Google redirect URLs to actual retailer URLs.
 * Follows redirects via HEAD requests with bounded concurrency for products
 * that don't already have a direct retailer URL.
 */
async function resolveRetailerUrls(products: Product[]): Promise<Product[]> {
  const needsResolution = products.filter(
    (p) => !p.retailerUrl && p.productUrl && isGoogleUrl(p.productUrl)
  );

  if (needsResolution.length === 0) return products;

  console.log(`[SerpAPI] Resolving ${needsResolution.length}/${products.length} retailer URLs via HEAD redirects`);
  const t0 = Date.now();

  // Resolve Google redirect URLs with bounded concurrency
  const resolutions = await promiseAllSettledConcurrent(
    needsResolution.map((p) => async () => {
      // Try the `link` field first (often a Google redirect that resolves to the retailer)
      const urlToResolve = p.productUrl;
      if (!urlToResolve) return { id: p.id, retailerUrl: undefined };

      try {
        const res = await fetch(urlToResolve, {
          method: "HEAD",
          redirect: "follow",
          signal: AbortSignal.timeout(REDIRECT_RESOLVE_TIMEOUT_MS),
        });
        const finalUrl = res.url || urlToResolve;
        if (!isGoogleUrl(finalUrl)) {
          return { id: p.id, retailerUrl: finalUrl };
        }
      } catch {
        // Timeout or network error — skip
      }
      return { id: p.id, retailerUrl: undefined };
    })
  );

  // Build a map of resolved URLs
  const resolvedMap = new Map<string, string>();
  for (const result of resolutions) {
    if (result.status === "fulfilled" && result.value.retailerUrl) {
      resolvedMap.set(result.value.id, result.value.retailerUrl);
    }
  }

  const resolvedCount = resolvedMap.size;
  console.log(
    `[SerpAPI] Resolved ${resolvedCount}/${needsResolution.length} redirect URLs elapsed=${Date.now() - t0}ms`
  );

  // Merge resolved URLs back into products
  return products.map((p) => {
    if (p.retailerUrl) return p;
    const resolved = resolvedMap.get(p.id);
    if (resolved) return { ...p, retailerUrl: resolved, urlReliability: "redirect" as const };
    return p;
  });
}

/**
 * Second-pass resolution: for products still without retailer URLs,
 * use SerpAPI organic web search to find direct merchant product pages.
 * Searches for "product title site:source" to find the actual retailer page.
 */
async function resolveViaOrganicSearch(products: Product[]): Promise<Product[]> {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) return products;

  const needsResolution = products.filter(
    (p) => p.urlReliability === "google" && p.source === "google-shopping"
  );

  if (needsResolution.length === 0) return products;

  // Only resolve up to 5 products to avoid burning API quota
  const toResolve = needsResolution.slice(0, 5);
  console.log(`[SerpAPI] Organic fallback: resolving ${toResolve.length} products without retailer URLs`);
  const t0 = Date.now();

  const resolutions = await Promise.allSettled(
    toResolve.map(async (p) => {
      const searchQuery = `${p.title} buy`;
      const params = new URLSearchParams({
        engine: "google",
        q: searchQuery,
        api_key: apiKey,
        num: "3",
      });

      try {
        const res = await fetch(`${SERPAPI_BASE_URL}?${params}`, {
          signal: AbortSignal.timeout(5_000),
        });
        if (!res.ok) return { id: p.id, retailerUrl: undefined };

        const data: SerpAPIOrganicResponse = await res.json();
        const organicResults = data.organic_results ?? [];

        // Find the first result that's not Google and looks like a product page
        for (const result of organicResults) {
          if (!isGoogleUrl(result.link) && !isAggregatorUrl(result.link)) {
            return { id: p.id, retailerUrl: result.link };
          }
        }
      } catch {
        // Timeout or error — skip
      }
      return { id: p.id, retailerUrl: undefined };
    })
  );

  const resolvedMap = new Map<string, string>();
  for (const result of resolutions) {
    if (result.status === "fulfilled" && result.value.retailerUrl) {
      resolvedMap.set(result.value.id, result.value.retailerUrl);
    }
  }

  console.log(`[SerpAPI] Organic fallback: resolved ${resolvedMap.size}/${toResolve.length} elapsed=${Date.now() - t0}ms`);

  return products.map((p) => {
    const resolved = resolvedMap.get(p.id);
    if (resolved) return { ...p, retailerUrl: resolved, urlReliability: "redirect" as const };
    return p;
  });
}

/** Check if a URL is a shopping aggregator (not a direct retailer) */
function isAggregatorUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return /google\.|bing\.|yahoo\.|shopping\.|pricegrabber|shopzilla|bizrate|pricewatch/.test(hostname);
  } catch {
    return false;
  }
}

/** Check if a URL points to Google rather than a direct retailer */
function isGoogleUrl(url: string | undefined): boolean {
  if (!url) return true;
  try {
    return new URL(url).hostname.includes("google.");
  } catch {
    return true;
  }
}

function normalizeSerpResult(
  item: SerpAPIShoppingResult,
  fallbackCurrency: string,
  index: number
): Product {
  const directLink = item.link && !isGoogleUrl(item.link) ? item.link : undefined;
  // Try extracted_price first, then parse the price string (e.g. "$12.99")
  const price = item.extracted_price ?? parsePriceString(item.price);
  return {
    id: `serp-${Date.now()}-${index}`,
    externalId: extractProductId(item.product_link),
    source: "google-shopping",
    title: item.title,
    brand: item.brand,
    currency: fallbackCurrency,
    currentPrice: price ?? 0,
    originalPrice: item.extracted_old_price ?? parsePriceString(item.old_price),
    imageUrl: item.serpapi_thumbnail ?? item.thumbnail,
    productUrl: item.product_link ?? item.link,
    retailerUrl: directLink,
    urlReliability: directLink ? "direct" : "google",
    rating: item.rating,
    reviewCount: item.reviews,
    availability: "unknown",
  };
}

/** Parse a price string like "$12.99", "US$4.50", "12,99" into a number */
function parsePriceString(priceStr: string | undefined): number | undefined {
  if (!priceStr) return undefined;
  // Remove currency symbols/codes, keep digits, commas, dots
  const cleaned = priceStr.replace(/[^0-9.,]/g, "");
  if (!cleaned) return undefined;
  // Handle comma as decimal separator (e.g. "12,99") vs thousand separator (e.g. "1,299.00")
  let normalized: string;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    // Has both: "1,299.00" → remove commas
    normalized = cleaned.replace(/,/g, "");
  } else if (cleaned.includes(",") && cleaned.indexOf(",") > cleaned.length - 4) {
    // Comma is decimal separator: "12,99" → "12.99"
    normalized = cleaned.replace(",", ".");
  } else {
    // Comma as thousand separator: "1,299" → "1299"
    normalized = cleaned.replace(/,/g, "");
  }
  const val = parseFloat(normalized);
  return isNaN(val) || val <= 0 ? undefined : val;
}

/**
 * Extract the product catalog ID from a SerpAPI product_link URL.
 * The product_link contains a `prds` param with `catalogid:<id>`.
 */
function extractProductId(productLink: string | undefined): string | undefined {
  if (!productLink) return undefined;
  try {
    const parsed = new URL(productLink);
    const prds = parsed.searchParams.get("prds");
    if (!prds) return undefined;
    const match = prds.match(/catalogid:(\d+)/);
    return match?.[1] ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Like Promise.allSettled but limits concurrency to avoid overwhelming the
 * network with too many parallel requests (e.g. 40 simultaneous HEAD fetches).
 */
async function promiseAllSettledConcurrent<T>(
  factories: (() => Promise<T>)[],
  concurrency: number = REDIRECT_CONCURRENCY
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(factories.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < factories.length) {
      const i = nextIndex++;
      try {
        results[i] = { status: "fulfilled", value: await factories[i]() };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, factories.length) }, () => worker())
  );
  return results;
}
