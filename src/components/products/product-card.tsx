"use client";

import { useState } from "react";
import { XIcon, ShoppingCartIcon, InfoIcon } from "lucide-react";
import { PriceDisplay } from "./price-display";
import { StarRating } from "./star-rating";
import { SourceBadge } from "./source-badge";
import { useRecordInteraction } from "@/hooks/use-persona";
import { extractDismissSignals } from "@/lib/persona/signals";
import type { PersonaSignal } from "@/lib/persona/types";
import type { ProductResult } from "@/components/chat/tool-ui-types";

interface ProductCardProps {
  product: ProductResult;
  onDetails?: (product: ProductResult) => void;
  onBuy?: (product: ProductResult) => void;
}

export function ProductCard({ product, onDetails, onBuy }: ProductCardProps) {
  const { recordInteraction } = useRecordInteraction();
  const [dismissed, setDismissed] = useState(false);

  const recordClickSignals = () => {
    const signals: PersonaSignal[] = [];
    if (product.brand) {
      signals.push({
        type: "brand_preference",
        key: product.brand,
        value: 1,
        confidence: 0.4,
        source: "click",
      });
    }
    if (product.category) {
      signals.push({
        type: "category_interest",
        key: product.category,
        value: 1,
        confidence: 0.3,
        source: "click",
      });
    }
    recordInteraction("click", {
      productId: product.id,
      title: product.title,
      brand: product.brand,
      price: product.currentPrice,
      source: product.source,
    }, signals);
  };

  const handleDetails = (e: React.MouseEvent) => {
    e.stopPropagation();
    recordClickSignals();
    onDetails?.(product);
  };

  const handleBuy = (e: React.MouseEvent) => {
    e.stopPropagation();
    recordClickSignals();
    onBuy?.(product);
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    recordInteraction("dismiss", {
      title: product.title,
      brand: product.brand,
      price: product.currentPrice,
      source: product.source,
    }, extractDismissSignals({
      title: product.title,
      brand: product.brand,
      category: product.category,
    }));
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <div className="relative flex flex-col gap-2 rounded-xl border bg-card p-3 transition-shadow hover:shadow-md group">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 z-10 rounded-md p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted hover:text-foreground transition-all"
        title="Not for me"
      >
        <XIcon className="size-3.5" />
      </button>
      {product.imageUrl && (
        <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.imageUrl}
            alt={product.title}
            loading="lazy"
            className="h-full w-full object-contain"
          />
          <div className="absolute inset-x-0 bottom-0 flex gap-2 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleDetails}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-background/90 backdrop-blur px-3 py-2 text-xs font-medium text-foreground shadow-sm transition-colors hover:bg-background"
            >
              <InfoIcon className="size-3" />
              More details
            </button>
            {product.productUrl && (
              <button
                onClick={handleBuy}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
              >
                <ShoppingCartIcon className="size-3" />
                Buy
              </button>
            )}
          </div>
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
      </div>
    </div>
  );
}
