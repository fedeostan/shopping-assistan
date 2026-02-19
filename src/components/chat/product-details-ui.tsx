"use client";

import { useState } from "react";
import { ExternalLinkIcon, ChevronDownIcon, AlertCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { PriceDisplay } from "@/components/products/price-display";
import { StarRating } from "@/components/products/star-rating";
import { SourceBadge } from "@/components/products/source-badge";
import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import type { ProductDetailsArgs, ProductDetailsResult } from "./tool-ui-types";

export const ProductDetailsUI: ToolCallMessagePartComponent<
  ProductDetailsArgs,
  ProductDetailsResult
> = ({ result, status }) => {
  const [descExpanded, setDescExpanded] = useState(false);

  if (status.type === "running") {
    return (
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-col gap-4 sm:flex-row">
          <Skeleton className="aspect-square w-full shrink-0 rounded-lg sm:w-48" />
          <div className="flex flex-1 flex-col gap-3">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!result) return null;

  if (!result.success || !result.product) {
    return (
      <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
        <AlertCircleIcon className="size-5 shrink-0 text-destructive" />
        <p className="text-sm text-muted-foreground">
          {result.error ?? "Could not load product details."}
        </p>
      </div>
    );
  }

  const p = result.product;
  const description = p.description ?? "";
  const isLong = description.length > 200;
  const specs = p.specifications ? Object.entries(p.specifications) : [];

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex flex-col gap-4 sm:flex-row">
        {p.imageUrl && (
          <div className="aspect-square w-full shrink-0 overflow-hidden rounded-lg bg-muted sm:w-48">
            <img
              src={p.imageUrl}
              alt={p.title}
              loading="lazy"
              className="h-full w-full object-contain"
            />
          </div>
        )}
        <div className="flex flex-1 flex-col gap-2">
          <h3 className="text-lg font-semibold leading-tight text-foreground">
            {p.title}
          </h3>
          {p.brand && (
            <p className="text-sm text-muted-foreground">by {p.brand}</p>
          )}
          <PriceDisplay
            price={p.price}
            originalPrice={p.originalPrice}
            currency={p.currency}
            size="lg"
          />
          <StarRating rating={p.rating} reviewCount={p.reviewCount} />
          {p.availability && (
            <p className="text-xs text-muted-foreground">{p.availability}</p>
          )}

          {description && (
            <>
              <Separator className="my-1" />
              <div className="relative">
                <p
                  className={`text-sm text-muted-foreground ${!descExpanded && isLong ? "line-clamp-3" : ""}`}
                >
                  {description}
                </p>
                {isLong && (
                  <button
                    onClick={() => setDescExpanded(!descExpanded)}
                    className="mt-1 inline-flex items-center gap-0.5 text-xs text-primary hover:underline"
                  >
                    {descExpanded ? "Show less" : "Show more"}
                    <ChevronDownIcon
                      className={`size-3 transition-transform ${descExpanded ? "rotate-180" : ""}`}
                    />
                  </button>
                )}
              </div>
            </>
          )}

          {specs.length > 0 && (
            <>
              <Separator className="my-1" />
              <table className="w-full text-xs">
                <tbody>
                  {specs.map(([key, value]) => (
                    <tr key={key} className="border-b last:border-b-0">
                      <td className="py-1.5 pr-4 font-medium text-muted-foreground">
                        {key}
                      </td>
                      <td className="py-1.5 text-foreground">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <div className="mt-2 flex items-center gap-3">
            <SourceBadge source={p.source} />
            {p.url && (
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button size="sm" variant="default" className="gap-1.5">
                  View on {p.source === "mercadolibre" ? "MercadoLibre" : p.source === "amazon" ? "Amazon" : p.source}
                  <ExternalLinkIcon className="size-3.5" />
                </Button>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
