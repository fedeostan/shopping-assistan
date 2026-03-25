"use client";

import { Button } from "@/components/ui/button";

interface WelcomeStepProps {
  onStart: () => void;
  onSkip: () => void;
}

export function WelcomeStep({ onStart, onSkip }: WelcomeStepProps) {
  return (
    <div className="flex h-svh flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-lg text-center animate-in fade-in zoom-in-95 duration-500">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
          <span className="text-4xl">🛍️</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight">
          Let&apos;s build your
          <br />
          <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Shopping DNA
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
          Before we start, we want to get to know you better. These{" "}
          <span className="font-semibold text-foreground">10 quick questions</span> help us
          build your buyer persona so we can personalize every recommendation just for you.
        </p>
        <div className="mx-auto mt-6 flex max-w-sm items-center gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-left">
          <span className="text-2xl">🏆</span>
          <p className="text-sm text-muted-foreground">
            At the end, we&apos;ll reveal{" "}
            <span className="font-semibold text-foreground">what type of buyer you are!</span>
          </p>
        </div>
        <Button onClick={onStart} size="lg" className="mt-8 w-full max-w-xs text-base">
          Let&apos;s Go
        </Button>
        <button
          type="button"
          onClick={onSkip}
          className="mt-4 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
