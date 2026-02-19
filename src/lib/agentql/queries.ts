import { queryData } from "./client";
import type { Product } from "@/lib/ai/types";

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
 */
export async function scrapeProductList(url: string): Promise<Product[]> {
  const { data } = await queryData<{ products: AgentQLProduct[] }>({
    url,
    query: PRODUCT_LIST_QUERY,
  });

  if (!data.products || data.products.length === 0) {
    return [];
  }

  return data.products.map((item, idx) => normalizeAgentQLProduct(item, url, idx));
}

/**
 * Extract detailed product info from a single product page.
 */
export async function scrapeProductDetail(
  url: string
): Promise<Product & { description?: string; specifications?: { label: string; value: string }[] }> {
  const { data } = await queryData<{ product: AgentQLProductDetail }>({
    url,
    query: PRODUCT_DETAIL_QUERY,
  });

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

/**
 * Search MercadoLibre via AgentQL scraping (fallback when API is unavailable).
 */
export async function scrapeMercadoLibreSearch(
  query: string,
  country: string = "AR"
): Promise<Product[]> {
  const domains: Record<string, string> = {
    AR: "mercadolibre.com.ar",
    BR: "mercadolivre.com.br",
    MX: "mercadolibre.com.mx",
    CL: "mercadolibre.cl",
    CO: "mercadolibre.com.co",
  };

  const domain = domains[country] ?? domains.AR;
  const searchUrl = `https://listado.${domain}/${encodeURIComponent(query.replace(/ /g, "-"))}`;

  return scrapeProductList(searchUrl);
}

/**
 * Search Amazon via AgentQL scraping.
 */
export async function scrapeAmazonSearch(query: string): Promise<Product[]> {
  const searchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;
  return scrapeProductList(searchUrl);
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
    rating: item.rating,
    reviewCount: item.review_count,
    availability: item.availability ?? "unknown",
  };
}

function inferSource(url: string): string {
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
