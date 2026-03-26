import { tool } from "ai";
import { z } from "zod";
import { runAutomation } from "@/lib/tinyfish/client";
import { getPersona, logInteraction } from "@/lib/persona/engine";
import { extractSearchSignals } from "@/lib/persona/signals";
import {
  initSearch,
  addStreamingUrl,
  addProgress,
  computeSearchId,
} from "@/lib/search/search-events";
import { searchMultiSource } from "@/lib/search/multi-source";
import type { Product } from "@/lib/ai/types";

// ---------------------------------------------------------------------------
// Hardcoded, tested goal templates per retailer.
// The agent picks retailers + query; the tool fills in the template.
// ---------------------------------------------------------------------------

const PRODUCT_SCHEMA = `{"products": [{"name": "Product Name", "price": 29.99, "currency": "USD", "image_url": "https://example.com/img.jpg", "product_url": "https://example.com/product/123", "rating": 4.5, "brand": "BrandName"}]}`;

function buildGoal(query: string, retailer: string): { url: string; goal: string } {
  const q = query.trim();
  const encodedQ = encodeURIComponent(q);

  switch (retailer.toLowerCase()) {
    case "amazon":
      return {
        url: `https://www.amazon.com/s?k=${encodedQ}`,
        goal: `1. Wait for the Amazon search results to load.
2. If any popup or banner appears, close it.
3. Collect up to 5 product results from the search page. For product_url, prepend "https://www.amazon.com" to relative links.
4. If a CAPTCHA appears, return {"products": [], "error": "captcha"}.
Return JSON: ${PRODUCT_SCHEMA}`,
      };

    case "best buy":
    case "bestbuy":
      return {
        url: `https://www.bestbuy.com/site/searchpage.jsp?st=${encodedQ}`,
        goal: `1. Wait for Best Buy search results to load.
2. If any popup appears, close it.
3. Collect up to 5 product results from the search page. For product_url, prepend "https://www.bestbuy.com" to relative links.
Return JSON: ${PRODUCT_SCHEMA}`,
      };

    case "walmart":
      return {
        url: `https://www.walmart.com/search?q=${encodedQ}`,
        goal: `1. Wait for the Walmart search results to load.
2. If a CAPTCHA or "Robot or human?" dialog appears, return {"products": [], "error": "captcha"}.
3. If any popup appears, close it.
4. Collect up to 5 product results from the search page. For product_url, prepend "https://www.walmart.com" to relative links.
Return JSON: ${PRODUCT_SCHEMA}`,
      };

    case "target":
      return {
        url: `https://www.target.com/s?searchTerm=${encodedQ}`,
        goal: `1. Wait for Target search results to load.
2. If any popup appears, close it.
3. Collect up to 5 product results from the search page. For product_url, prepend "https://www.target.com" to relative links.
Return JSON: ${PRODUCT_SCHEMA}`,
      };

    default:
      return {
        url: `https://www.${retailer.toLowerCase().replace(/\s+/g, "")}.com`,
        goal: `1. Find the search bar and search for "${q}".
2. Wait for search results to load.
3. If any popup or CAPTCHA appears, close it or return {"products": [], "error": "blocked"}.
4. Collect up to 5 product results from the search page.
Return JSON: ${PRODUCT_SCHEMA}`,
      };
  }
}

const KNOWN_RETAILERS = ["Amazon", "Best Buy", "Walmart", "Target"] as const;

