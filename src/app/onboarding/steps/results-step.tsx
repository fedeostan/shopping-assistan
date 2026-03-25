"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { BuyerArchetype } from "../data/archetypes";

interface ResultsStepProps {
  archetype: BuyerArchetype;
  onContinue: () => void;
}

export function ResultsStep({ archetype, onContinue }: ResultsStepProps) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setRevealed(true), 600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex h-svh flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-lg text-center">
        <p className="text-lg font-medium text-muted-foreground animate-in fade-in duration-500">
          You&apos;re a...
        </p>
        <div
          className={`mt-6 overflow-hidden rounded-2xl bg-gradient-to-br ${archetype.gradient} p-[2px] transition-all duration-700 ${
            revealed ? "scale-100 opacity-100" : "scale-90 opacity-0"
          }`}
        >
          <div className="rounded-[14px] bg-background p-8">
            <span className="text-6xl">{archetype.emoji}</span>
            <h1 className="mt-4 text-3xl font-bold tracking-tight">{archetype.name}</h1>
            <p className="mt-2 text-base text-muted-foreground">{archetype.tagline}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {archetype.traits.map((trait) => (
                <span
                  key={trait}
                  className="rounded-full border border-border bg-muted/50 px-3 py-1 text-sm font-medium"
                >
                  {trait}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div
          className={`mt-8 transition-all delay-300 duration-500 ${
            revealed ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          <Button onClick={onContinue} size="lg" className="w-full max-w-xs text-base">
            Start Shopping
          </Button>
        </div>
      </div>
      {revealed && (
        <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
          {Array.from({ length: 24 }, (_, i) => (
            <div
              key={i}
              className="absolute h-2 w-2 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-5%`,
                backgroundColor: ["#f43f5e", "#3b82f6", "#eab308", "#22c55e", "#a855f7", "#f97316"][i % 6],
                animation: `confetti-fall ${1.5 + Math.random() * 2}s ease-in ${Math.random() * 0.5}s forwards`,
              }}
            />
          ))}
          <style>{`
            @keyframes confetti-fall {
              0% { transform: translateY(0) rotate(0deg); opacity: 1; }
              100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
