"use client";

import { ExternalLinkIcon, TrophyIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SourceBadge } from "@/components/products/source-badge";
import { formatPrice } from "@/components/products/price-display";
import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import type { ComparePricesArgs, ComparePricesResult } from "./tool-ui-types";

export const ComparePricesUI: ToolCallMessagePartComponent<
  ComparePricesArgs,
  ComparePricesResult
> = ({ args, result, status }) => {
  if (status.type === "running") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Comparing prices for &ldquo;{args.productName}&rdquo;...
        </p>
        <div className="rounded-xl border bg-card">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b p-3 last:border-b-0">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-48 flex-1" />
              <Skeleton className="h-5 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!result || result.resultCount === 0) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center">
        <p className="font-medium text-foreground">No price comparisons found</p>
        <p className="text-sm text-muted-foreground">
          {result?.errors?.join(", ") ?? "Could not find comparable products."}
        </p>
      </div>
    );
  }

  const cheapestPrice = result.cheapest?.price;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {result.resultCount} option{result.resultCount !== 1 ? "s" : ""} for
        &ldquo;{result.product}&rdquo;
      </p>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-xl border bg-card sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Source</th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Product</th>
              <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Price</th>
              <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Link</th>
            </tr>
          </thead>
          <tbody>
            {result.results.map((item, i) => {
              const isCheapest = item.price === cheapestPrice;
              return (
                <tr
                  key={i}
                  className={`border-b last:border-b-0 ${isCheapest ? "bg-green-50 dark:bg-green-950/20" : ""}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <SourceBadge source={item.source} />
                      {isCheapest && (
                        <Badge className="bg-green-600 text-white text-[10px] px-1.5 py-0">
                          <TrophyIcon className="mr-0.5 size-2.5" />
                          Best
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="max-w-48 truncate px-4 py-3 text-foreground">
                    {item.title}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-foreground">
                    {formatPrice(item.price, item.currency)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        View <ExternalLinkIcon className="size-3" />
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked cards */}
      <div className="flex flex-col gap-2 sm:hidden">
        {result.results.map((item, i) => {
          const isCheapest = item.price === cheapestPrice;
          return (
            <div
              key={i}
              className={`rounded-xl border p-3 ${isCheapest ? "border-green-500 bg-green-50 dark:bg-green-950/20" : "bg-card"}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SourceBadge source={item.source} />
                  {isCheapest && (
                    <Badge className="bg-green-600 text-white text-[10px] px-1.5 py-0">
                      Best Price
                    </Badge>
                  )}
                </div>
                <span className="font-semibold">
                  {formatPrice(item.price, item.currency)}
                </span>
              </div>
              <p className="mt-1 text-sm text-foreground line-clamp-1">{item.title}</p>
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  View <ExternalLinkIcon className="size-3" />
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
