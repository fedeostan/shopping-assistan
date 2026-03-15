import type { Product } from "@/lib/ai/types";
import { HttpError } from "@/lib/utils/http-error";

const SERPAPI_BASE_URL = "https://serpapi.com/search";
const TIMEOUT_MS = 10_000;

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

    const withRetailerUrl = results.filter(r => r.retailerUrl).length;
    console.log(`[SerpAPI] OK query="${query}" results=${results.length} withRetailerUrl=${withRetailerUrl} elapsed=${Date.now() - t0}ms`);
    console.log(`[SerpAPI] URL resolution: ${withRetailerUrl}/${results.length} products have retailer URLs (${Math.round((withRetailerUrl / results.length) * 100)}%)`);

    return results;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      console.error(`[SerpAPI] TIMEOUT query="${query}" after ${TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
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
  return {
    id: `serp-${Date.now()}-${index}`,
    externalId: extractProductId(item.product_link),
    source: "google-shopping",
    title: item.title,
    brand: item.brand,
    currency: fallbackCurrency,
    currentPrice: item.extracted_price ?? 0,
    originalPrice: item.extracted_old_price,
    imageUrl: item.serpapi_thumbnail ?? item.thumbnail,
    productUrl: item.product_link ?? item.link,
    retailerUrl: directLink,
    rating: item.rating,
    reviewCount: item.reviews,
    availability: "unknown",
  };
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
