import { queryData } from "./client";
import { searchViaSerpAPI } from "@/lib/search/serpapi";
import { withRetry } from "@/lib/utils/retry";
import { isRetryableError } from "@/lib/utils/http-error";
import type { Product } from "@/lib/ai/types";

// Simple in-memory TTL cache (30-minute expiry — search results are stable enough)
const CACHE_TTL_MS = 30 * 60 * 1000;
const scrapeCache = new Map<string, { data: Product[]; timestamp: number }>();

function getCached(key: string): Product[] | null {
  const entry = scrapeCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    scrapeCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: Product[]): void {
  scrapeCache.set(key, { data, timestamp: Date.now() });
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
  const needsStealth =
    opts?.stealth ??
    (url.includes("amazon") ||
      url.includes("google") ||
      url.includes("mercadoli") ||
      url.includes("mercadolivre"));

  const { data } = await withRetry(
    () =>
      queryData<{ products: AgentQLProduct[] }>({
        url,
        query: PRODUCT_LIST_QUERY,
        waitFor: needsStealth ? 3 : 0,
        browserProfile: needsStealth ? "stealth" : "light",
        scrollToBottom: needsStealth,
        mode: "fast",
      }),
    {
      maxRetries: 2,
      backoffMs: 1000,
      shouldRetry: isRetryableError,
      onRetry: (error, attempt) => {
        console.warn(
          `[AgentQL] scrapeProductList retry ${attempt}/2:`,
          error instanceof Error ? error.message : error
        );
      },
    }
  );

  if (!data.products || data.products.length === 0) {
    return [];
  }

  return data.products.map((item, idx) =>
    normalizeAgentQLProduct(item, url, idx)
  );
}

/**
 * Extract detailed product info from a single product page.
 */
export async function scrapeProductDetail(
  url: string
): Promise<
  Product & {
    description?: string;
    specifications?: { label: string; value: string }[];
  }
> {
  const isGoogle = url.includes("google");
  const needsStealth =
    isGoogle ||
    url.includes("amazon") ||
    url.includes("mercadoli") ||
    url.includes("mercadolivre");

  const { data } = await withRetry(
    () =>
      queryData<{ product: AgentQLProductDetail }>({
        url,
        query: PRODUCT_DETAIL_QUERY,
        waitFor: needsStealth ? 5 : 0,
        browserProfile: needsStealth ? "stealth" : "light",
        mode: isGoogle ? "fast" : "standard",
        timeout: 25_000,
      }),
    {
      maxRetries: 2,
      backoffMs: 1000,
      shouldRetry: isRetryableError,
      onRetry: (error, attempt) => {
        console.warn(
          `[AgentQL] scrapeProductDetail retry ${attempt}/2:`,
          error instanceof Error ? error.message : error
        );
      },
    }
  );

  const p = data.product;
  return {
    id: `agentql-${Date.now()}`,
    source: inferSource(url),
    title: p.name,
    description: p.description,
    brand: p.brand,
    category: p.category,
    imageUrl: p.image_url ?? p.images?.[0],
    productUrl: url,
    currency: p.currency ?? inferCurrency(url),
    currentPrice: p.price,
    originalPrice: p.original_price,
    rating: p.rating,
    reviewCount: p.review_count,
    availability: p.availability ?? "unknown",
    specifications: p.specifications,
  };
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
): Promise<Product[]> {
  const cacheKey = `shopping:${country}:${query.toLowerCase().trim()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  let results: Product[];

  if (process.env.SERPAPI_API_KEY) {
    try {
      results = await withRetry(() => searchViaSerpAPI(query, country), {
        maxRetries: 3,
        shouldRetry: isRetryableError,
        onRetry: (error, attempt) => {
          console.warn(
            `[SerpAPI] Retry ${attempt}/3 after error:`,
            error instanceof Error ? error.message : error
          );
        },
      });
    } catch (error) {
      console.warn(
        "[SerpAPI] All retries exhausted, falling back to AgentQL:",
        error instanceof Error ? error.message : error
      );
      results = await searchViaAgentQL(query, country);
    }
  } else {
    results = await searchViaAgentQL(query, country);
  }

  setCache(cacheKey, results);
  return results;
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
    return item.retailer_url;
  }

  if (item.product_url && !isGoogleUrl(item.product_url)) {
    return item.product_url;
  }

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
