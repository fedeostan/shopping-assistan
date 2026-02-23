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

// track_price
export interface TrackPriceArgs {
  productName: string;
  productUrl?: string;
  targetPrice?: number;
  currency?: string;
}

export interface TrackPriceResult {
  status: string;
  alertId?: string;
  productName?: string;
  currentPrice?: number | null;
  targetPrice?: number | null;
  currency?: string;
  message: string;
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
  recommendations: RecommendationItem[];
  errors?: string[];
  note?: string;
}

// purchase
export interface PurchaseArgs {
  retailerUrl: string;
  productName: string;
  quantity?: number;
  shipping: {
    fullName: string;
    email: string;
    phone?: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
}

export interface PurchaseResult {
  success: boolean;
  waitingForPayment: boolean;
  productName: string;
  retailerUrl: string;
  quantity?: number;
  streamingUrl?: string;
  orderSummary?: Record<string, unknown>;
  statusMessages?: string[];
  error?: string;
}
