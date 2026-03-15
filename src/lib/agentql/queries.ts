import { queryData } from "./client";
import { runAutomation } from "@/lib/tinyfish/client";
import { searchViaSerpAPI } from "@/lib/search/serpapi";
import { withRetry } from "@/lib/utils/retry";
import { isRetryableError } from "@/lib/utils/http-error";
import { getBreaker } from "@/lib/utils/circuit-breaker";
import type { Product } from "@/lib/ai/types";

// Fresh cache: 30 minutes
const CACHE_TTL_MS = 30 * 60 * 1000;
// Stale cache: served as fallback when service is down (up to 2 hours)
const CACHE_STALE_TTL_MS = 2 * 60 * 60 * 1000;

// Tiered timeouts: stealth sites need extra time for waitFor + browser launch overhead
const LIGHT_TIMEOUT_MS = 15_000;
const STEALTH_TIMEOUT_MS = 25_000; // 3s wait + 5s stealth launch + 12s nav/query + 5s buffer

/** Check if a URL requires stealth browser mode (anti-bot protected sites) */
function isStealthSite(url: string): boolean {
  return (
    url.includes("google") ||
    url.includes("amazon") ||
    url.includes("mercadoli") ||
    url.includes("mercadolivre")
  );
}
const scrapeCache = new Map<string, { data: Product[]; timestamp: number }>();

type DetailResult = Product & {
  description?: string;
  specifications?: { label: string; value: string }[];
  retailerUrl?: string;
};
const detailCache = new Map<string, { data: DetailResult; timestamp: number }>();

function getCached(key: string): { data: Product[]; stale: boolean } | null {
  const entry = scrapeCache.get(key);
  if (!entry) {
    console.log(`[Cache] MISS list key=${key}`);
    return null;
  }
  const age = Date.now() - entry.timestamp;
  if (age > CACHE_STALE_TTL_MS) {
    console.log(`[Cache] EXPIRED list key=${key} age=${Math.round(age / 1000)}s`);
    scrapeCache.delete(key);
    return null;
  }
  const stale = age > CACHE_TTL_MS;
  console.log(`[Cache] HIT list key=${key} stale=${stale} age=${Math.round(age / 1000)}s items=${entry.data.length}`);
  return { data: entry.data, stale };
}

function setCache(key: string, data: Product[]): void {
  console.log(`[Cache] SET list key=${key} items=${data.length}`);
  scrapeCache.set(key, { data, timestamp: Date.now() });
}

function getCachedDetail(key: string): { data: DetailResult; stale: boolean } | null {
  const entry = detailCache.get(key);
  if (!entry) {
    console.log(`[Cache] MISS detail key=${key}`);
    return null;
  }
  const age = Date.now() - entry.timestamp;
  if (age > CACHE_STALE_TTL_MS) {
    console.log(`[Cache] EXPIRED detail key=${key} age=${Math.round(age / 1000)}s`);
    detailCache.delete(key);
    return null;
  }
  const stale = age > CACHE_TTL_MS;
  console.log(`[Cache] HIT detail key=${key} stale=${stale} age=${Math.round(age / 1000)}s title="${entry.data.title}"`);
  return { data: entry.data, stale };
}

function setCachedDetail(key: string, data: DetailResult): void {
  console.log(`[Cache] SET detail key=${key} title="${data.title}" retailerUrl=${data.retailerUrl ?? "none"}`);
  detailCache.set(key, { data, timestamp: Date.now() });
}

/** AgentQL semantic query for extracting product listings from any e-commerce page */
const PRODUCT_LIST_QUERY = `
{
  products[] {
    name
    price(integer)
    original_price(integer)
    currency
    rating
    review_count(integer)
    image_url
    product_url
    retailer_url
    retailer_name
    availability
    brand
  }
}
`;

/** AgentQL semantic query for extracting a single product's details */
const PRODUCT_DETAIL_QUERY = `
{
  product {
    name
    price(integer)
    original_price(integer)
    currency
    rating
    review_count(integer)
    description
    brand
    category
    images[]
    availability
    specifications[] {
      label
      value
    }
  }
}
`;

interface AgentQLProduct {
  name: string;
  price: number;
  original_price?: number;
  currency?: string;
  rating?: number;
  review_count?: number;
  image_url?: string;
  product_url?: string;
  retailer_url?: string;
  retailer_name?: string;
  availability?: string;
  brand?: string;
}

interface AgentQLProductDetail extends AgentQLProduct {
  description?: string;
  category?: string;
  images?: string[];
  specifications?: { label: string; value: string }[];
}

