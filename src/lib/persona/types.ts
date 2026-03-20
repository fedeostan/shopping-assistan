export interface UserPersona {
  // Identity
  locale?: string;
  currency?: string;
  country?: string;
  householdSize?: number;
  lifeStage?: string; // e.g., "student", "young_professional", "parent"

  // Shopping DNA
  budgetRanges?: Record<string, { min: number; max: number; currency: string }>;
  brandAffinities?: Record<string, number>; // brand -> score (-1 to 1)
  priceQualitySpectrum?: number; // -1 (pure price) to 1 (pure quality)
  preferredRetailers?: string[];
  sizeData?: Record<string, string>; // category -> size

  // Behavioral signals (accumulated over time)
  categoryInterests?: Record<string, number>; // category -> engagement score
  featurePreferences?: Record<string, number>; // feature -> preference score (-1 to 1)
  searchPatterns?: string[];
  promotionResponsiveness?: number; // 0 to 1
  averageOrderValue?: number;

  // Lifestyle
  dietaryRestrictions?: string[];
  hobbies?: string[];
  upcomingNeeds?: string[];

  // Per-key confidence tracking (0 to 1 per entry)
  _brandConfidence?: Record<string, number>;
  _categoryConfidence?: Record<string, number>;
  _featureConfidence?: Record<string, number>;
  _priceQualityConfidence?: number;
  _orderValueConfidence?: number;
}

export interface PersonaSignal {
  type: "brand_preference" | "budget_signal" | "category_interest" | "feature_preference" | "lifestyle" | "quality_preference" | "retailer_preference";
  key: string;
  value: unknown;
  confidence: number; // 0 to 1
  source: "chat" | "search" | "purchase" | "click" | "feedback" | "onboarding";
}

export interface InteractionRecord {
  userId: string;
  type: "search" | "click" | "purchase" | "compare" | "add_to_cart" | "dismiss" | "feedback" | "chat_statement" | "recommendation_click" | "price_alert";
  payload: Record<string, unknown>;
  personaSignals?: PersonaSignal[];
}

export interface PersonaRow {
  id: string;
  user_id: string;
  persona: UserPersona;
  preference_vector?: number[];
  confidence_score: number;
  last_refreshed_at?: string;
  created_at: string;
  updated_at: string;
}
