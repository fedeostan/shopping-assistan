"use client";

import { cn } from "@/lib/utils";

interface ProgressBarProps {
  current: number;
  total: number;
  label?: string;
}

export function ProgressBar({ current, total, label }: ProgressBarProps) {
  const percent = ((current + 1) / total) * 100;

  return (
    <div className="flex flex-1 items-center gap-3">
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="shrink-0 text-xs font-medium text-muted-foreground">
        {label && <span className="hidden sm:inline">{label} · </span>}
        {current + 1}/{total}
      </span>
    </div>
  );
}
