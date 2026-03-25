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
      <div className="relative grid grid-cols-2 gap-6">
        <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
          <span className="flex h-12 w-12 items-center justify-center rounded-full border-4 border-background bg-muted text-sm font-black text-muted-foreground shadow-lg">
            VS
          </span>
        </div>
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
                ✓
              </div>
            )}
          </div>
          <div className="p-4 text-center">
            <p className="text-base font-bold">{PRICE_TRAP.optionA.brand}</p>
            <p className="text-xs text-muted-foreground">{PRICE_TRAP.optionA.name}</p>
            <p className="mt-2 text-2xl font-bold text-primary">${PRICE_TRAP.optionA.price}</p>
          </div>
        </button>
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
                ✓
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
