import type { Product } from "@/lib/ai/types";

const SITE_IDS: Record<string, string> = {
  AR: "MLA",
  BR: "MLB",
  MX: "MLM",
  CL: "MLC",
  CO: "MCO",
  US: "MLA", // fallback to Argentina for US queries
};

const CURRENCY_MAP: Record<string, string> = {
  ARS: "ARS",
  BRL: "BRL",
  MXN: "MXN",
  CLP: "CLP",
  COP: "COP",
  USD: "USD",
};

interface MeliSearchResult {
  id: string;
  title: string;
  price: number;
  currency_id: string;
  condition: string;
  thumbnail: string;
  permalink: string;
  available_quantity: number;
  sold_quantity: number;
  attributes: { id: string; name: string; value_name: string | null }[];
}

interface MeliSearchResponse {
  paging: { total: number; offset: number; limit: number };
  results: MeliSearchResult[];
}

/**
 * Search MercadoLibre's public API for products.
 * No authentication required for search.
 */
export async function searchMercadoLibre(opts: {
  query: string;
  country?: string;
  limit?: number;
  offset?: number;
  sort?: "relevance" | "price_asc" | "price_desc";
}): Promise<{ products: Product[]; total: number }> {
  const siteId = SITE_IDS[opts.country ?? "AR"] ?? "MLA";
  const limit = Math.min(opts.limit ?? 10, 50);

  const params = new URLSearchParams({
    q: opts.query,
    limit: limit.toString(),
    offset: (opts.offset ?? 0).toString(),
  });

  if (opts.sort && opts.sort !== "relevance") {
    params.set("sort", opts.sort);
  }

  const url = `https://api.mercadolibre.com/sites/${siteId}/search?${params}`;

  const headers: Record<string, string> = { Accept: "application/json" };

  // Use OAuth token if available
  const accessToken = process.env.MERCADOLIBRE_ACCESS_TOKEN;
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const response = await fetch(url, {
    headers,
    next: { revalidate: 300 }, // cache for 5 minutes
  });

  if (!response.ok) {
    if (response.status === 403) {
      console.warn(
        "[MercadoLibre] 403 Forbidden — API requires OAuth token. Set MERCADOLIBRE_ACCESS_TOKEN in .env.local"
      );
      return { products: [], total: 0 };
    }
    throw new Error(
      `MercadoLibre API error: ${response.status} ${response.statusText}`
    );
  }

  const data: MeliSearchResponse = await response.json();

  const products: Product[] = data.results.map((item) =>
    normalizeProduct(item)
  );

  return { products, total: data.paging.total };
}

/** Normalize a MercadoLibre item into our common Product schema */
function normalizeProduct(item: MeliSearchResult): Product {
  const brand =
    item.attributes?.find((a) => a.id === "BRAND")?.value_name ?? undefined;

  return {
    id: item.id,
    externalId: item.id,
    source: "mercadolibre",
    title: item.title,
    brand,
    currency: CURRENCY_MAP[item.currency_id] ?? item.currency_id,
    currentPrice: item.price,
    imageUrl: item.thumbnail?.replace("http://", "https://"),
    productUrl: item.permalink,
    availability:
      item.available_quantity > 0 ? "in_stock" : "out_of_stock",
    rating: undefined, // MercadoLibre search doesn't return ratings
    reviewCount: undefined,
    metadata: {
      condition: item.condition,
      soldQuantity: item.sold_quantity,
    },
  };
}
