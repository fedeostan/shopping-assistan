"use client";

import { ExternalLinkIcon } from "lucide-react";
import { PriceDisplay } from "./price-display";
import { StarRating } from "./star-rating";
import { SourceBadge } from "./source-badge";
import type { ProductResult } from "@/components/chat/tool-ui-types";

interface ProductCardProps {
  product: ProductResult;
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 transition-shadow hover:shadow-md">
      {product.imageUrl && (
        <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted">
          <img
            src={product.imageUrl}
            alt={product.title}
            loading="lazy"
            className="h-full w-full object-contain"
          />
        </div>
      )}
      <h3 className="line-clamp-2 text-sm font-medium leading-tight text-foreground">
        {product.title}
      </h3>
      <PriceDisplay
        price={product.currentPrice}
        originalPrice={product.originalPrice}
        currency={product.currency}
        size="sm"
      />
      <StarRating rating={product.rating} reviewCount={product.reviewCount} />
      <div className="mt-auto flex items-center justify-between pt-1">
        <SourceBadge source={product.source} />
        {product.productUrl && (
          <a
            href={product.productUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            View
            <ExternalLinkIcon className="size-3" />
          </a>
        )}
      </div>
    </div>
  );
}
