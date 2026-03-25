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
                  ✓
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
