"use client";

import { ShoppingCartIcon, ClockIcon, StarIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SourceBadge } from "@/components/products/source-badge";
import { formatPrice } from "@/components/products/price-display";
import { StarRating } from "@/components/products/star-rating";
import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import type {
  RecommendationsArgs,
  RecommendationsResult,
  RecommendationItem,
} from "./tool-ui-types";

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground">{pct}% match</span>
    </div>
  );
}

function ActionBadge({ action }: { action: RecommendationItem["action"] }) {
  if (action === "buy_now") {
    return (
      <Badge className="gap-1 bg-green-600 text-white">
        <ShoppingCartIcon className="size-3" />
        Buy Now
      </Badge>
    );
  }
  if (action === "wait") {
    return (
      <Badge className="gap-1 bg-yellow-500 text-white dark:bg-yellow-600">
        <ClockIcon className="size-3" />
        Wait
      </Badge>
    );
  }
  return null;
}

function RecommendationCard({ item, currency }: { item: RecommendationItem; currency: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <StarIcon className="size-4 text-primary" />
            <h4 className="text-sm font-semibold text-foreground">
              {item.title}
            </h4>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{item.reason}</p>
        </div>
        <ActionBadge action={item.action} />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">
            {item.product.title}
          </p>
          <p className="font-semibold text-foreground">
            {formatPrice(item.product.currentPrice, currency)}
          </p>
        </div>
        {item.product.source && <SourceBadge source={item.product.source} />}
      </div>

      <div className="flex items-center justify-between">
        <StarRating
          rating={item.product.rating}
        />
        <ConfidenceBar confidence={item.confidence} />
      </div>
    </div>
  );
}

export const RecommendationsUI: ToolCallMessagePartComponent<
  RecommendationsArgs,
  RecommendationsResult
> = ({ args, result, status }) => {
  if (status.type === "running") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Finding recommendations
          {args.category ? ` in ${args.category}` : ""}...
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-3.5 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!result || result.recommendations.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center">
        <p className="font-medium text-foreground">No recommendations available</p>
        <p className="text-sm text-muted-foreground">
          Try specifying a category or budget for better suggestions.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {result.recommendations.length} recommendation
        {result.recommendations.length !== 1 ? "s" : ""}
        {args.category ? ` in ${args.category}` : ""}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {result.recommendations.map((item, i) => (
          <RecommendationCard key={i} item={item} currency={args.currency ?? "USD"} />
        ))}
      </div>
    </div>
  );
};
