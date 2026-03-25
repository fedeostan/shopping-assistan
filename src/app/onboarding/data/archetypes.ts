import type { StyleAnswers } from "../steps/style-quiz-step";

export interface BuyerArchetype {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  traits: string[];
  gradient: string;
}

export const ARCHETYPES: BuyerArchetype[] = [
  {
    id: "trendsetter",
    name: "The Trendsetter",
    emoji: "🔥",
    tagline: "Always ahead of the curve",
    traits: ["Bold style choices", "Fashion-forward", "Brand-conscious", "Social shopper"],
    gradient: "from-rose-500 to-orange-500",
  },
  {
    id: "tech-guru",
    name: "The Tech Guru",
    emoji: "💻",
    tagline: "Innovation is your middle name",
    traits: ["Early adopter", "Gadget lover", "Performance-driven", "Specs over aesthetics"],
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    id: "deal-hunter",
    name: "The Deal Hunter",
    emoji: "🎯",
    tagline: "No deal escapes your radar",
    traits: ["Price-savvy", "Patient shopper", "Comparison expert", "Value maximizer"],
    gradient: "from-green-500 to-emerald-500",
  },
  {
    id: "quality-connoisseur",
    name: "The Quality Connoisseur",
    emoji: "✨",
    tagline: "Only the finest will do",
    traits: ["Premium taste", "Brand loyal", "Craftsmanship lover", "Timeless choices"],
    gradient: "from-amber-500 to-yellow-500",
  },
  {
    id: "explorer",
    name: "The Explorer",
    emoji: "🌍",
    tagline: "Always discovering something new",
    traits: ["Adventurous", "Variety seeker", "Open-minded", "Eclectic taste"],
    gradient: "from-violet-500 to-purple-500",
  },
  {
    id: "practical-pro",
    name: "The Practical Pro",
    emoji: "⚡",
    tagline: "Smart choices, every time",
    traits: ["Efficient", "Research-driven", "Need-based", "Balanced taste"],
    gradient: "from-slate-500 to-zinc-500",
  },
];

export type BrandTier = "love" | "meh" | "nah";

interface QuizAnswers {
  styleAnswers: StyleAnswers;
  brandRatings: Record<string, BrandTier>;
  priceTrap: "a" | "b" | null;
  dealChoice: string | null;
  categories: string[];
  budget: number | null;
}

export function computeArchetype(answers: QuizAnswers): BuyerArchetype {
  const scores: Record<string, number> = {};
  for (const a of ARCHETYPES) scores[a.id] = 0;

  // Style answers
  if (answers.styleAnswers["minimalist-vs-maximalist"] === "b") scores["trendsetter"] += 2;
  if (answers.styleAnswers["tech-vs-classic"] === "a") scores["tech-guru"] += 2;
  if (answers.styleAnswers["tech-vs-classic"] === "b") scores["quality-connoisseur"] += 1;
  if (answers.styleAnswers["outdoor-vs-indoor"] === "a") scores["explorer"] += 2;

  // Brand affinities
  const techBrands = ["Apple", "Samsung", "Sony"];
  const fashionBrands = ["Nike", "Zara", "Adidas"];
  for (const brand of techBrands) {
    if (answers.brandRatings[brand] === "love") scores["tech-guru"] += 1;
  }
  for (const brand of fashionBrands) {
    if (answers.brandRatings[brand] === "love") scores["trendsetter"] += 1;
  }
  if (answers.brandRatings["Amazon Basics"] === "love") scores["deal-hunter"] += 1;

  // Price trap
  if (answers.priceTrap === "a") {
    scores["quality-connoisseur"] += 3;
  } else if (answers.priceTrap === "b") {
    scores["deal-hunter"] += 3;
  }

  // Deal choice
  if (answers.dealChoice === "buy-now") scores["trendsetter"] += 2;
  if (answers.dealChoice === "wait-sale") scores["deal-hunter"] += 2;
  if (answers.dealChoice === "find-cheaper") scores["deal-hunter"] += 1;

  // Categories
  if (answers.categories.includes("Electronics") || answers.categories.includes("Gaming")) {
    scores["tech-guru"] += 2;
  }
  if (answers.categories.includes("Clothing")) scores["trendsetter"] += 1;
  if (answers.categories.includes("Sports")) scores["explorer"] += 1;
  if (answers.categories.length >= 5) scores["explorer"] += 2;

  // Budget
  if (answers.budget && answers.budget >= 750) scores["quality-connoisseur"] += 2;
  if (answers.budget && answers.budget <= 25) scores["deal-hunter"] += 2;

  // Practical pro gets a base score — wins when nothing else dominates
  scores["practical-pro"] += 3;

  // Find the winner
  let best = ARCHETYPES[5]; // practical-pro fallback
  let bestScore = -1;
  for (const archetype of ARCHETYPES) {
    if (scores[archetype.id] > bestScore) {
      bestScore = scores[archetype.id];
      best = archetype;
    }
  }

  return best;
}
