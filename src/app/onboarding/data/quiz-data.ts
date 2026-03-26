// Static data for onboarding personality quiz
// All images are hardcoded Unsplash URLs — no live searches needed

export interface Country {
  code: string;
  name: string;
  flag: string;
  currency: string;
  locale: string;
}

export const COUNTRIES: Country[] = [
  { code: "US", name: "United States", flag: "🇺🇸", currency: "USD", locale: "en" },
  { code: "AR", name: "Argentina", flag: "🇦🇷", currency: "ARS", locale: "es" },
  { code: "BR", name: "Brazil", flag: "🇧🇷", currency: "BRL", locale: "pt" },
  { code: "MX", name: "Mexico", flag: "🇲🇽", currency: "MXN", locale: "es" },
  { code: "CL", name: "Chile", flag: "🇨🇱", currency: "CLP", locale: "es" },
  { code: "CO", name: "Colombia", flag: "🇨🇴", currency: "COP", locale: "es" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", currency: "GBP", locale: "en" },
  { code: "ES", name: "Spain", flag: "🇪🇸", currency: "EUR", locale: "es" },
  { code: "DE", name: "Germany", flag: "🇩🇪", currency: "EUR", locale: "de" },
  { code: "CA", name: "Canada", flag: "🇨🇦", currency: "CAD", locale: "en" },
];

// --- Step 2: Style Quiz (This or That) ---

export interface StylePair {
  id: string;
  question: string;
  optionA: {
    label: string;
    image: string;
    traits: Record<string, number>; // featurePreference key -> score
    lifeStage?: string;
  };
  optionB: {
    label: string;
    image: string;
    traits: Record<string, number>;
    lifeStage?: string;
  };
}

export const STYLE_PAIRS: StylePair[] = [
  {
    id: "minimalist-vs-maximalist",
    question: "Which space feels more like you?",
    optionA: {
      label: "Clean & Minimal",
      image: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&h=300&fit=crop",
      traits: { minimalist_design: 1, premium_materials: 0.7, simplicity: 1 },
      lifeStage: "young_professional",
    },
    optionB: {
      label: "Bold & Colorful",
      image: "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=400&h=300&fit=crop",
      traits: { trendy_design: 1, variety: 0.8, expressive: 1 },
      lifeStage: "creative",
    },
  },
  {
    id: "tech-vs-classic",
    question: "Which watch would you wear?",
    optionA: {
      label: "Smart & Connected",
      image: "https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=400&h=300&fit=crop",
      traits: { tech_forward: 1, smart_features: 0.9, innovation: 0.8 },
    },
    optionB: {
      label: "Classic & Timeless",
      image: "https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=400&h=300&fit=crop",
      traits: { classic_style: 1, craftsmanship: 0.9, durability: 0.7 },
    },
  },
  {
    id: "outdoor-vs-indoor",
    question: "Your ideal weekend?",
    optionA: {
      label: "Adventure Outside",
      image: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=400&h=300&fit=crop",
      traits: { outdoor_gear: 1, performance: 0.8, durability: 0.9 },
      lifeStage: "active",
    },
    optionB: {
      label: "Cozy at Home",
      image: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=400&h=300&fit=crop",
      traits: { comfort: 1, home_decor: 0.8, relaxation: 0.7 },
      lifeStage: "homebody",
    },
  },
];

// --- Step 3: Brand Rating ---

export interface Brand {
  name: string;
  logo: string; // emoji or icon fallback
  category: string;
  color: string; // tailwind bg color
  image: string; // product hero image
}

export const BRANDS: Brand[] = [
  { name: "Apple", logo: "🍎", category: "Tech", color: "bg-zinc-900", image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&h=300&fit=crop" },
  { name: "Nike", logo: "✓", category: "Sports", color: "bg-orange-600", image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=300&fit=crop" },
  { name: "Samsung", logo: "📱", category: "Tech", color: "bg-blue-700", image: "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=400&h=300&fit=crop" },
  { name: "Zara", logo: "Z", category: "Fashion", color: "bg-black", image: "https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?w=400&h=300&fit=crop" },
  { name: "Sony", logo: "🎮", category: "Electronics", color: "bg-blue-900", image: "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=400&h=300&fit=crop" },
  { name: "Adidas", logo: "⫘", category: "Sports", color: "bg-black", image: "https://images.unsplash.com/photo-1518002171953-a080ee817e1f?w=400&h=300&fit=crop" },
  { name: "Amazon Basics", logo: "📦", category: "Value", color: "bg-amber-500", image: "https://images.unsplash.com/photo-1523474253046-8cd2748b5fd2?w=400&h=300&fit=crop" },
  { name: "IKEA", logo: "🏠", category: "Home", color: "bg-blue-600", image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=300&fit=crop" },
];

// --- Step 4: The Price Trap ---

export interface ProductComparison {
  question: string;
  optionA: {
    name: string;
    brand: string;
    price: number;
    image: string;
    quality: string; // "Premium" | "Good" | "Basic"
  };
  optionB: {
    name: string;
    brand: string;
    price: number;
    image: string;
    quality: string;
  };
  // Picking A = quality-focused (positive priceQualitySpectrum)
  // Picking B = price-focused (negative priceQualitySpectrum)
}

export const PRICE_TRAP: ProductComparison = {
  question: "You need new headphones. Which one are you grabbing?",
  optionA: {
    name: "Premium Noise-Cancelling",
    brand: "Sony WH-1000XM5",
    price: 299,
    image: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=400&h=300&fit=crop",
    quality: "Premium",
  },
  optionB: {
    name: "Great Sound, Great Price",
    brand: "Anker Soundcore Q45",
    price: 79,
    image: "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=400&h=300&fit=crop",
    quality: "Good",
  },
};

// --- Step 5: Deal or No Deal ---

export interface DealScenario {
  setup: string;
  product: string;
  originalPrice: number;
  image: string;
  options: {
    id: string;
    label: string;
    emoji: string;
    description: string;
    promotionResponsiveness: number; // 0 to 1
  }[];
}

export const DEAL_SCENARIO: DealScenario = {
  setup: "You've been eyeing these sneakers for weeks...",
  product: "Air Max 90",
  originalPrice: 180,
  image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=300&fit=crop",
  options: [
    {
      id: "buy-now",
      label: "Buy Now",
      emoji: "🔥",
      description: "Life's too short to wait. I want them now!",
      promotionResponsiveness: 0.1,
    },
    {
      id: "wait-sale",
      label: "Wait for the Sale",
      emoji: "⏰",
      description: "Black Friday is 3 weeks away. I can wait!",
      promotionResponsiveness: 0.9,
    },
    {
      id: "find-cheaper",
      label: "Find a Dupe",
      emoji: "🔍",
      description: "I bet there's something similar for less.",
      promotionResponsiveness: 0.5,
    },
  ],
};

// --- Step 6: Categories ---

export interface Category {
  name: string;
  emoji: string;
  image: string;
  key: string; // maps to categoryInterests key
}

export const CATEGORIES: Category[] = [
  {
    name: "Tech & Gadgets",
    emoji: "💻",
    image: "https://images.unsplash.com/photo-1468495244123-6c6c332eeece?w=300&h=200&fit=crop",
    key: "Electronics",
  },
  {
    name: "Fashion",
    emoji: "👗",
    image: "https://images.unsplash.com/photo-1445205170230-053b83016050?w=300&h=200&fit=crop",
    key: "Clothing",
  },
  {
    name: "Home & Living",
    emoji: "🏡",
    image: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=300&h=200&fit=crop",
    key: "Home & Garden",
  },
  {
    name: "Sports & Outdoors",
    emoji: "⚽",
    image: "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=300&h=200&fit=crop",
    key: "Sports",
  },
  {
    name: "Beauty & Self-Care",
    emoji: "✨",
    image: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=300&h=200&fit=crop",
    key: "Beauty",
  },
  {
    name: "Books & Learning",
    emoji: "📚",
    image: "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=300&h=200&fit=crop",
    key: "Books",
  },
  {
    name: "Kids & Toys",
    emoji: "🧸",
    image: "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=300&h=200&fit=crop",
    key: "Toys",
  },
  {
    name: "Food & Grocery",
    emoji: "🍕",
    image: "https://images.unsplash.com/photo-1506617420156-8e4536971650?w=300&h=200&fit=crop",
    key: "Food & Grocery",
  },
  {
    name: "Gaming",
    emoji: "🎮",
    image: "https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?w=300&h=200&fit=crop",
    key: "Gaming",
  },
  {
    name: "Pet Supplies",
    emoji: "🐾",
    image: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=300&h=200&fit=crop",
    key: "Pets",
  },
];

// --- Step 7: Budget ---

export interface BudgetOption {
  value: number;
  label: string;
  description: string;
  image: string;
}

export const BUDGET_OPTIONS: BudgetOption[] = [
  { value: 25, label: "Under $50", description: "Deals and essentials", image: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=400&h=300&fit=crop" },
  { value: 100, label: "$50 – $200", description: "Everyday purchases", image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=400&h=300&fit=crop" },
  { value: 350, label: "$200 – $500", description: "Mid-range quality", image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=300&fit=crop" },
  { value: 750, label: "$500+", description: "Premium & luxury", image: "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=400&h=300&fit=crop" },
];

// --- Step 8: Household ---

export interface HouseholdOption {
  id: string;
  label: string;
  emoji: string;
  description: string;
  householdSize: number;
  lifeStage: string;
  image: string;
}

export const HOUSEHOLD_OPTIONS: HouseholdOption[] = [
  {
    id: "solo",
    label: "Just Me",
    emoji: "🧑",
    description: "Shopping for one",
    householdSize: 1,
    lifeStage: "independent",
    image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400&h=300&fit=crop",
  },
  {
    id: "couple",
    label: "Me + Partner",
    emoji: "👫",
    description: "Two's company",
    householdSize: 2,
    lifeStage: "couple",
    image: "https://images.unsplash.com/photo-1516466723877-e4ec1d736c8a?w=400&h=300&fit=crop",
  },
  {
    id: "family",
    label: "Family",
    emoji: "👨‍👩‍👧‍👦",
    description: "Kids in the picture",
    householdSize: 4,
    lifeStage: "parent",
    image: "https://images.unsplash.com/photo-1609220136736-443140cffec6?w=400&h=300&fit=crop",
  },
  {
    id: "roommates",
    label: "Roommates",
    emoji: "🏠",
    description: "Shared living, separate shopping",
    householdSize: 3,
    lifeStage: "shared",
    image: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&h=300&fit=crop",
  },
];

// --- Step 9: Sizes ---

export const TSHIRT_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];

export const SHOE_SIZES_US = [
  "5", "5.5", "6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5",
  "10", "10.5", "11", "11.5", "12", "13", "14",
];

export const SHOE_SIZES_EU = [
  "35", "36", "37", "38", "39", "40", "41", "42",
  "43", "44", "45", "46", "47", "48",
];

export const PANTS_SIZES = [
  "XS (26-28)", "S (28-30)", "M (30-32)", "L (32-34)",
  "XL (34-36)", "XXL (36-38)", "3XL (38-40)",
];

// --- Step 10: Retailers ---

export interface Retailer {
  name: string;
  logo: string;
  color: string;
}

export const RETAILERS: Retailer[] = [
  { name: "Amazon", logo: "📦", color: "bg-amber-500" },
  { name: "MercadoLibre", logo: "🤝", color: "bg-yellow-400" },
  { name: "Walmart", logo: "🏪", color: "bg-blue-600" },
  { name: "eBay", logo: "🏷️", color: "bg-red-500" },
  { name: "Target", logo: "🎯", color: "bg-red-600" },
  { name: "Best Buy", logo: "🔌", color: "bg-blue-800" },
  { name: "AliExpress", logo: "🌐", color: "bg-orange-500" },
  { name: "Etsy", logo: "🎨", color: "bg-orange-600" },
];

// --- Step titles and metadata ---

export interface StepMeta {
  name: string;
  title: string;
  subtitle: string;
}

export const STEP_META: StepMeta[] = [
  { name: "Location", title: "Where are you based?", subtitle: "So we can find the best deals and stores near you" },
  { name: "Style", title: "Pick your vibe", subtitle: "This or that — go with your gut!" },
  { name: "Brands", title: "Brand check", subtitle: "Love it, meh, or nah?" },
  { name: "Price vs Quality", title: "The price trap", subtitle: "There's no wrong answer... or is there?" },
  { name: "Deals", title: "Deal or no deal", subtitle: "What kind of shopper are you really?" },
  { name: "Categories", title: "What excites you?", subtitle: "Pick your top interests" },
  { name: "Budget", title: "Budget comfort zone", subtitle: "What do you usually spend per purchase?" },
  { name: "Household", title: "Who's this for?", subtitle: "Tell us about your household" },
  { name: "Sizes", title: "Size me up", subtitle: "So we never suggest something that won't fit" },
  { name: "Retailers", title: "Your go-to stores", subtitle: "Where do you usually end up shopping?" },
];