/**
 * Extract product listings from any e-commerce search results page.
 * Uses stealth mode + wait for JS-heavy sites.
 */
export async function scrapeProductList(
  url: string,
  opts?: { stealth?: boolean }
): Promise<Product[]> {
  const needsStealth = opts?.stealth ?? isStealthSite(url);
  console.log(`[Scrape] scrapeProductList START url=${url} stealth=${needsStealth}`);
  const t0 = Date.now();

  const { data } = await withRetry(
    () =>
      queryData<{ products: AgentQLProduct[] }>({
        url,
        query: PRODUCT_LIST_QUERY,
        waitFor: needsStealth ? 3 : 0,
        browserProfile: needsStealth ? "stealth" : "light",
        scrollToBottom: needsStealth,
        mode: "fast",
        timeout: needsStealth ? STEALTH_TIMEOUT_MS : LIGHT_TIMEOUT_MS,
      }),
    {
      maxRetries: 2,
      backoffMs: 1000,
      shouldRetry: isRetryableError,
      onRetry: (error, attempt) => {
        console.warn(
          `[Scrape] scrapeProductList retry ${attempt}/2 for ${url} (stealth=${needsStealth}):`,
          error instanceof Error ? error.message : error
        );
      },
    }
  );

  if (!data.products || data.products.length === 0) {
    console.log(`[Scrape] scrapeProductList EMPTY url=${url} elapsed=${Date.now() - t0}ms`);
    return [];
  }

  const products = data.products.map((item, idx) =>
    normalizeAgentQLProduct(item, url, idx)
  );
  console.log(`[Scrape] scrapeProductList OK url=${url} count=${products.length} elapsed=${Date.now() - t0}ms`);
  return products;
}

/** Check if a URL is a Google Shopping product page */
function isGoogleShoppingUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes("google.") &&
      (parsed.pathname.includes("/shopping/product/") ||
       parsed.pathname.includes("/product/") ||
       parsed.searchParams.has("tbm"));
  } catch {
    return false;
  }
}

/**
 * Use TinyFish to click "Visit store" on a Google Shopping page and capture the retailer URL.
 * Returns undefined on failure (non-blocking).
 */
async function resolveRetailerFromGoogleShopping(url: string): Promise<string | undefined> {
  console.log(`[RetailerResolve] START TinyFish "Visit store" click for url=${url}`);
  const t0 = Date.now();
  try {
    const result = await runAutomation(
      {
        url,
        goal: `Find and click the "Visit store", "Visit site", "Buy", or merchant/retailer link on this Google Shopping product page. After clicking, report the final URL you land on as JSON: { "retailerUrl": "https://..." }. Do NOT proceed with any purchase. Just report the retailer URL.`,
        browser_profile: "stealth",
      },
      { timeoutMs: 30_000, maxSteps: 10, loopThreshold: 3 }
    );

    console.log(`[RetailerResolve] TinyFish result: success=${result.success} data=${JSON.stringify(result.data)} steps=${result.statusMessages.length} elapsed=${Date.now() - t0}ms`);

    if (result.success && result.data?.retailerUrl) {
      const retailerUrl = String(result.data.retailerUrl);
      try {
        if (!new URL(retailerUrl).hostname.includes("google.")) {
          console.log(`[RetailerResolve] RESOLVED retailerUrl=${retailerUrl} elapsed=${Date.now() - t0}ms`);
          return retailerUrl;
        }
        console.warn(`[RetailerResolve] REJECTED — still a Google URL: ${retailerUrl}`);
      } catch {
        console.warn(`[RetailerResolve] REJECTED — invalid URL: ${retailerUrl}`);
      }
    } else {
      console.warn(`[RetailerResolve] FAILED — no retailerUrl in result. error=${result.error ?? "none"} abortReason=${result.abortReason ?? "none"}`);
    }
    return undefined;
  } catch (err) {
    console.error(`[RetailerResolve] ERROR elapsed=${Date.now() - t0}ms:`, err instanceof Error ? err.message : err);
    return undefined;
  }
}

/**
 * Extract detailed product info from a single product page.
 * For Google Shopping pages, uses TinyFish to click "Visit store" and resolve the retailer URL.
 */
