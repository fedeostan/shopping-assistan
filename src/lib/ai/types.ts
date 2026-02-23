export interface Product {
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
  retailerUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface PriceComparison {
  product: string;
  results: {
    source: string;
    price: number;
    currency: string;
    url: string;
    availability?: string;
  }[];
  recommendation?: string;
}

export interface PriceAlert {
  productId: string;
  productTitle: string;
  targetPrice: number;
  currentPrice: number;
  currency: string;
}

export interface Recommendation {
  product: Product;
  reason: string;
  confidence: number;
  action: "buy_now" | "wait" | "skip";
}
