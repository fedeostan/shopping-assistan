"use client";

import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { ProgressBar } from "./progress-bar";
import { STEP_META } from "../data/quiz-data";

interface QuizLayoutProps {
  step: number;
  totalSteps: number;
  onBack: () => void;
  onSkip: () => void;
  canGoBack?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}

export function QuizLayout({
  step,
  totalSteps,
  onBack,
  onSkip,
  canGoBack = true,
  children,
  footer,
}: QuizLayoutProps) {
  const meta = STEP_META[step];

  return (
    <div className="flex h-svh flex-col bg-background">
      {/* Header */}
      <header className="shrink-0 border-b border-border/40">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-6 py-4">
          {canGoBack ? (
            <Button variant="ghost" size="icon" onClick={onBack} className="h-9 w-9 shrink-0">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          ) : (
            <div className="h-9 w-9 shrink-0" />
          )}
          <ProgressBar current={step} total={totalSteps} label={meta.name} />
          <button
            type="button"
            onClick={onSkip}
            className="shrink-0 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Skip
          </button>
        </div>
      </header>

      {/* Title */}
      <div className="shrink-0 mx-auto w-full max-w-4xl px-6 pt-8 pb-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight">{meta.title}</h1>
        <p className="mt-2 text-base text-muted-foreground">{meta.subtitle}</p>
      </div>

      {/* Content — scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-6 pb-8 animate-in fade-in slide-in-from-right-4 duration-300">
          {children}
        </div>
      </div>

      {/* Footer — sticky bottom */}
      {footer && (
        <div className="shrink-0 border-t border-border/40 bg-background">
          <div className="mx-auto max-w-4xl px-6 py-4">
            {footer}
          </div>
        </div>
      )}
    </div>
  );
}
