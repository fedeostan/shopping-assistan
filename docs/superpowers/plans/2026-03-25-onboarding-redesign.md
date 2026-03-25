# Onboarding "Shopping DNA" Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the 10-step onboarding from a boring form into an engaging "Shopping DNA" personality quiz — desktop-first, image-rich, with an intro screen explaining the purpose, and a fun buyer-archetype reveal at the end.

**Architecture:** Keep the existing persona engine + API route untouched. Replace all step components with desktop-optimized, visually rich versions. Add Welcome (intro) and Results (archetype reveal) as bookend screens. Brand rating changes from 1-10 sliders to 3-tier Love/Meh/Nah. Skip available on every step via AlertDialog confirmation. Buyer archetype is computed client-side for fun UI only — real data still flows to persona engine unchanged.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS v4, shadcn/ui (AlertDialog, Button, Progress, Dialog, Badge), tw-animate-css (already installed — provides animate-in, fade-in, slide-in-from-*, zoom-in-* utilities), Unsplash for product imagery.

---

## Parallelization Map

```
Task 1 (Foundation) ─────────┬─── Task 2 (Welcome + Results)
                              ├─── Task 3 (Location + Style Quiz)
                              ├─── Task 4 (Brand Rating + Price Trap)
                              ├─── Task 5 (Deal Scenario + Categories)
                              ├─── Task 6 (Budget + Household)
                              └─── Task 7 (Sizes + Retailers)
                                         │
                                         ▼
                              Task 8 (Main Page Orchestrator)
                                         │
                                         ▼
                              Task 9 (Cleanup + Verify)
```

Tasks 2–7 are fully independent and can run in parallel after Task 1.

---

### Task 1: Foundation — Shared Components + Data Overhaul

**Files:**
- Create: `src/app/onboarding/components/quiz-layout.tsx`
- Create: `src/app/onboarding/components/progress-bar.tsx`
- Create: `src/app/onboarding/components/skip-dialog.tsx`
- Create: `src/app/onboarding/data/archetypes.ts`
- Modify: `src/app/onboarding/data/quiz-data.ts`

- [ ] **Step 1: Add shadcn AlertDialog component**

```bash
npx shadcn@latest add alert-dialog
```

- [ ] **Step 2: Create the progress bar component**

Create `src/app/onboarding/components/progress-bar.tsx`:

```tsx
"use client";

import { cn } from "@/lib/utils";

interface ProgressBarProps {
  current: number;
  total: number;
  label?: string;
}

export function ProgressBar({ current, total, label }: ProgressBarProps) {
  const percent = ((current + 1) / total) * 100;

  return (
    <div className="flex flex-1 items-center gap-3">
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="shrink-0 text-xs font-medium text-muted-foreground">
        {label && <span className="hidden sm:inline">{label} · </span>}
        {current + 1}/{total}
      </span>
    </div>
  );
}
```

- [ ] **Step 3: Create the skip confirmation dialog**

Create `src/app/onboarding/components/skip-dialog.tsx`:

```tsx
"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SkipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmSkip: () => void;
}

export function SkipDialog({ open, onOpenChange, onConfirmSkip }: SkipDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl">Skip the quiz?</AlertDialogTitle>
          <AlertDialogDescription className="text-base leading-relaxed">
            Completing these 10 questions makes the AI work{" "}
            <span className="font-semibold text-foreground">10x better</span> for
            you. It only takes a couple minutes and helps us personalize every
            recommendation.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="flex-1">Let&apos;s do it</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirmSkip}
            className="flex-1 bg-muted text-muted-foreground hover:bg-muted/80"
          >
            Skip anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

- [ ] **Step 4: Create the QuizLayout component**

Create `src/app/onboarding/components/quiz-layout.tsx`:

```tsx
"use client";

import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { ProgressBar } from "./progress-bar";
import { STEP_META } from "../data/quiz-data";

interface QuizLayoutProps {
  step: number;
  totalSteps: number;
  onBack: () => void;
  onSkip: () => void;
  canGoBack?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}

