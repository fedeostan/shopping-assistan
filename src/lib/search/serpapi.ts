import type { Product } from "@/lib/ai/types";

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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${SERPAPI_BASE_URL}?${params}`, {
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `SerpAPI error: ${response.status} ${response.statusText} — ${errorText}`
      );
    }

    const data: SerpAPIResponse = await response.json();

    if (data.error) {
      throw new Error(`SerpAPI error: ${data.error}`);
    }

    if (!data.shopping_results || data.shopping_results.length === 0) {
      return [];
    }

    return data.shopping_results.map((item, idx) =>
      normalizeSerpResult(item, currency, idx)
    );
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeSerpResult(
  item: SerpAPIShoppingResult,
  fallbackCurrency: string,
  index: number
): Product {
  return {
    id: `serp-${Date.now()}-${index}`,
    source: "google-shopping",
    title: item.title,
    brand: item.brand,
    currency: fallbackCurrency,
    currentPrice: item.extracted_price ?? 0,
    originalPrice: item.extracted_old_price,
    imageUrl: item.serpapi_thumbnail ?? item.thumbnail,
    productUrl: item.product_link ?? item.link,
    retailerUrl: item.link,
    rating: item.rating,
    reviewCount: item.reviews,
    availability: "unknown",
  };
}
