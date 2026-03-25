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
                {selected && <div className="absolute inset-0 bg-primary/20" />}
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="text-sm font-bold text-white">{cat.name}</p>
                </div>
                {selected && (
                  <div className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground shadow-lg animate-in zoom-in-50 duration-200">
                    ✓
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
