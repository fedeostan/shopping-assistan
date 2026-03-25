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
      <div className="relative mx-auto w-full max-w-2xl overflow-hidden rounded-2xl border border-border">
        <div className="aspect-[21/9] overflow-hidden">
          <img src={DEAL_SCENARIO.image} alt={DEAL_SCENARIO.product} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
          <p className="text-sm opacity-80">{DEAL_SCENARIO.setup}</p>
          <p className="mt-1 text-2xl font-bold">{DEAL_SCENARIO.product}</p>
          <p className="text-3xl font-bold">${DEAL_SCENARIO.originalPrice}</p>
        </div>
      </div>
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
                ✓
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