export function createDeepSearch(userId: string | null) {
  return tool({
    description:
      "Search for products by browsing real retailer websites using TinyFish web agents. Slower (30-60s) but returns accurate prices, real images, and direct URLs with live browser replay. Select 2-4 retailers from: Amazon, Best Buy, Walmart, Target. The tool has optimized search goals for each retailer built-in.",
    inputSchema: z.object({
      query: z.string().describe("The refined product search query (e.g. 'wireless earbuds under $100')"),
      retailers: z
        .array(z.string())
        .min(1)
        .max(4)
        .describe(
          "Retailer names to search. Pick from: Amazon, Best Buy, Walmart, Target. Default: [Amazon, Best Buy, Walmart]"
        ),
      maxResultsPerRetailer: z
        .number()
        .optional()
        .default(8)
        .describe("Max products to extract per retailer"),
    }),
    execute: async ({ query, retailers, maxResultsPerRetailer }) => {
      const t0 = Date.now();

      // Build goals from hardcoded templates
      const retailerGoals = retailers.map((name) => {
        const built = buildGoal(query, name);
        return { name, url: built.url, goal: built.goal };
      });

      const searchId = computeSearchId(query, retailers);
      initSearch(searchId);

      console.log(
        `[Tool:deep_search] START searchId=${searchId} query="${query}" retailers=${retailers.join(",")} maxPerRetailer=${maxResultsPerRetailer}`
      );

      // Get persona for proxy config
      let country: string = "US";
      if (userId) {
        try {
          const personaRow = await getPersona(userId);
          country = personaRow?.persona?.country ?? "US";
        } catch {
          // continue with default
        }
      }

      const proxyCountry = mapCountryToProxy(country);

      // Run TinyFish automations in parallel — individual SSE streams per retailer
      const streamingUrls: { retailer: string; url: string }[] = [];
      const errors: { retailer: string; error: string }[] = [];

      const results = await Promise.allSettled(
        retailerGoals.map(async (retailer) => {
          const retailerT0 = Date.now();
          console.log(
            `[Tool:deep_search] Starting ${retailer.name} at ${retailer.url}`
          );
          console.log(
            `[Tool:deep_search] ${retailer.name} goal (first 200): ${retailer.goal.slice(0, 200)}`
          );

          try {
            const result = await runAutomation(
              {
                url: retailer.url,
                goal: retailer.goal,
                browser_profile: "stealth",
                proxy_config: proxyCountry
                  ? { enabled: true, country_code: proxyCountry }
                  : undefined,
                feature_flags: { enable_agent_memory: true },
              },
              {
                timeoutMs: 90_000,
                maxSteps: 25,
                loopThreshold: 3,
                onStreamingUrl: (url) => {
                  streamingUrls.push({ retailer: retailer.name, url });
                  addStreamingUrl(searchId, retailer.name, url);
                  console.log(
                    `[Tool:deep_search] ${retailer.name} streaming URL: ${url}`
                  );
                },
                onProgress: (msg) => {
                  addProgress(searchId, retailer.name, msg);
                },
              }
            );

            console.log(
              `[Tool:deep_search] ${retailer.name} ${result.success ? "OK" : "FAILED"} elapsed=${Date.now() - retailerT0}ms steps=${result.statusMessages.length}`
            );

            if (!result.success) {
              errors.push({
                retailer: retailer.name,
                error: result.error ?? "Automation failed",
              });
              return [];
            }

            // Normalize TinyFish result data to Product[]
            return normalizeResults(
              result.data,
              retailer.name,
              retailer.url,
              maxResultsPerRetailer
            );
          } catch (err) {
            const msg =
              err instanceof Error ? err.message : "Unknown error";
            console.warn(
              `[Tool:deep_search] ${retailer.name} EXCEPTION:`,
              msg
            );
            errors.push({ retailer: retailer.name, error: msg });
            return [];
          }
        })
      );

      // Collect all products from successful runs
      const allProducts: Product[] = [];
      for (const result of results) {
        if (result.status === "fulfilled") {
          allProducts.push(...result.value);
        }
      }

      // Filter out $0 prices (extraction failures)
      const filtered = allProducts.filter((p) => p.currentPrice > 0);

      // Simple deduplication by normalized title
      let deduplicated = deduplicateByTitle(filtered);

      // AUTO-FALLBACK: If TinyFish returned 0 products, use fast search
      let fallbackUsed = false;
      if (deduplicated.length === 0) {
        console.log(
          `[Tool:deep_search] No products from TinyFish, falling back to searchMultiSource`
        );
        try {
          const fastResult = await searchMultiSource(query, country);
          const fastFiltered = fastResult.products.filter(
            (p) => p.currentPrice > 0
          );
          deduplicated = deduplicateByTitle(fastFiltered);
          fallbackUsed = true;
          console.log(
            `[Tool:deep_search] Fast fallback returned ${deduplicated.length} products`
          );
        } catch (err) {
          console.warn(
            `[Tool:deep_search] Fast fallback also failed:`,
            err instanceof Error ? err.message : err
          );
        }
      }

      // Slim products for tool result
      const slimProducts = deduplicated.map((p) => ({
        id: p.id,
        externalId: p.externalId,
        title: p.title,
        brand: p.brand,
        currentPrice: p.currentPrice,
        ...(p.originalPrice && p.originalPrice !== p.currentPrice
          ? { originalPrice: p.originalPrice }
          : {}),
        currency: p.currency,
        rating: p.rating,
        source: p.source,
        imageUrl: p.imageUrl,
        productUrl: p.productUrl,
        retailerUrl: p.retailerUrl,
        urlReliability: "direct" as const,
        ...(p.availability && p.availability !== "unknown"
          ? { availability: p.availability }
          : {}),
        ...(p.description ? { description: p.description.slice(0, 100) } : {}),
      }));

      // Log persona signals
      if (userId) {
        const signals = extractSearchSignals(query, {});
        logInteraction({
          userId,
          type: "search",
          payload: {
            query,
            searchMode: "deep",
            retailers,
            resultCount: slimProducts.length,
          },
          personaSignals: signals,
        }).catch(console.error);
      }

      console.log(
        `[Tool:deep_search] DONE query="${query}" raw=${allProducts.length} filtered=${filtered.length} deduped=${deduplicated.length} returned=${slimProducts.length} streamingUrls=${streamingUrls.length} errors=${errors.length} fallback=${fallbackUsed} elapsed=${Date.now() - t0}ms`
      );

      return {
        query,
        retailers,
        resultCount: slimProducts.length,
        products: slimProducts,
        streamingUrls: streamingUrls.filter((s) => s.url),
        errors: errors.length > 0 ? errors : undefined,
        ...(fallbackUsed ? { note: "Results from fast search (TinyFish agents could not extract data)" } : {}),
      };
    },
  });
}

