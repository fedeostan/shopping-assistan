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
                  ✓
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
