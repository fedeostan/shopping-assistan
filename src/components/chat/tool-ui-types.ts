// Client-safe types mirroring each tool's args/result shapes.
// We can't import server-side tool() definitions in "use client" components.

export interface ProductResult {
  id: string;
  externalId?: string;
  source: string;
  title: string;
  description?: string;
  brand?: string;
  category?: string;
  imageUrl?: string;
  productUrl?: string;
  retailerUrl?: string;
  currency: string;
  currentPrice: number;
  originalPrice?: number;
  rating?: number;
  reviewCount?: number;
  availability?: string;
}

// search_products
export interface SearchProductsArgs {
  query: string;
  maxResults?: number;
  sources?: string[];
  country?: string;
  minPrice?: number;
  maxPrice?: number;
}

export interface SearchProductsResult {
  query: string;
  sources: string[];
  country: string;
  resultCount: number;
  products: ProductResult[];
  errors?: string[];
  note?: string;
}

// get_product_details
export interface ProductDetailsArgs {
  url: string;
}

export interface ProductDetailsResult {
  success: boolean;
  product?: {
    title: string;
    brand?: string;
    price: number;
    originalPrice?: number;
    currency: string;
    rating?: number;
    reviewCount?: number;
    description?: string;
    availability?: string;
    specifications?: Record<string, string>;
    source: string;
    url?: string;
    imageUrl?: string;
  };
  error?: string;
}

// get_recommendations
export interface RecommendationsArgs {
  category?: string;
  budget?: number;
  currency?: string;
  occasion?: string;
}

export interface RecommendationItem {
  title: string;
  reason: string;
  product: {
    title: string;
    currentPrice: number;
    currency?: string;
    rating?: number;
    source?: string;
    retailerUrl?: string;
  };
  action: "buy_now" | "wait";
  confidence: number;
}

export interface RecommendationsResult {
  productsEvaluated?: number;
  sourcesSearched?: string[];
  topPickReason?: string;
  recommendations: RecommendationItem[];
  errors?: string[];
  note?: string;
}

// purchase
export interface PurchaseArgs {
  productUrl: string;
  productName: string;
  quantity?: number;
}

export interface PurchaseResult {
  success: boolean;
  addedToCart?: boolean;
  productName: string;
  productUrl: string;
  quantity?: number;
  cartMethod?: "cart_permalink" | "shopify_permalink" | "tinyfish_automation" | "direct_link";
  cartUrl?: string;
  retailer?: string;
  shopifyVariant?: {
    title: string;
    price: string;
  };
  streamingUrl?: string;
  statusMessages?: string[];
  error?: string;
}

// search_store
export interface SearchStoreArgs {
  storeName: string;
  storeUrl?: string;
  query: string;
  maxResults?: number;
}

export type SearchStoreResult = SearchProductsResult & {
  storeName: string;
  storeUrl?: string;
};

// compare_products
export interface CompareProductsArgs {
  products: Array<{
    title: string;
    brand?: string;
    imageUrl?: string;
    productUrl?: string;
    retailerUrl?: string;
    currentPrice: number;
    originalPrice?: number;
    currency: string;
    rating?: number;
    reviewCount?: number;
    source: string;
    availability?: string;
    specs?: Record<string, string>;
  }>;
  focus?: string;
}

export interface ComparisonBadge {
  productIndex: number;
  label: "Best Value" | "Top Rated" | "Best Overall";
  variant: "green" | "blue" | "amber";
}

export interface CompareProductsResult {
  products: CompareProductsArgs["products"];
  dimensions: string[];
  winners: Record<string, number>;
  badges: ComparisonBadge[];
  focus?: string;
}