/**
 * Normalize raw TinyFish result JSON into Product[].
 * TinyFish returns whatever the goal's schema requested.
 * We search aggressively for an array of objects that look like products.
 */
function normalizeResults(
  data: Record<string, unknown> | undefined,
  retailerName: string,
  retailerUrl: string,
  maxResults: number
): Product[] {
  if (!data) {
    console.warn(`[Tool:deep_search] ${retailerName}: No result data`);
    return [];
  }

  console.log(
    `[Tool:deep_search] ${retailerName} raw result keys: ${Object.keys(data).join(",")}`
  );
  console.log(
    `[Tool:deep_search] ${retailerName} raw result preview: ${JSON.stringify(data).slice(0, 500)}`
  );

  // Strategy 1: Look for known array keys
  let rawProducts: unknown[] | undefined;
  for (const key of ["products", "results", "items", "listings", "data", "search_results"]) {
    if (Array.isArray(data[key]) && (data[key] as unknown[]).length > 0) {
      rawProducts = data[key] as unknown[];
      console.log(`[Tool:deep_search] ${retailerName}: Found ${rawProducts.length} items under "${key}"`);
      break;
    }
  }

  // Strategy 2: If top-level is an array (TinyFish sometimes returns bare arrays)
  if (!rawProducts && Array.isArray(data)) {
    rawProducts = data as unknown[];
    console.log(`[Tool:deep_search] ${retailerName}: Top-level is array with ${rawProducts.length} items`);
  }

  // Strategy 3: Search all values for the first array of objects
  if (!rawProducts) {
    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === "object" && value[0] !== null) {
        rawProducts = value as unknown[];
        console.log(`[Tool:deep_search] ${retailerName}: Found array of objects under "${key}" (${rawProducts.length} items)`);
        break;
      }
    }
  }

  // Strategy 4: If data itself looks like a single product, wrap it
  if (!rawProducts && data.name && (data.price !== undefined || data.current_price !== undefined)) {
    rawProducts = [data];
    console.log(`[Tool:deep_search] ${retailerName}: Data looks like a single product, wrapping`);
  }

  if (!rawProducts || rawProducts.length === 0) {
    console.warn(
      `[Tool:deep_search] ${retailerName}: No products found in result. Keys: ${Object.keys(data).join(",")}`
    );
    console.warn(
      `[Tool:deep_search] ${retailerName}: Full result: ${JSON.stringify(data).slice(0, 1000)}`
    );
    return [];
  }

  const domain = extractDomain(retailerUrl);

  return rawProducts.slice(0, maxResults).map((raw, idx) => {
    const item = raw as Record<string, unknown>;

    const name = String(item.name ?? item.title ?? item.product_name ?? "");
    const price = parsePrice(item.price);
    const originalPrice = parsePrice(item.original_price ?? item.was_price);
    const currency = String(item.currency ?? "USD");
    const imageUrl = String(item.image_url ?? item.image ?? item.thumbnail ?? "");
    const productUrl = String(item.product_url ?? item.url ?? item.link ?? "");
    const rating = typeof item.rating === "number" ? item.rating : parseFloat(String(item.rating ?? ""));
    const reviewCount =
      typeof item.review_count === "number"
        ? item.review_count
        : parseInt(String(item.review_count ?? item.reviews ?? "0"), 10);
    const availability = String(item.availability ?? item.stock ?? "");
    const brand = String(item.brand ?? "");

    // Build full URL if relative
    const fullProductUrl = productUrl.startsWith("http")
      ? productUrl
      : productUrl.startsWith("/")
        ? `https://${domain}${productUrl}`
        : "";

    return {
      id: `deep-${retailerName.toLowerCase().replace(/\s+/g, "-")}-${idx}`,
      source: retailerName,
      title: name,
      brand: brand || undefined,
      currentPrice: price ?? 0,
      originalPrice: originalPrice ?? undefined,
      currency,
      rating: isNaN(rating) ? undefined : rating,
      reviewCount: isNaN(reviewCount) ? undefined : reviewCount,
      imageUrl: imageUrl || undefined,
      productUrl: fullProductUrl || undefined,
      retailerUrl: fullProductUrl || undefined,
      urlReliability: "direct" as const,
      availability: availability || undefined,
    };
  });
}

