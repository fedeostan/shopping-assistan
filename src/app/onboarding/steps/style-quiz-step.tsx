"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { STYLE_PAIRS } from "../data/quiz-data";
import { cn } from "@/lib/utils";

export type StyleAnswers = Record<string, "a" | "b">;

interface StyleQuizStepProps {
  value: StyleAnswers;
  onChange: (answers: StyleAnswers) => void;
  onNext: () => void;
}

export function StyleQuizStep({ value, onChange, onNext }: StyleQuizStepProps) {
  const [currentPair, setCurrentPair] = useState(0);
  const pair = STYLE_PAIRS[currentPair];
  const allAnswered = STYLE_PAIRS.every((p) => value[p.id]);

  function pick(choice: "a" | "b") {
    const updated = { ...value, [pair.id]: choice };
    onChange(updated);

    if (currentPair < STYLE_PAIRS.length - 1) {
      setTimeout(() => setCurrentPair((prev) => prev + 1), 400);
    }
  }

  const selected = value[pair.id];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-center gap-2">
        {STYLE_PAIRS.map((p, i) => (
          <div
            key={p.id}
            className={cn(
              "h-2 rounded-full transition-all duration-300",
              value[p.id] ? "w-10 bg-primary" : i === currentPair ? "w-10 bg-primary/40" : "w-4 bg-muted"
            )}
          />
        ))}
      </div>
      <p className="text-center text-xl font-semibold">{pair.question}</p>
      <div className="grid grid-cols-2 gap-4">
        {(["a", "b"] as const).map((side) => {
          const option = side === "a" ? pair.optionA : pair.optionB;
          const isSelected = selected === side;
          const otherSelected = selected && selected !== side;

          return (
            <button
              key={side}
              type="button"
              onClick={() => pick(side)}
              className={cn(
                "group relative overflow-hidden rounded-2xl border-2 transition-all duration-300",
                "hover:shadow-lg active:scale-[0.98]",
                isSelected
                  ? "border-primary ring-4 ring-primary/20 scale-[1.02]"
                  : otherSelected
                    ? "border-border opacity-60"
                    : "border-border hover:border-primary/40 hover:scale-[1.01]"
              )}
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <img
                  src={option.image}
                  alt={option.label}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <p className="text-xl font-bold text-white">{option.label}</p>
                </div>
                {isSelected && (
                  <div className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-lg text-primary-foreground shadow-lg animate-in zoom-in-50 duration-200">
                    ✓
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <div className="mx-auto flex w-full max-w-sm gap-3">
        {currentPair > 0 && (
          <Button variant="outline" onClick={() => setCurrentPair((prev) => prev - 1)} className="flex-1">
            Previous
          </Button>
        )}
        <Button onClick={onNext} disabled={!allAnswered} className="flex-1" size="lg">
          {allAnswered ? "Continue" : `${Object.keys(value).length}/${STYLE_PAIRS.length} answered`}
        </Button>
      </div>
    </div>
  );
}
