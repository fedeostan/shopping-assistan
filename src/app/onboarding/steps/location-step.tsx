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
      <input
        type="text"
        placeholder="Search your country..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mx-auto w-full max-w-md rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm outline-none transition-colors focus:border-primary focus:bg-background"
      />
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
      <div className="mx-auto w-full max-w-sm">
        <Button onClick={onNext} disabled={!value} className="w-full" size="lg">
          Continue
        </Button>
      </div>
    </div>
  );
}