function parsePrice(val: unknown): number | undefined {
  if (typeof val === "number") return val > 0 ? val : undefined;
  if (typeof val === "string") {
    const cleaned = val.replace(/[^0-9.,]/g, "");
    if (!cleaned) return undefined;
    // Handle comma as decimal separator vs thousand separator
    let normalized: string;
    if (cleaned.includes(",") && cleaned.includes(".")) {
      normalized = cleaned.replace(/,/g, "");
    } else if (
      cleaned.includes(",") &&
      cleaned.indexOf(",") > cleaned.length - 4
    ) {
      normalized = cleaned.replace(",", ".");
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
    const num = parseFloat(normalized);
    return isNaN(num) || num <= 0 ? undefined : num;
  }
  return undefined;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url.replace(/^https?:\/\//, "").split("/")[0];
  }
}

function deduplicateByTitle(products: Product[]): Product[] {
  const seen = new Map<string, Product>();
  for (const product of products) {
    const key = product.title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60);

    const existing = seen.get(key);
    if (!existing || product.currentPrice < existing.currentPrice) {
      seen.set(key, product);
    }
  }
  return Array.from(seen.values());
}

function mapCountryToProxy(
  country: string
): "US" | "GB" | "CA" | "DE" | "FR" | "JP" | "AU" | undefined {
  const map: Record<string, "US" | "GB" | "CA" | "DE" | "FR" | "JP" | "AU"> =
    {
      US: "US",
      GB: "GB",
      UK: "GB",
      CA: "CA",
      DE: "DE",
      FR: "FR",
      JP: "JP",
      AU: "AU",
      // LATAM defaults to US proxy
      AR: "US",
      BR: "US",
      MX: "US",
      CL: "US",
      CO: "US",
    };
  return map[country.toUpperCase()];
}
