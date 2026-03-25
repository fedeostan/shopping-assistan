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
import { computeArchetype, type BuyerArchetype } from "./data/archetypes";
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
 * Brand ratings are now "love" | "meh" | "nah" (3-tier) instead of 1-10.
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
