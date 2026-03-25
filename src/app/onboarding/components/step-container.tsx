"use client";

import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { ProgressDots } from "./progress-dots";
import { STEP_META } from "../data/quiz-data";

interface StepContainerProps {
  step: number;
  totalSteps: number;
  onBack: () => void;
  children: ReactNode;
  canGoBack?: boolean;
}

export function StepContainer({
  step,
  totalSteps,
  onBack,
  children,
  canGoBack = true,
}: StepContainerProps) {
  const meta = STEP_META[step];

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-background">
      {/* Header — fixed */}
      <div className="shrink-0 flex items-center justify-between px-4 pt-6 pb-2">
        {canGoBack ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        ) : (
          <div className="h-8 w-8" />
        )}
        <ProgressDots total={totalSteps} current={step} />
        <div className="h-8 w-8" />
      </div>

      {/* Step title — fixed */}
      <div className="shrink-0 px-6 pt-2 pb-4 text-center">
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{meta.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{meta.subtitle}</p>
      </div>

      {/* Content — scrollable, fills remaining space */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pb-8">
        {children}
      </div>
    </div>
  );
}
