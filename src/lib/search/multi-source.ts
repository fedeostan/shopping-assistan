import type { Product } from "@/lib/ai/types";
import { scrapeGoogleShoppingSearch, batchResolveRetailerUrls } from "@/lib/agentql/queries";
import { CircuitOpenError } from "@/lib/utils/service-error";

const SERPAPI_BASE_URL = "https://serpapi.com/search";

/**
 * Major retailers to search in parallel with Google Shopping.
 * Uses SerpAPI's Google web search with site: operator — no extra API keys.
 */
const RETAILER_SITES = [
  { name: "Amazon", hostname: "amazon.com" },
  { name: "Best Buy", hostname: "bestbuy.com" },
  { name: "Walmart", hostname: "walmart.com" },
  { name: "Target", hostname: "target.com" },
] as const;

/** SerpAPI organic search result */
interface OrganicResult {
  title: string;
  link: string;
  snippet?: string;
  thumbnail?: string;
  rich_snippet?: {
    top?: { extensions?: string[] };
    bottom?: { extensions?: string[] };
  };
}

interface OrganicResponse {
  organic_results?: OrganicResult[];
  error?: string;
}

export interface MultiSourceResult {
  products: Product[];
  sources: string[];
  errors: string[];
  stale: boolean;
  circuitOpen: boolean;
}

/**
 * Search across multiple sources in parallel:
 * 1. Google Shopping (via SerpAPI → existing pipeline)
 * 2. Direct retailer site searches (Amazon, Best Buy, Walmart, Target via SerpAPI site: operator)
 *
 * Merges, deduplicates, and sorts results by URL reliability.
 */
export async function searchMultiSource(
  query: string,
  country: string = "US"
): Promise<MultiSourceResult> {
  console.log(`[MultiSource] START query="${query}" country=${country}`);
  const t0 = Date.now();

  const errors: string[] = [];
  const sources: string[] = [];
  let stale = false;
  let circuitOpen = false;

  // Run Google Shopping + retailer site searches in parallel
  const [shoppingResult, ...siteResults] = await Promise.allSettled([
    // Source 1: Google Shopping (existing pipeline)
    scrapeGoogleShoppingSearch(query, country)
      .then((products) => {
        const isStale = (products as Product[] & { _stale?: boolean })._stale;
        if (isStale) stale = true;
        return products;
      }),

    // Sources 2-5: Direct retailer site searches
    ...RETAILER_SITES.map((retailer) =>
      searchRetailerSite(query, retailer.hostname, country)
    ),
  ]);

  // Collect Google Shopping results
  let allProducts: Product[] = [];
  if (shoppingResult.status === "fulfilled") {
    allProducts = shoppingResult.value;
    sources.push("google-shopping");
    console.log(`[MultiSource] Google Shopping: ${allProducts.length} results`);
  } else {
    const err = shoppingResult.reason;
    if (err instanceof CircuitOpenError) {
      circuitOpen = true;
      errors.push(err.userMessage);
    } else {
      errors.push(`Google Shopping: ${err instanceof Error ? err.message : "failed"}`);
    }
    console.warn(`[MultiSource] Google Shopping FAILED:`, shoppingResult.reason);
  }

  // Collect retailer site results
  for (let i = 0; i < RETAILER_SITES.length; i++) {
    const result = siteResults[i];
    const retailer = RETAILER_SITES[i];
    if (result.status === "fulfilled" && result.value.length > 0) {
      allProducts.push(...result.value);
      sources.push(retailer.hostname);
      console.log(`[MultiSource] ${retailer.name}: ${result.value.length} results`);
    } else if (result.status === "rejected") {
      console.warn(`[MultiSource] ${retailer.name} FAILED:`, result.reason);
    }
  }

  // Deduplicate across sources
  const deduplicated = deduplicateProducts(allProducts);

  // Fire-and-forget: batch-resolve retailer URLs in the background.
  // Results are written to retailerUrlCache, which detail/purchase tools check
  // before making their own TinyFish calls. This avoids blocking search results.
  const unresolvedCount = deduplicated.filter(
    (p) => !p.retailerUrl && p.productUrl?.includes("google.")
  ).length;
  if (unresolvedCount > 0) {
    console.log(`[MultiSource] ${unresolvedCount} products lack retailer URLs — firing background batch resolution`);
    batchResolveRetailerUrls(deduplicated).catch((err) =>
      console.warn("[MultiSource] Background batch resolution failed:", err instanceof Error ? err.message : err)
    );
  }

  // Sort: direct URLs first, then redirect, then google-only
  const reliabilityOrder = { direct: 0, redirect: 1, google: 2 };
  deduplicated.sort(
    (a, b) =>
      (reliabilityOrder[a.urlReliability ?? "google"]) -
      (reliabilityOrder[b.urlReliability ?? "google"])
  );

  console.log(
    `[MultiSource] DONE query="${query}" total=${allProducts.length} deduplicated=${deduplicated.length} sources=${sources.join(",")} elapsed=${Date.now() - t0}ms`
  );

  return { products: deduplicated, sources, errors, stale, circuitOpen };
}