export function QuizLayout({
  step,
  totalSteps,
  onBack,
  onSkip,
  canGoBack = true,
  children,
  footer,
}: QuizLayoutProps) {
  const meta = STEP_META[step];

  return (
    <div className="flex h-svh flex-col bg-background">
      {/* Header */}
      <header className="shrink-0 border-b border-border/40">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-6 py-4">
          {canGoBack ? (
            <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9 shrink-0">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          ) : (
            <div className="h-9 w-9 shrink-0" />
          )}
          <ProgressBar current={step} total={totalSteps} label={meta.name} />
          <button
            type="button"
            onClick={onSkip}
            className="shrink-0 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Skip
          </button>
        </div>
      </header>

      {/* Title */}
      <div className="shrink-0 mx-auto w-full max-w-4xl px-6 pt-8 pb-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight">{meta.title}</h1>
        <p className="mt-2 text-base text-muted-foreground">{meta.subtitle}</p>
      </div>

      {/* Content — scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-6 pb-8 animate-in fade-in slide-in-from-right-4 duration-300">
          {children}
        </div>
      </div>

      {/* Footer — sticky bottom */}
      {footer && (
        <div className="shrink-0 border-t border-border/40 bg-background">
          <div className="mx-auto max-w-4xl px-6 py-4">
            {footer}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create buyer archetype definitions and scoring**

Create `src/app/onboarding/data/archetypes.ts`:

```tsx
import type { StyleAnswers } from "../steps/style-quiz-step";

export interface BuyerArchetype {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  traits: string[];
  gradient: string; // Tailwind gradient classes for the reveal card
}

export const ARCHETYPES: BuyerArchetype[] = [
  {
    id: "trendsetter",
    name: "The Trendsetter",
    emoji: "\u{1F525}",
    tagline: "Always ahead of the curve",
    traits: ["Bold style choices", "Fashion-forward", "Brand-conscious", "Social shopper"],
    gradient: "from-rose-500 to-orange-500",
  },
  {
    id: "tech-guru",
    name: "The Tech Guru",
    emoji: "\u{1F4BB}",
    tagline: "Innovation is your middle name",
    traits: ["Early adopter", "Gadget lover", "Performance-driven", "Specs over aesthetics"],
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    id: "deal-hunter",
    name: "The Deal Hunter",
    emoji: "\u{1F3AF}",
    tagline: "No deal escapes your radar",
    traits: ["Price-savvy", "Patient shopper", "Comparison expert", "Value maximizer"],
    gradient: "from-green-500 to-emerald-500",
  },
  {
    id: "quality-connoisseur",
    name: "The Quality Connoisseur",
    emoji: "\u2728",
    tagline: "Only the finest will do",
    traits: ["Premium taste", "Brand loyal", "Craftsmanship lover", "Timeless choices"],
    gradient: "from-amber-500 to-yellow-500",
  },
  {
    id: "explorer",
    name: "The Explorer",
    emoji: "\u{1F30D}",
    tagline: "Always discovering something new",
    traits: ["Adventurous", "Variety seeker", "Open-minded", "Eclectic taste"],
    gradient: "from-violet-500 to-purple-500",
  },
  {
    id: "practical-pro",
    name: "The Practical Pro",
    emoji: "\u26A1",
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
```

- [ ] **Step 6: Update quiz-data.ts — add images to brands, household, budget; add `name` to STEP_META; change BrandTier type**

Modify `src/app/onboarding/data/quiz-data.ts`:

**6a.** Update `Brand` interface and data to include images:

```ts
export interface Brand {
  name: string;
  logo: string;
  category: string;
  color: string;
  image: string; // product hero image
}

export const BRANDS: Brand[] = [
  { name: "Apple", logo: "\u{1F34E}", category: "Tech", color: "bg-zinc-900", image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&h=300&fit=crop" },
  { name: "Nike", logo: "\u2713", category: "Sports", color: "bg-orange-600", image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=300&fit=crop" },
  { name: "Samsung", logo: "\u{1F4F1}", category: "Tech", color: "bg-blue-700", image: "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=400&h=300&fit=crop" },
  { name: "Zara", logo: "Z", category: "Fashion", color: "bg-black", image: "https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?w=400&h=300&fit=crop" },
  { name: "Sony", logo: "\u{1F3AE}", category: "Electronics", color: "bg-blue-900", image: "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=400&h=300&fit=crop" },
  { name: "Adidas", logo: "\u2AE8", category: "Sports", color: "bg-black", image: "https://images.unsplash.com/photo-1518002171953-a080ee817e1f?w=400&h=300&fit=crop" },
  { name: "Amazon Basics", logo: "\u{1F4E6}", category: "Value", color: "bg-amber-500", image: "https://images.unsplash.com/photo-1523474253046-8cd2748b5fd2?w=400&h=300&fit=crop" },
  { name: "IKEA", logo: "\u{1F3E0}", category: "Home", color: "bg-blue-600", image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=300&fit=crop" },
];
```

**6b.** Add `image` to `HouseholdOption`:

```ts
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
  { id: "solo", label: "Just Me", emoji: "\u{1F9D1}", description: "Shopping for one", householdSize: 1, lifeStage: "independent", image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400&h=300&fit=crop" },
  { id: "couple", label: "Me + Partner", emoji: "\u{1F46B}", description: "Two's company", householdSize: 2, lifeStage: "couple", image: "https://images.unsplash.com/photo-1516466723877-e4ec1d736c8a?w=400&h=300&fit=crop" },
  { id: "family", label: "Family", emoji: "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466}", description: "Kids in the picture", householdSize: 4, lifeStage: "parent", image: "https://images.unsplash.com/photo-1609220136736-443140cffec6?w=400&h=300&fit=crop" },
  { id: "roommates", label: "Roommates", emoji: "\u{1F3E0}", description: "Shared living, separate shopping", householdSize: 3, lifeStage: "shared", image: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&h=300&fit=crop" },
];
```

**6c.** Add `image` to budget options (move to quiz-data.ts from budget-step.tsx):

```ts
export interface BudgetOption {
  value: number;
  label: string;
  description: string;
  image: string;
}

export const BUDGET_OPTIONS: BudgetOption[] = [
  { value: 25, label: "Under $50", description: "Deals and essentials", image: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=400&h=300&fit=crop" },
  { value: 100, label: "$50 \u2013 $200", description: "Everyday purchases", image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=400&h=300&fit=crop" },
  { value: 350, label: "$200 \u2013 $500", description: "Mid-range quality", image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=300&fit=crop" },
  { value: 750, label: "$500+", description: "Premium & luxury", image: "https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=400&h=300&fit=crop" },
];
```

**6d.** Add `name` field to `StepMeta` and update all entries:

```ts
export interface StepMeta {
  name: string;
  title: string;
  subtitle: string;
}

export const STEP_META: StepMeta[] = [
  { name: "Location", title: "Where are you based?", subtitle: "So we can find the best deals and stores near you" },
  { name: "Style", title: "Pick your vibe", subtitle: "This or that \u2014 go with your gut!" },
  { name: "Brands", title: "Brand check", subtitle: "Love it, meh, or nah?" },
  { name: "Price vs Quality", title: "The price trap", subtitle: "There\u2019s no wrong answer... or is there?" },
  { name: "Deals", title: "Deal or no deal", subtitle: "What kind of shopper are you really?" },
  { name: "Categories", title: "What excites you?", subtitle: "Pick your top interests" },
  { name: "Budget", title: "Budget comfort zone", subtitle: "What do you usually spend per purchase?" },
  { name: "Household", title: "Who\u2019s this for?", subtitle: "Tell us about your household" },
  { name: "Sizes", title: "Size me up", subtitle: "So we never suggest something that won\u2019t fit" },
  { name: "Retailers", title: "Your go-to stores", subtitle: "Where do you usually end up shopping?" },
];
```

**6e.** Remove `BUDGET_MARKS` (no longer needed — replaced by `BUDGET_OPTIONS`). Remove `emoji` from `StepMeta` (no longer used).

- [ ] **Step 7: Commit**

```bash
git add src/app/onboarding/components/quiz-layout.tsx \
        src/app/onboarding/components/progress-bar.tsx \
        src/app/onboarding/components/skip-dialog.tsx \
        src/app/onboarding/data/archetypes.ts \
        src/app/onboarding/data/quiz-data.ts \
        src/components/ui/alert-dialog.tsx
git commit -m "feat(onboarding): foundation — shared layout, progress bar, skip dialog, archetypes, data overhaul"
```

---

### Task 2: Welcome + Results Steps

**Files:**
- Create: `src/app/onboarding/steps/welcome-step.tsx`
- Create: `src/app/onboarding/steps/results-step.tsx`

- [ ] **Step 1: Create the Welcome intro screen**

Create `src/app/onboarding/steps/welcome-step.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/button";

interface WelcomeStepProps {
  onStart: () => void;
  onSkip: () => void;
}

export function WelcomeStep({ onStart, onSkip }: WelcomeStepProps) {
  return (
    <div className="flex h-svh flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-lg text-center animate-in fade-in zoom-in-95 duration-500">
        {/* Icon */}
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
          <span className="text-4xl">&#x1F6CD;&#xFE0F;</span>
        </div>

        {/* Heading */}
        <h1 className="text-4xl font-bold tracking-tight">
          Let&apos;s build your
          <br />
          <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Shopping DNA
          </span>
        </h1>

        {/* Explanation */}
        <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
          Before we start, we want to get to know you better. These{" "}
          <span className="font-semibold text-foreground">10 quick questions</span> help us
          build your buyer persona so we can personalize every recommendation just for you.
        </p>

        {/* Promise */}
        <div className="mx-auto mt-6 flex max-w-sm items-center gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-left">
          <span className="text-2xl">&#x1F3C6;</span>
          <p className="text-sm text-muted-foreground">
            At the end, we&apos;ll reveal{" "}
            <span className="font-semibold text-foreground">what type of buyer you are!</span>
          </p>
        </div>

        {/* CTA */}
        <Button onClick={onStart} size="lg" className="mt-8 w-full max-w-xs text-base">
          Let&apos;s Go
        </Button>

        {/* Skip */}
        <button
          type="button"
          onClick={onSkip}
          className="mt-4 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the Results archetype reveal screen**

Create `src/app/onboarding/steps/results-step.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { BuyerArchetype } from "../data/archetypes";

interface ResultsStepProps {
  archetype: BuyerArchetype;
  onContinue: () => void;
}

export function ResultsStep({ archetype, onContinue }: ResultsStepProps) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setRevealed(true), 600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex h-svh flex-col items-center justify-center bg-background px-6">
      {/* Pre-reveal */}
      <div className="w-full max-w-lg text-center">
        <p className="text-lg font-medium text-muted-foreground animate-in fade-in duration-500">
          You&apos;re a...
        </p>

        {/* Archetype card */}
        <div
          className={`mt-6 overflow-hidden rounded-2xl bg-gradient-to-br ${archetype.gradient} p-[2px] transition-all duration-700 ${
            revealed ? "scale-100 opacity-100" : "scale-90 opacity-0"
          }`}
        >
          <div className="rounded-[14px] bg-background p-8">
            <span className="text-6xl">{archetype.emoji}</span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight">{archetype.name}</h1>
            <p className="mt-2 text-base text-muted-foreground">{archetype.tagline}</p>

            {/* Traits */}
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {archetype.traits.map((trait) => (
                <span
                  key={trait}
                  className="rounded-full border border-border bg-muted/50 px-3 py-1 text-sm font-medium"
                >
                  {trait}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div
          className={`mt-8 transition-all delay-300 duration-500 ${
            revealed ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          <Button onClick={onContinue} size="lg" className="w-full max-w-xs text-base">
            Start Shopping
          </Button>
        </div>
      </div>

      {/* Confetti dots — CSS only */}
      {revealed && (
        <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
          {Array.from({ length: 24 }, (_, i) => (
            <div
              key={i}
              className="absolute h-2 w-2 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-5%`,
                backgroundColor: ["#f43f5e", "#3b82f6", "#eab308", "#22c55e", "#a855f7", "#f97316"][i % 6],
                animation: `confetti-fall ${1.5 + Math.random() * 2}s ease-in ${Math.random() * 0.5}s forwards`,
              }}
            />
          ))}
          <style>{`
            @keyframes confetti-fall {
              0% { transform: translateY(0) rotate(0deg); opacity: 1; }
              100% { transform: translateY(100vh) rotate(${360 + Math.random() * 360}deg); opacity: 0; }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/onboarding/steps/welcome-step.tsx src/app/onboarding/steps/results-step.tsx
git commit -m "feat(onboarding): add welcome intro + buyer archetype results screens"
```

---

### Task 3: Location + Style Quiz Redesign

**Files:**
- Modify: `src/app/onboarding/steps/location-step.tsx`
- Modify: `src/app/onboarding/steps/style-quiz-step.tsx`

- [ ] **Step 1: Rewrite location step — desktop grid with larger flag cards**

Replace `src/app/onboarding/steps/location-step.tsx` entirely:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { COUNTRIES, type Country } from "../data/quiz-data";
import { cn } from "@/lib/utils";

interface LocationStepProps {
  value: Country | null;
  onChange: (country: Country) => void;
  onNext: () => void;
}

export function LocationStep({ value, onChange, onNext }: LocationStepProps) {
  const [search, setSearch] = useState("");

  const filtered = search
    ? COUNTRIES.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : COUNTRIES;

  return (
    <div className="flex flex-col gap-6">
      {/* Search */}
      <input
        type="text"
        placeholder="Search your country..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mx-auto w-full max-w-md rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm outline-none transition-colors focus:border-primary focus:bg-background"
      />

      {/* Country grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {filtered.map((country) => (
          <button
            key={country.code}
            type="button"
            onClick={() => onChange(country)}
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl border-2 px-4 py-5 transition-all",
              "hover:scale-[1.03] hover:shadow-md active:scale-[0.97]",
              value?.code === country.code
                ? "border-primary bg-primary/5 shadow-md ring-2 ring-primary/20"
                : "border-border hover:border-primary/40"
            )}
          >
            <span className="text-4xl">{country.flag}</span>
            <p className="text-sm font-semibold">{country.name}</p>
            <p className="text-xs text-muted-foreground">{country.currency}</p>
          </button>
        ))}
      </div>

      {/* Footer */}
      <div className="mx-auto w-full max-w-sm">
        <Button onClick={onNext} disabled={!value} className="w-full" size="lg">
          Continue
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite style quiz — full-width split-screen with auto-advance**

Replace `src/app/onboarding/steps/style-quiz-step.tsx` entirely:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { STYLE_PAIRS } from "../data/quiz-data";
import { cn } from "@/lib/utils";

export type StyleAnswers = Record<string, "a" | "b">;

interface StyleQuizStepProps {
  value: StyleAnswers;
  onChange: (answers: StyleAnswers) => void;
  onNext: () => void;
}

export function StyleQuizStep({ value, onChange, onNext }: StyleQuizStepProps) {
  const [currentPair, setCurrentPair] = useState(0);
  const pair = STYLE_PAIRS[currentPair];
  const allAnswered = STYLE_PAIRS.every((p) => value[p.id]);

  function pick(choice: "a" | "b") {
    const updated = { ...value, [pair.id]: choice };
    onChange(updated);

    if (currentPair < STYLE_PAIRS.length - 1) {
      setTimeout(() => setCurrentPair((prev) => prev + 1), 400);
    }
  }

  const selected = value[pair.id];

  return (
    <div className="flex flex-col gap-6">
      {/* Sub-progress */}
      <div className="flex items-center justify-center gap-2">
        {STYLE_PAIRS.map((p, i) => (
          <div
            key={p.id}
            className={cn(
              "h-2 rounded-full transition-all duration-300",
              value[p.id] ? "w-10 bg-primary" : i === currentPair ? "w-10 bg-primary/40" : "w-4 bg-muted"
            )}
          />
        ))}
      </div>

      {/* Question */}
      <p className="text-center text-xl font-semibold">{pair.question}</p>

      {/* Split screen — two large image cards side by side */}
      <div className="grid grid-cols-2 gap-4">
        {(["a", "b"] as const).map((side) => {
          const option = side === "a" ? pair.optionA : pair.optionB;
          const isSelected = selected === side;
          const otherSelected = selected && selected !== side;

          return (
            <button
              key={side}
              type="button"
              onClick={() => pick(side)}
              className={cn(
                "group relative overflow-hidden rounded-2xl border-2 transition-all duration-300",
                "hover:shadow-lg active:scale-[0.98]",
                isSelected
                  ? "border-primary ring-4 ring-primary/20 scale-[1.02]"
                  : otherSelected
                    ? "border-border opacity-60"
                    : "border-border hover:border-primary/40 hover:scale-[1.01]"
              )}
            >
              {/* Image */}
              <div className="relative aspect-[4/3] overflow-hidden">
                <img
                  src={option.image}
                  alt={option.label}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                {/* Label */}
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <p className="text-xl font-bold text-white">{option.label}</p>
                </div>

                {/* Check mark */}
                {isSelected && (
                  <div className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-lg text-primary-foreground shadow-lg animate-in zoom-in-50 duration-200">
                    &#x2713;
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Navigation */}
      <div className="mx-auto flex w-full max-w-sm gap-3">
        {currentPair > 0 && (
          <Button variant="outline" onClick={() => setCurrentPair((prev) => prev - 1)} className="flex-1">
            Previous
          </Button>
        )}
        <Button onClick={onNext} disabled={!allAnswered} className="flex-1" size="lg">
          {allAnswered ? "Continue" : `${Object.keys(value).length}/${STYLE_PAIRS.length} answered`}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/onboarding/steps/location-step.tsx src/app/onboarding/steps/style-quiz-step.tsx
git commit -m "feat(onboarding): redesign location (5-col flag grid) + style quiz (split-screen)"
```

---

### Task 4: Brand Rating + Price Trap Redesign

**Files:**
- Modify: `src/app/onboarding/steps/brand-rating-step.tsx`
- Modify: `src/app/onboarding/steps/price-trap-step.tsx`

- [ ] **Step 1: Rewrite brand rating — 3-tier Love/Meh/Nah with product images**

Replace `src/app/onboarding/steps/brand-rating-step.tsx` entirely:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { BRANDS } from "../data/quiz-data";
import { cn } from "@/lib/utils";
import type { BrandTier } from "../data/archetypes";

export type BrandRatings = Record<string, BrandTier>;

const TIERS: { value: BrandTier; label: string; emoji: string; color: string }[] = [
  { value: "love", label: "Love", emoji: "\u2764\uFE0F", color: "border-rose-500 bg-rose-500/10 text-rose-600" },
  { value: "meh", label: "Meh", emoji: "\u{1F610}", color: "border-zinc-400 bg-zinc-400/10 text-zinc-500" },
  { value: "nah", label: "Nah", emoji: "\u{1F44E}", color: "border-slate-400 bg-slate-400/10 text-slate-500" },
];

interface BrandRatingStepProps {
  value: BrandRatings;
  onChange: (ratings: BrandRatings) => void;
  onNext: () => void;
}

export function BrandRatingStep({ value, onChange, onNext }: BrandRatingStepProps) {
  const ratedCount = Object.keys(value).length;

  function setTier(brand: string, tier: BrandTier) {
    onChange({ ...value, [brand]: tier });
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-center text-sm text-muted-foreground">
        Rate at least 3 brands. Skip any you don&apos;t know.
      </p>

      {/* Brand grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {BRANDS.map((brand) => {
          const currentTier = value[brand.name];

          return (
            <div
              key={brand.name}
              className={cn(
                "overflow-hidden rounded-xl border-2 transition-all",
                currentTier ? "border-border" : "border-border/50"
              )}
            >
              {/* Product image */}
              <div className="relative aspect-[4/3] overflow-hidden">
                <img
                  src={brand.image}
                  alt={brand.name}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="text-sm font-bold text-white">{brand.name}</p>
                  <p className="text-xs text-white/70">{brand.category}</p>
                </div>
              </div>

              {/* Tier buttons */}
              <div className="flex gap-1 p-2">
                {TIERS.map((tier) => (
                  <button
                    key={tier.value}
                    type="button"
                    onClick={() => setTier(brand.name, tier.value)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1 rounded-lg border-2 py-2 text-xs font-semibold transition-all",
                      "hover:scale-[1.02] active:scale-[0.98]",
                      currentTier === tier.value
                        ? tier.color
                        : "border-transparent hover:bg-muted"
                    )}
                  >
                    <span>{tier.emoji}</span>
                    <span className="hidden sm:inline">{tier.label}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mx-auto w-full max-w-sm">
        <Button onClick={onNext} disabled={ratedCount < 3} className="w-full" size="lg">
          {ratedCount < 3 ? `Rate at least 3 (${ratedCount}/3)` : "Continue"}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite price trap — game-show split with VS badge**

Replace `src/app/onboarding/steps/price-trap-step.tsx` entirely:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { PRICE_TRAP } from "../data/quiz-data";
import { cn } from "@/lib/utils";

interface PriceTrapStepProps {
  value: "a" | "b" | null;
  onChange: (choice: "a" | "b") => void;
  onNext: () => void;
}

export function PriceTrapStep({ value, onChange, onNext }: PriceTrapStepProps) {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-center text-lg font-semibold">{PRICE_TRAP.question}</p>

      {/* Side-by-side product cards with VS badge */}
      <div className="relative grid grid-cols-2 gap-6">
        {/* VS badge */}
        <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border-4 border-background bg-muted text-sm font-black text-muted-foreground shadow-lg">
            VS
          </span>
        </div>

        {/* Option A — Premium */}
        <button
          type="button"
          onClick={() => onChange("a")}
          className={cn(
            "group relative flex flex-col overflow-hidden rounded-2xl border-2 transition-all duration-300",
            "hover:shadow-lg active:scale-[0.98]",
            value === "a"
              ? "border-primary ring-4 ring-primary/20 scale-[1.02]"
              : value === "b"
                ? "border-border opacity-60"
                : "border-border hover:border-primary/40 hover:scale-[1.01]"
          )}
        >
          <div className="relative aspect-square overflow-hidden">
            <img
              src={PRICE_TRAP.optionA.image}
              alt={PRICE_TRAP.optionA.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute top-3 left-3 rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-white">
              {PRICE_TRAP.optionA.quality}
            </div>
            {value === "a" && (
              <div className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground shadow-lg animate-in zoom-in-50 duration-200">
                &#x2713;
              </div>
            )}
          </div>
          <div className="p-4 text-center">
            <p className="text-base font-bold">{PRICE_TRAP.optionA.brand}</p>
            <p className="text-xs text-muted-foreground">{PRICE_TRAP.optionA.name}</p>
            <p className="mt-2 text-2xl font-bold text-primary">${PRICE_TRAP.optionA.price}</p>
          </div>
        </button>

        {/* Option B — Value */}
        <button
          type="button"
          onClick={() => onChange("b")}
          className={cn(
            "group relative flex flex-col overflow-hidden rounded-2xl border-2 transition-all duration-300",
            "hover:shadow-lg active:scale-[0.98]",
            value === "b"
              ? "border-green-500 ring-4 ring-green-500/20 scale-[1.02]"
              : value === "a"
                ? "border-border opacity-60"
                : "border-border hover:border-green-500/40 hover:scale-[1.01]"
          )}
        >
          <div className="relative aspect-square overflow-hidden">
            <img
              src={PRICE_TRAP.optionB.image}
              alt={PRICE_TRAP.optionB.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute top-3 left-3 rounded-full bg-green-500 px-3 py-1 text-xs font-bold text-white">
              {PRICE_TRAP.optionB.quality}
            </div>
            {value === "b" && (
              <div className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-green-500 text-sm text-white shadow-lg animate-in zoom-in-50 duration-200">
                &#x2713;
              </div>
            )}
          </div>
          <div className="p-4 text-center">
            <p className="text-base font-bold">{PRICE_TRAP.optionB.brand}</p>
            <p className="text-xs text-muted-foreground">{PRICE_TRAP.optionB.name}</p>
            <p className="mt-2 text-2xl font-bold text-green-500">${PRICE_TRAP.optionB.price}</p>
          </div>
        </button>
      </div>

      <div className="mx-auto w-full max-w-sm">
        <Button onClick={onNext} disabled={!value} className="w-full" size="lg">
          Continue
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/onboarding/steps/brand-rating-step.tsx src/app/onboarding/steps/price-trap-step.tsx
git commit -m "feat(onboarding): redesign brand rating (3-tier Love/Meh/Nah) + price trap (VS split)"
```

---

### Task 5: Deal Scenario + Categories Redesign

**Files:**
- Modify: `src/app/onboarding/steps/deal-scenario-step.tsx`
- Modify: `src/app/onboarding/steps/categories-step.tsx`

- [ ] **Step 1: Rewrite deal scenario — hero image + horizontal strategy cards**

Replace `src/app/onboarding/steps/deal-scenario-step.tsx` entirely:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { DEAL_SCENARIO } from "../data/quiz-data";
import { cn } from "@/lib/utils";

interface DealScenarioStepProps {
  value: string | null;
  onChange: (optionId: string) => void;
  onNext: () => void;
}

export function DealScenarioStep({ value, onChange, onNext }: DealScenarioStepProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* Hero scenario card */}
      <div className="relative mx-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-border">
        <div className="aspect-[21/9] overflow-hidden">
          <img
            src={DEAL_SCENARIO.image}
            alt={DEAL_SCENARIO.product}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
          <p className="text-sm opacity-80">{DEAL_SCENARIO.setup}</p>
          <p className="mt-1 text-2xl font-bold">{DEAL_SCENARIO.product}</p>
          <p className="text-3xl font-bold">${DEAL_SCENARIO.originalPrice}</p>
        </div>
      </div>

      {/* Strategy cards — horizontal on desktop */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {DEAL_SCENARIO.options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={cn(
              "relative flex flex-col items-center gap-3 rounded-xl border-2 p-5 text-center transition-all duration-200",
              "hover:scale-[1.02] hover:shadow-md active:scale-[0.98]",
              value === option.id
                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                : "border-border hover:border-primary/40"
            )}
          >
            <span className="text-3xl">{option.emoji}</span>
            <p className="text-base font-bold">{option.label}</p>
            <p className="text-xs text-muted-foreground">{option.description}</p>
            {value === option.id && (
              <div className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                &#x2713;
              </div>
            )}
          </button>
        ))}
      </div>

      <div className="mx-auto w-full max-w-sm">
        <Button onClick={onNext} disabled={!value} className="w-full" size="lg">
          Continue
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite categories — large 3-col image grid with overlay text**

Replace `src/app/onboarding/steps/categories-step.tsx` entirely:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { CATEGORIES } from "../data/quiz-data";
import { cn } from "@/lib/utils";

interface CategoriesStepProps {
  value: string[];
  onChange: (categories: string[]) => void;
  onNext: () => void;
}

export function CategoriesStep({ value, onChange, onNext }: CategoriesStepProps) {
  function toggle(key: string) {
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-center text-sm text-muted-foreground">
        Pick at least 2 — the more the better!
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {CATEGORIES.map((cat) => {
          const selected = value.includes(cat.key);
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => toggle(cat.key)}
              className={cn(
                "group relative overflow-hidden rounded-xl border-2 transition-all duration-200",
                "hover:scale-[1.03] hover:shadow-lg active:scale-[0.97]",
                selected
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-border hover:border-primary/40"
              )}
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <img
                  src={cat.image}
                  alt={cat.name}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                {/* Selection overlay */}
                {selected && <div className="absolute inset-0 bg-primary/20" />}

                {/* Label */}
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="text-sm font-bold text-white">{cat.name}</p>
                </div>

                {/* Check */}
                {selected && (
                  <div className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground shadow-lg animate-in zoom-in-50 duration-200">
                    &#x2713;
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mx-auto w-full max-w-sm">
        <Button onClick={onNext} disabled={value.length < 2} className="w-full" size="lg">
          {value.length < 2 ? `Pick at least 2 (${value.length}/2)` : `Continue with ${value.length} categories`}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/onboarding/steps/deal-scenario-step.tsx src/app/onboarding/steps/categories-step.tsx
git commit -m "feat(onboarding): redesign deal scenario (hero card) + categories (large image grid)"
```

---

### Task 6: Budget + Household Redesign

**Files:**
- Modify: `src/app/onboarding/steps/budget-step.tsx`
- Modify: `src/app/onboarding/steps/household-step.tsx`

- [ ] **Step 1: Rewrite budget step — lifestyle image cards in 2x2 grid**

Replace `src/app/onboarding/steps/budget-step.tsx` entirely:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { BUDGET_OPTIONS } from "../data/quiz-data";
import { cn } from "@/lib/utils";

interface BudgetStepProps {
  value: number | null;
  onChange: (budget: number) => void;
  onNext: () => void;
}

export function BudgetStep({ value, onChange, onNext }: BudgetStepProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {BUDGET_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "group relative overflow-hidden rounded-xl border-2 transition-all duration-200",
              "hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]",
              value === opt.value
                ? "border-primary ring-2 ring-primary/20"
                : "border-border hover:border-primary/40"
            )}
          >
            <div className="relative aspect-[16/9] overflow-hidden">
              <img
                src={opt.image}
                alt={opt.label}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                <p className="text-xl font-bold">{opt.label}</p>
                <p className="text-sm opacity-80">{opt.description}</p>
              </div>
              {value === opt.value && (
                <div className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground shadow-lg animate-in zoom-in-50 duration-200">
                  &#x2713;
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      <div className="mx-auto w-full max-w-sm">
        <Button onClick={onNext} disabled={value === null} className="w-full" size="lg">
          Continue
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Rewrite household step — lifestyle photo cards**

Replace `src/app/onboarding/steps/household-step.tsx` entirely:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { HOUSEHOLD_OPTIONS } from "../data/quiz-data";
import { cn } from "@/lib/utils";

interface HouseholdStepProps {
  value: string | null;
  onChange: (householdId: string) => void;
  onNext: () => void;
}

export function HouseholdStep({ value, onChange, onNext }: HouseholdStepProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4">
        {HOUSEHOLD_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              "group relative overflow-hidden rounded-xl border-2 transition-all duration-200",
              "hover:scale-[1.03] hover:shadow-lg active:scale-[0.97]",
              value === opt.id
                ? "border-primary ring-2 ring-primary/20"
                : "border-border hover:border-primary/40"
            )}
          >
            <div className="relative aspect-[4/3] overflow-hidden">
              <img
                src={opt.image}
                alt={opt.label}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                <p className="text-lg font-bold">{opt.label}</p>
                <p className="text-sm opacity-80">{opt.description}</p>
              </div>
              {value === opt.id && (
                <div className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground shadow-lg animate-in zoom-in-50 duration-200">
                  &#x2713;
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      <div className="mx-auto w-full max-w-sm">
        <Button onClick={onNext} disabled={!value} className="w-full" size="lg">
          Continue
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/onboarding/steps/budget-step.tsx src/app/onboarding/steps/household-step.tsx
git commit -m "feat(onboarding): redesign budget (lifestyle images) + household (photo cards)"
```

---

### Task 7: Sizes + Retailers Redesign

**Files:**
- Modify: `src/app/onboarding/steps/sizes-step.tsx`
- Modify: `src/app/onboarding/steps/retailers-step.tsx`

- [ ] **Step 1: Rewrite sizes step — clean card-based sections**

Replace `src/app/onboarding/steps/sizes-step.tsx` entirely:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TSHIRT_SIZES, SHOE_SIZES_US, SHOE_SIZES_EU } from "../data/quiz-data";
import { cn } from "@/lib/utils";

export interface SizeData {
  tshirt: string;
  shoe: string;
  shoeSystem: "US" | "EU";
}

interface SizesStepProps {
  value: SizeData;
  onChange: (sizes: SizeData) => void;
  onNext: () => void;
}

export function SizesStep({ value, onChange, onNext }: SizesStepProps) {
  const [shoeSystem, setShoeSystem] = useState<"US" | "EU">(value.shoeSystem || "US");
  const shoeSizes = shoeSystem === "US" ? SHOE_SIZES_US : SHOE_SIZES_EU;

  function updateField<K extends keyof SizeData>(key: K, val: SizeData[K]) {
    onChange({ ...value, [key]: val, shoeSystem });
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      {/* T-shirt size */}
      <div className="rounded-xl border border-border p-5">
        <h3 className="mb-4 text-base font-semibold">&#x{1F455} T-Shirt Size</h3>
        <div className="flex flex-wrap gap-2">
          {TSHIRT_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => updateField("tshirt", size)}
              className={cn(
                "rounded-lg border-2 px-5 py-2.5 text-sm font-semibold transition-all",
                "hover:scale-105 active:scale-95",
                value.tshirt === size
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:border-primary/40"
              )}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* Shoe size */}
      <div className="rounded-xl border border-border p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold">&#x{1F45F} Shoe Size</h3>
          <div className="flex overflow-hidden rounded-lg border border-border">
            {(["US", "EU"] as const).map((sys) => (
              <button
                key={sys}
                type="button"
                onClick={() => {
                  setShoeSystem(sys);
                  onChange({ ...value, shoe: "", shoeSystem: sys });
                }}
                className={cn(
                  "px-4 py-1.5 text-xs font-semibold transition-colors",
                  shoeSystem === sys ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
              >
                {sys}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {shoeSizes.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => updateField("shoe", size)}
              className={cn(
                "rounded-lg border-2 px-4 py-2 text-sm font-semibold transition-all",
                "hover:scale-105 active:scale-95",
                value.shoe === size
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:border-primary/40"
              )}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Optional — you can always update these later
      </p>

      <div className="mx-auto w-full max-w-sm">
        <Button onClick={onNext} className="w-full" size="lg">
          {value.tshirt || value.shoe ? "Continue" : "Skip for now"}
        </Button>
      </div>
    </div>
  );
}
```

**Note:** The emoji `👕` and `👟` use actual Unicode characters in the real file. The escape sequences above represent them. Use the literal emoji characters when creating the file.

- [ ] **Step 2: Rewrite retailers step — large brand-color cards**

Replace `src/app/onboarding/steps/retailers-step.tsx` entirely:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { RETAILERS } from "../data/quiz-data";
import { cn } from "@/lib/utils";

interface RetailersStepProps {
  value: string[];
  onChange: (retailers: string[]) => void;
  onNext: () => void;
}

export function RetailersStep({ value, onChange, onNext }: RetailersStepProps) {
  function toggle(name: string) {
    onChange(value.includes(name) ? value.filter((r) => r !== name) : [...value, name]);
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-center text-sm text-muted-foreground">
        Select all that apply — helps us find the best prices
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {RETAILERS.map((retailer) => {
          const selected = value.includes(retailer.name);
          return (
            <button
              key={retailer.name}
              type="button"
              onClick={() => toggle(retailer.name)}
              className={cn(
                "group relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 p-6 transition-all duration-200",
                "hover:scale-[1.03] hover:shadow-md active:scale-[0.97]",
                selected
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-border hover:border-primary/40"
              )}
            >
              <div
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-2xl text-2xl text-white transition-transform group-hover:scale-110",
                  retailer.color
                )}
              >
                {retailer.logo}
              </div>
              <p className="text-sm font-bold">{retailer.name}</p>
              {selected && (
                <div className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground animate-in zoom-in-50 duration-200">
                  &#x2713;
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="mx-auto w-full max-w-sm">
        <Button onClick={onNext} className="w-full" size="lg">
          {value.length === 0 ? "Skip" : `Finish with ${value.length} stores`}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/onboarding/steps/sizes-step.tsx src/app/onboarding/steps/retailers-step.tsx
git commit -m "feat(onboarding): redesign sizes (card sections) + retailers (brand-color cards)"
```

---

### Task 8: Main Page Orchestrator Rewrite

**Files:**
- Modify: `src/app/onboarding/page.tsx`

This is the critical integration task — wires together welcome, 10 quiz steps, results, skip dialog, and updated `buildPersonaPayload` for 3-tier brand ratings.

- [ ] **Step 1: Rewrite `page.tsx` with new flow: welcome → quiz → results**

Replace `src/app/onboarding/page.tsx` entirely:

```tsx
"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { QuizLayout } from "./components/quiz-layout";
import { SkipDialog } from "./components/skip-dialog";
import { WelcomeStep } from "./steps/welcome-step";
import { ResultsStep } from "./steps/results-step";
import { LocationStep } from "./steps/location-step";
import { StyleQuizStep, type StyleAnswers } from "./steps/style-quiz-step";
import { BrandRatingStep, type BrandRatings } from "./steps/brand-rating-step";
import { PriceTrapStep } from "./steps/price-trap-step";
import { DealScenarioStep } from "./steps/deal-scenario-step";
import { CategoriesStep } from "./steps/categories-step";
import { BudgetStep } from "./steps/budget-step";
import { HouseholdStep } from "./steps/household-step";
import { SizesStep, type SizeData } from "./steps/sizes-step";
import { RetailersStep } from "./steps/retailers-step";
import { STYLE_PAIRS, DEAL_SCENARIO, HOUSEHOLD_OPTIONS } from "./data/quiz-data";
import { computeArchetype, type BrandTier, type BuyerArchetype } from "./data/archetypes";
import type { Country } from "./data/quiz-data";

const TOTAL_QUIZ_STEPS = 10;

// step: -1 = welcome, 0-9 = quiz, 10 = results
type Step = -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

interface OnboardingState {
  location: Country | null;
  styleAnswers: StyleAnswers;
  brandRatings: BrandRatings;
  priceTrap: "a" | "b" | null;
  dealChoice: string | null;
  categories: string[];
  budget: number | null;
  household: string | null;
  sizes: SizeData;
  retailers: string[];
}

const INITIAL_STATE: OnboardingState = {
  location: null,
  styleAnswers: {},
  brandRatings: {},
  priceTrap: null,
  dealChoice: null,
  categories: [],
  budget: null,
  household: null,
  sizes: { tshirt: "", shoe: "", shoeSystem: "US" },
  retailers: [],
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(-1);
  const [state, setState] = useState<OnboardingState>(INITIAL_STATE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSkipDialog, setShowSkipDialog] = useState(false);
  const [archetype, setArchetype] = useState<BuyerArchetype | null>(null);

  const goNext = useCallback(() => setStep((s) => Math.min(s + 1, 10) as Step), []);
  const goBack = useCallback(() => setStep((s) => Math.max(s - 1, -1) as Step), []);

  function handleSkip() {
    router.push("/");
  }

  async function handleSubmit() {
    setLoading(true);
    setError(null);

    const payload = buildPersonaPayload(state);

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      // Compute archetype for the reveal (UI only)
      const result = computeArchetype({
        styleAnswers: state.styleAnswers,
        brandRatings: state.brandRatings,
        priceTrap: state.priceTrap,
        dealChoice: state.dealChoice,
        categories: state.categories,
        budget: state.budget,
      });
      setArchetype(result);
      setStep(10);
    } catch {
      setError("Network error. Please check your connection and try again.");
      setLoading(false);
    }
  }

  // Last quiz step submits data, then shows results
  function handleLastStep() {
    handleSubmit();
  }

  // --- Welcome screen ---
  if (step === -1) {
    return (
      <>
        <WelcomeStep onStart={goNext} onSkip={() => setShowSkipDialog(true)} />
        <SkipDialog
          open={showSkipDialog}
          onOpenChange={setShowSkipDialog}
          onConfirmSkip={handleSkip}
        />
      </>
    );
  }

  // --- Results screen ---
  if (step === 10 && archetype) {
    return <ResultsStep archetype={archetype} onContinue={() => router.push("/")} />;
  }

  // --- Quiz steps 0-9 ---
  const quizStep = step as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

  const steps: Record<number, React.ReactNode> = {
    0: (
      <LocationStep
        value={state.location}
        onChange={(v) => setState((s) => ({ ...s, location: v }))}
        onNext={goNext}
      />
    ),
    1: (
      <StyleQuizStep
        value={state.styleAnswers}
        onChange={(v) => setState((s) => ({ ...s, styleAnswers: v }))}
        onNext={goNext}
      />
    ),
    2: (
      <BrandRatingStep
        value={state.brandRatings}
        onChange={(v) => setState((s) => ({ ...s, brandRatings: v }))}
        onNext={goNext}
      />
    ),
    3: (
      <PriceTrapStep
        value={state.priceTrap}
        onChange={(v) => setState((s) => ({ ...s, priceTrap: v }))}
        onNext={goNext}
      />
    ),
    4: (
      <DealScenarioStep
        value={state.dealChoice}
        onChange={(v) => setState((s) => ({ ...s, dealChoice: v }))}
        onNext={goNext}
      />
    ),
    5: (
      <CategoriesStep
        value={state.categories}
        onChange={(v) => setState((s) => ({ ...s, categories: v }))}
        onNext={goNext}
      />
    ),
    6: (
      <BudgetStep
        value={state.budget}
        onChange={(v) => setState((s) => ({ ...s, budget: v }))}
        onNext={goNext}
      />
    ),
    7: (
      <HouseholdStep
        value={state.household}
        onChange={(v) => setState((s) => ({ ...s, household: v }))}
        onNext={goNext}
      />
    ),
    8: (
      <SizesStep
        value={state.sizes}
        onChange={(v) => setState((s) => ({ ...s, sizes: v }))}
        onNext={goNext}
      />
    ),
    9: (
      <RetailersStep
        value={state.retailers}
        onChange={(v) => setState((s) => ({ ...s, retailers: v }))}
        onNext={handleLastStep}
      />
    ),
  };

  return (
    <>
      <QuizLayout
        step={quizStep}
        totalSteps={TOTAL_QUIZ_STEPS}
        onBack={goBack}
        onSkip={() => setShowSkipDialog(true)}
        canGoBack={quizStep > 0}
      >
        {error && (
          <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-center text-sm text-destructive">
            {error}
          </div>
        )}
        {steps[quizStep]}
      </QuizLayout>

      <SkipDialog
        open={showSkipDialog}
        onOpenChange={setShowSkipDialog}
        onConfirmSkip={handleSkip}
      />

      {loading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-sm font-medium text-muted-foreground">
            Building your shopping profile...
          </p>
        </div>
      )}
    </>
  );
}

/**
 * Transform quiz answers into the persona payload the API expects.
 * NOTE: Brand ratings are now "love" | "meh" | "nah" (3-tier) instead of 1-10.
 */
function buildPersonaPayload(state: OnboardingState) {
  // --- Style quiz -> featurePreferences + lifeStage ---
  const featurePreferences: Record<string, number> = {};
  const lifeStages: string[] = [];

  for (const pair of STYLE_PAIRS) {
    const choice = state.styleAnswers[pair.id];
    if (!choice) continue;
    const option = choice === "a" ? pair.optionA : pair.optionB;
    for (const [key, val] of Object.entries(option.traits)) {
      featurePreferences[key] = (featurePreferences[key] ?? 0) + val;
    }
    if (option.lifeStage) lifeStages.push(option.lifeStage);
  }

  // Normalize feature prefs to -1..1 range
  const maxFeat = Math.max(1, ...Object.values(featurePreferences));
  for (const key of Object.keys(featurePreferences)) {
    featurePreferences[key] = featurePreferences[key] / maxFeat;
  }

  // --- Brand ratings -> brandAffinities (3-tier: love=+1, meh=0, nah=-1) ---
  const brandAffinities: Record<string, number> = {};
  for (const [brand, tier] of Object.entries(state.brandRatings)) {
    brandAffinities[brand] = tier === "love" ? 1 : tier === "nah" ? -1 : 0;
  }

  // --- Price trap -> priceQualitySpectrum ---
  const priceQualitySpectrum = state.priceTrap === "a" ? 0.7 : state.priceTrap === "b" ? -0.5 : 0;

  // --- Deal scenario -> promotionResponsiveness ---
  const dealOption = DEAL_SCENARIO.options.find((o) => o.id === state.dealChoice);
  const promotionResponsiveness = dealOption?.promotionResponsiveness ?? 0.5;

  // --- Categories -> categoryInterests ---
  const categoryInterests: Record<string, number> = {};
  for (const cat of state.categories) {
    categoryInterests[cat] = 1.0;
  }

  // --- Household -> householdSize + lifeStage ---
  const householdMatch = HOUSEHOLD_OPTIONS.find((h) => h.id === state.household);

  // --- Sizes -> sizeData ---
  const sizeData: Record<string, string> = {};
  if (state.sizes.tshirt) sizeData["tops"] = state.sizes.tshirt;
  if (state.sizes.shoe) {
    sizeData["shoes"] = `${state.sizes.shoe} ${state.sizes.shoeSystem}`;
  }

  const lifeStage = householdMatch?.lifeStage ?? lifeStages[0] ?? undefined;

  return {
    country: state.location?.code ?? "US",
    currency: state.location?.currency ?? "USD",
    locale: state.location?.locale ?? "en",
    brandAffinities,
    priceQualitySpectrum,
    preferredRetailers: state.retailers,
    sizeData,
    categoryInterests,
    featurePreferences,
    promotionResponsiveness,
    averageOrderValue: state.budget ?? undefined,
    householdSize: householdMatch?.householdSize ?? 1,
    lifeStage,
  };
}
```

- [ ] **Step 2: Verify the build compiles**

```bash
npm run build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/onboarding/page.tsx
git commit -m "feat(onboarding): rewrite orchestrator — welcome/quiz/results flow, skip dialog, 3-tier brands"
```

---

### Task 9: Cleanup + Verify

**Files:**
- Delete: `src/app/onboarding/components/step-container.tsx`
- Delete: `src/app/onboarding/components/progress-dots.tsx`
- Delete: `src/app/onboarding/components/image-card.tsx`

- [ ] **Step 1: Delete old unused components**

```bash
rm src/app/onboarding/components/step-container.tsx
rm src/app/onboarding/components/progress-dots.tsx
rm src/app/onboarding/components/image-card.tsx
```

- [ ] **Step 2: Verify no broken imports**

```bash
npm run build
```

Expected: Build succeeds. If any file still imports the deleted components, fix the import.

- [ ] **Step 3: Run linter**

```bash
npm run lint
```

Expected: No errors related to onboarding files.

- [ ] **Step 4: Visually verify in browser**

```bash
npm run dev
```

Open `http://localhost:3000/onboarding` and verify:
1. Welcome screen shows with explanation and "Let's Go" button
2. Skip link opens confirmation dialog with "10x better" message
3. Each of the 10 quiz steps renders with new desktop layout and real images
4. Brand rating uses Love/Meh/Nah buttons (no sliders)
5. Progress bar shows step name and fills correctly
6. Results page shows buyer archetype with animation and confetti
7. "Start Shopping" redirects to chat

- [ ] **Step 5: Commit cleanup**

```bash
git add -A
git commit -m "chore(onboarding): remove old step-container, progress-dots, image-card components"
```
