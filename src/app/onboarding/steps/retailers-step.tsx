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
                  ✓
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
