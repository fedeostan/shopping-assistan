"use client";

import { Badge } from "@/components/ui/badge";

const sourceStyles: Record<string, string> = {
  "google-shopping":
    "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
  mercadolibre:
    "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
  amazon:
    "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800",
};

const sourceLabels: Record<string, string> = {
  "google-shopping": "Google Shopping",
  mercadolibre: "MercadoLibre",
  amazon: "Amazon",
};

interface SourceBadgeProps {
  source: string;
}

export function SourceBadge({ source }: SourceBadgeProps) {
  const normalized = source.toLowerCase().replace(/\s+/g, "");
  const style = sourceStyles[normalized] ?? "";
  const label = sourceLabels[normalized] ?? source;

  return (
    <Badge variant="outline" className={style}>
      {label}
    </Badge>
  );
}