export async function scrapeProductDetail(
  url: string
): Promise<DetailResult & { _stale?: boolean }> {
  console.log(`[Scrape] scrapeProductDetail START url=${url}`);
  const t0 = Date.now();

  const cached = getCachedDetail(url);
  if (cached && !cached.stale) {
    console.log(`[Scrape] scrapeProductDetail CACHE_HIT url=${url}`);
    return cached.data;
  }

  const needsStealth = isStealthSite(url);
  const isGoogleShopping = isGoogleShoppingUrl(url);
  console.log(`[Scrape] scrapeProductDetail stealth=${needsStealth} googleShopping=${isGoogleShopping}`);

  try {
    // Run product detail scrape + retailer URL resolution in parallel for Google Shopping
    const [{ data }, retailerUrl] = await Promise.all([
      getBreaker("agentql").execute(() =>
        withRetry(
          () =>
            queryData<{ product: AgentQLProductDetail }>({
              url,
              query: PRODUCT_DETAIL_QUERY,
              waitFor: needsStealth ? 3 : 0,
              browserProfile: needsStealth ? "stealth" : "light",
              mode: "fast",
              timeout: needsStealth ? STEALTH_TIMEOUT_MS : LIGHT_TIMEOUT_MS,
            }),
          {
            maxRetries: 2,
            backoffMs: 1000,
            shouldRetry: isRetryableError,
            onRetry: (error, attempt) => {
              console.warn(
                `[AgentQL] scrapeProductDetail retry ${attempt}/2 for ${url} (stealth=${needsStealth}):`,
                error instanceof Error ? error.message : error
              );
            },
          }
        )
      ),
      isGoogleShopping
        ? resolveRetailerFromGoogleShopping(url)
        : Promise.resolve(undefined),
    ]);

    const p = data.product;
    console.log(`[Scrape] scrapeProductDetail AgentQL data: name="${p.name}" price=${p.price} brand=${p.brand ?? "none"} specs=${p.specifications?.length ?? 0}`);
    console.log(`[Scrape] scrapeProductDetail retailerUrl=${retailerUrl ?? "NOT_RESOLVED"} (googleShopping=${isGoogleShopping}) elapsed=${Date.now() - t0}ms`);

    const result: DetailResult = {
      id: `agentql-${Date.now()}`,
      source: inferSource(url),
      title: p.name,
      description: p.description,
      brand: p.brand,
      category: p.category,
      imageUrl: p.image_url ?? p.images?.[0],
      productUrl: url,
      retailerUrl,
      currency: p.currency ?? inferCurrency(url),
      currentPrice: p.price,
      originalPrice: p.original_price,
      rating: p.rating,
      reviewCount: p.review_count,
      availability: p.availability ?? "unknown",
      specifications: p.specifications,
    };

    setCachedDetail(url, result);
    return result;
  } catch (err) {
    console.error(`[Scrape] scrapeProductDetail FAILED url=${url} elapsed=${Date.now() - t0}ms:`, err instanceof Error ? err.message : err);
    if (cached?.stale) {
      console.log(`[Scrape] scrapeProductDetail STALE_FALLBACK url=${url}`);
      return { ...cached.data, _stale: true };
    }
    throw err;
  }
}

const COUNTRY_TO_TLD: Record<string, string> = {
  AR: "com.ar",
  BR: "com.br",
  MX: "com.mx",
  CL: "cl",
  CO: "com.co",
  US: "com",
};

/** AgentQL-based Google Shopping scrape (headless browser fallback). */
async function searchViaAgentQL(
  query: string,
  country: string
): Promise<Product[]> {
  const tld = COUNTRY_TO_TLD[country] ?? COUNTRY_TO_TLD.US;
  const searchUrl = `https://www.google.${tld}/search?q=${encodeURIComponent(query)}&tbm=shop`;
  console.log(`[Search] searchViaAgentQL query="${query}" country=${country} url=${searchUrl}`);
  return scrapeProductList(searchUrl, { stealth: true });
}

/**
 * Search Google Shopping via SerpAPI (structured REST API, ~500-1500ms).
 * Retries transient SerpAPI failures with exponential backoff.
 * Falls back to AgentQL scraping if SerpAPI key is missing or all retries are exhausted.
 */
