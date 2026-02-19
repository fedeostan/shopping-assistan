"use client";

import { BellIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/components/products/price-display";
import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import type { TrackPriceArgs, TrackPriceResult } from "./tool-ui-types";

export const TrackPriceUI: ToolCallMessagePartComponent<
  TrackPriceArgs,
  TrackPriceResult
> = ({ args, result, status }) => {
  if (status.type === "running") {
    return (
      <div className="flex items-center gap-3 rounded-xl border-l-4 border-l-green-500 bg-card p-4">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
      </div>
    );
  }

  if (!result) return null;

  const currency = result.currency ?? "USD";

  return (
    <div className="rounded-xl border border-l-4 border-l-green-500 bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <BellIcon className="size-5 text-green-600 dark:text-green-400" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="font-semibold text-foreground">Price Alert Set</p>
          <p className="text-sm text-muted-foreground">{result.productName}</p>
          <div className="mt-1 flex items-center gap-4 text-sm">
            <span>
              Current:{" "}
              <span className="font-medium">
                {formatPrice(result.currentPrice, currency)}
              </span>
            </span>
            {result.targetPrice && (
              <span>
                Target:{" "}
                <span className="font-medium text-green-600 dark:text-green-400">
                  {formatPrice(result.targetPrice, currency)}
                </span>
              </span>
            )}
          </div>
          {result.estimatedDrop && (
            <p className="mt-1 text-xs text-muted-foreground">
              {result.estimatedDrop}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
