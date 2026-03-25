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
      <div className="rounded-xl border border-border p-5">
        <h3 className="mb-4 text-base font-semibold">👕 T-Shirt Size</h3>
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
      <div className="rounded-xl border border-border p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold">👟 Shoe Size</h3>
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
