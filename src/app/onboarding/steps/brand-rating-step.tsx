"use client";

import { Button } from "@/components/ui/button";
import { BRANDS } from "../data/quiz-data";
import { cn } from "@/lib/utils";
import type { BrandTier } from "../data/archetypes";

export type BrandRatings = Record<string, BrandTier>;

const TIERS: { value: BrandTier; label: string; emoji: string; color: string }[] = [
  { value: "love", label: "Love", emoji: "❤️", color: "border-rose-500 bg-rose-500/10 text-rose-600" },
  { value: "meh", label: "Meh", emoji: "😐", color: "border-zinc-400 bg-zinc-400/10 text-zinc-500" },
  { value: "nah", label: "Nah", emoji: "👎", color: "border-slate-400 bg-slate-400/10 text-slate-500" },
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
