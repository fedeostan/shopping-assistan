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

// compare_prices
export interface ComparePricesArgs {
  productName: string;
  sources?: string[];
  country?: string;
}

export interface ComparePricesResult {
  product: string;
  resultCount: number;
  results: {
    source: string;
    price: number;
    currency: string;
    url: string;
    title: string;
    availability?: string;
  }[];
  cheapest: {
    source: string;
    price: number;
    currency: string;
    title: string;
  } | null;
  errors?: string[];
  recommendation?: string;
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

// track_price
export interface TrackPriceArgs {
  productName: string;
  productUrl?: string;
  targetPrice?: number;
  currency?: string;
}

export interface TrackPriceResult {
  status: string;
  productName: string;
  currentPrice: number;
  targetPrice: number | null;
  currency: string;
  message: string;
  estimatedDrop: string;
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
    id: string;
    source: string;
    title: string;
    currentPrice: number;
    rating?: number;
    reviewCount?: number;
  };
  action: "buy_now" | "wait" | "skip";
  confidence: number;
}

export interface RecommendationsResult {
  recommendations: RecommendationItem[];
}