/**
 * Search a specific retailer via SerpAPI organic web search with site: operator.
 * Returns direct retailer URLs (e.g. walmart.com/ip/...) that work for Buy/Cart.
 * Uses 1 SerpAPI call per retailer.
 */
async function searchRetailerSite(
  query: string,
  hostname: string,
  country: string
): Promise<Product[]> {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) return [];

  const COUNTRY_TO_GL: Record<string, string> = {
    AR: "ar", BR: "br", MX: "mx", CL: "cl", CO: "co", US: "us",
  };

  const params = new URLSearchParams({
    engine: "google",
    q: `${query} site:${hostname}`,
    api_key: apiKey,
    gl: COUNTRY_TO_GL[country] ?? "us",
    num: "5",
  });

  const t0 = Date.now();
  try {
    const res = await fetch(`${SERPAPI_BASE_URL}?${params}`, {
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) {
      console.warn(`[MultiSource:${hostname}] HTTP ${res.status}`);
      return [];
    }

    const data: OrganicResponse = await res.json();
    if (data.error) {
      console.warn(`[MultiSource:${hostname}] API error: ${data.error}`);
      return [];
    }

    const results = data.organic_results ?? [];
    console.log(`[MultiSource:${hostname}] query="${query}" rawResults=${results.length} elapsed=${Date.now() - t0}ms`);

    return results
      .filter((r) => r.link && !r.link.includes("google."))
      .map((r, idx) => normalizeOrganic(r, hostname, country, idx));
  } catch (err) {
    console.warn(
      `[MultiSource:${hostname}] FAILED elapsed=${Date.now() - t0}ms:`,
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

/**
 * Normalize an organic search result into our Product shape.
 * Organic results have direct retailer URLs (e.g. walmart.com/ip/...).
 * Some have thumbnails, price in snippets/extensions.
 */
function normalizeOrganic(
  result: OrganicResult,
  source: string,
  country: string,
  index: number
): Product {
  const price = extractPriceFromOrganic(result);
  const rating = extractRatingFromOrganic(result);

  const currencyMap: Record<string, string> = {
    US: "USD", AR: "ARS", BR: "BRL", MX: "MXN", CL: "CLP", CO: "COP",
  };

  return {
    id: `site-${source}-${Date.now()}-${index}`,
    source,
    title: cleanTitle(result.title),
    currency: price?.currency ?? currencyMap[country] ?? "USD",
    currentPrice: price?.value ?? 0,
    imageUrl: result.thumbnail,
    productUrl: result.link,
    retailerUrl: result.link,
    urlReliability: "direct",
    description: result.snippet,
    rating: rating ?? undefined,
    availability: "unknown",
  };
}

/** Extract price from organic result rich snippets, snippet text, or title */
function extractPriceFromOrganic(
  result: OrganicResult
): { value: number; currency: string } | null {
  // Try extracting from rich_snippet extensions
  const extensions = [
    ...(result.rich_snippet?.top?.extensions ?? []),
    ...(result.rich_snippet?.bottom?.extensions ?? []),
  ];

  for (const ext of extensions) {
    const priceMatch = ext.match(/\$\s*([\d,]+\.?\d*)/);
    if (priceMatch) {
      return { value: parseFloat(priceMatch[1].replace(/,/g, "")), currency: "USD" };
    }
  }

  // Try snippet text
  if (result.snippet) {
    const snippetMatch = result.snippet.match(/\$\s*([\d,]+\.?\d*)/);
    if (snippetMatch) {
      return { value: parseFloat(snippetMatch[1].replace(/,/g, "")), currency: "USD" };
    }
  }

  // Try title
  if (result.title) {
    const titleMatch = result.title.match(/\$\s*([\d,]+\.?\d*)/);
    if (titleMatch) {
      return { value: parseFloat(titleMatch[1].replace(/,/g, "")), currency: "USD" };
    }
  }

  return null;
}

/** Extract rating from organic result rich snippet extensions */
function extractRatingFromOrganic(result: OrganicResult): number | null {
  const extensions = [
    ...(result.rich_snippet?.top?.extensions ?? []),
    ...(result.rich_snippet?.bottom?.extensions ?? []),
  ];

  for (const ext of extensions) {
    const ratingMatch = ext.match(/(\d+\.?\d*)\s*(?:out of\s*5|\/\s*5|stars?)/i);
    if (ratingMatch) {
      const val = parseFloat(ratingMatch[1]);
      if (val > 0 && val <= 5) return val;
    }
  }
  return null;
}

/** Clean retailer suffixes from title (e.g. "Product Name - Amazon.com") */
function cleanTitle(title: string): string {
  return title
    .replace(/\s*[-–|:]\s*(Amazon\.com|Best Buy|Walmart\.com|Target|eBay).*$/i, "")
    .trim();
}

/**
 * Deduplicate products across sources.
 * Groups by normalized title similarity, keeps the one with best URL reliability.
 * If same product from multiple sources, keep both but mark as deduplicated.
 */
function deduplicateProducts(products: Product[]): Product[] {
  if (products.length === 0) return [];

  const reliabilityOrder = { direct: 0, redirect: 1, google: 2 };
  const seen = new Map<string, Product>();

  for (const product of products) {
    const key = normalizeForDedup(product.title);

    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, product);
      continue;
    }

    // Merge: combine the best fields from both (image from Google Shopping + URL from organic)
    const merged = mergeProducts(existing, product, reliabilityOrder);
    seen.set(key, merged);
  }

  return Array.from(seen.values());
}

/**
 * Merge two products representing the same item from different sources.
 * Picks the best URL reliability, fills in missing images/prices from the other.
 */
function mergeProducts(
  a: Product,
  b: Product,
  reliabilityOrder: Record<string, number>
): Product {
  const aRel = reliabilityOrder[a.urlReliability ?? "google"];
  const bRel = reliabilityOrder[b.urlReliability ?? "google"];

  // Start with the one that has the better URL
  const base = bRel < aRel ? b : a;
  const donor = bRel < aRel ? a : b;

  return {
    ...base,
    // Fill in missing fields from the other source
    imageUrl: base.imageUrl || donor.imageUrl,
    currentPrice: base.currentPrice > 0 ? base.currentPrice : donor.currentPrice,
    originalPrice: base.originalPrice ?? donor.originalPrice,
    rating: base.rating ?? donor.rating,
    reviewCount: base.reviewCount ?? donor.reviewCount,
    brand: base.brand || donor.brand,
    description: base.description || donor.description,
  };
}

/** Normalize title for deduplication comparison */
function normalizeForDedup(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80); // Truncate to avoid minor suffix differences
}