export async function scrapeGoogleShoppingSearch(
  query: string,
  country: string = "US"
): Promise<Product[] & { _stale?: boolean }> {
  console.log(`[Search] scrapeGoogleShoppingSearch START query="${query}" country=${country}`);
  const t0 = Date.now();

  const cacheKey = `shopping:${country}:${query.toLowerCase().trim()}`;
  const cached = getCached(cacheKey);
  if (cached && !cached.stale) {
    console.log(`[Search] scrapeGoogleShoppingSearch CACHE_HIT query="${query}" count=${cached.data.length}`);
    return cached.data;
  }

  try {
    let results: Product[];

    if (process.env.SERPAPI_API_KEY) {
      console.log(`[Search] Using SerpAPI for query="${query}"`);
      try {
        results = await getBreaker("serpapi").execute(() =>
          withRetry(() => searchViaSerpAPI(query, country), {
            maxRetries: 3,
            shouldRetry: isRetryableError,
            onRetry: (error, attempt) => {
              console.warn(
                `[SerpAPI] Retry ${attempt}/3 after error:`,
                error instanceof Error ? error.message : error
              );
            },
          })
        );
        console.log(`[Search] SerpAPI OK query="${query}" count=${results.length} elapsed=${Date.now() - t0}ms`);
      } catch (error) {
        console.warn(
          `[Search] SerpAPI FAILED, falling back to AgentQL. elapsed=${Date.now() - t0}ms:`,
          error instanceof Error ? error.message : error
        );
        results = await getBreaker("agentql").execute(() =>
          searchViaAgentQL(query, country)
        );
        console.log(`[Search] AgentQL fallback OK query="${query}" count=${results.length} elapsed=${Date.now() - t0}ms`);
      }
    } else {
      console.log(`[Search] No SERPAPI_API_KEY, using AgentQL directly for query="${query}"`);
      results = await getBreaker("agentql").execute(() =>
        searchViaAgentQL(query, country)
      );
      console.log(`[Search] AgentQL OK query="${query}" count=${results.length} elapsed=${Date.now() - t0}ms`);
    }

    // Log retailer URL availability for debugging
    const withRetailerUrl = results.filter(r => r.retailerUrl).length;
    console.log(`[Search] Results: total=${results.length} withRetailerUrl=${withRetailerUrl} withoutRetailerUrl=${results.length - withRetailerUrl}`);

    setCache(cacheKey, results);
    return results;
  } catch (err) {
    console.error(`[Search] scrapeGoogleShoppingSearch FAILED query="${query}" elapsed=${Date.now() - t0}ms:`, err instanceof Error ? err.message : err);
    if (cached?.stale) {
      console.log(`[Search] STALE_FALLBACK query="${query}" count=${cached.data.length}`);
      const staleResults = cached.data as Product[] & { _stale?: boolean };
      staleResults._stale = true;
      return staleResults;
    }
    throw err;
  }
}

/**
 * Resolve the actual retailer URL from AgentQL data.
 * Prefers retailer_url, rejects Google redirect URLs, falls back to undefined.
 */
function resolveRetailerUrl(item: AgentQLProduct): string | undefined {
  const isGoogleUrl = (url: string) => {
    try {
      const hostname = new URL(url).hostname;
      return hostname.includes("google.");
    } catch {
      return true; // Reject malformed URLs
    }
  };

  if (item.retailer_url && !isGoogleUrl(item.retailer_url)) {
    console.log(`[RetailerUrl] Resolved from retailer_url: ${item.retailer_url} for "${item.name}"`);
    return item.retailer_url;
  }

  if (item.product_url && !isGoogleUrl(item.product_url)) {
    console.log(`[RetailerUrl] Resolved from product_url: ${item.product_url} for "${item.name}"`);
    return item.product_url;
  }

  console.log(`[RetailerUrl] UNRESOLVED for "${item.name}" — retailer_url=${item.retailer_url ?? "null"} product_url=${item.product_url ?? "null"}`);
  return undefined;
}

/** Normalize an AgentQL product to our common schema */
function normalizeAgentQLProduct(
  item: AgentQLProduct,
  sourceUrl: string,
  index: number
): Product {
  return {
    id: `agentql-${Date.now()}-${index}`,
    source: inferSource(sourceUrl),
    title: item.name,
    brand: item.brand,
    currency: item.currency ?? inferCurrency(sourceUrl),
    currentPrice: item.price,
    originalPrice: item.original_price,
    imageUrl: item.image_url,
    productUrl: item.product_url ?? sourceUrl,
    retailerUrl: resolveRetailerUrl(item),
    rating: item.rating,
    reviewCount: item.review_count,
    availability: item.availability ?? "unknown",
  };
}

function inferSource(url: string): string {
  if (url.includes("google")) return "google-shopping";
  if (url.includes("mercadoli")) return "mercadolibre";
  if (url.includes("amazon")) return "amazon";
  if (url.includes("ebay")) return "ebay";
  return new URL(url).hostname;
}

function inferCurrency(url: string): string {
  if (url.includes(".com.ar")) return "ARS";
  if (url.includes(".com.br")) return "BRL";
  if (url.includes(".com.mx")) return "MXN";
  if (url.includes(".cl")) return "CLP";
  if (url.includes(".com.co")) return "COP";
  return "USD";
}
