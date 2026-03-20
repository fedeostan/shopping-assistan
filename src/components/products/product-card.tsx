"use client";

import { useState } from "react";
import { XIcon, ShoppingCartIcon, InfoIcon } from "lucide-react";
import { PriceDisplay } from "./price-display";
import { SourceBadge } from "./source-badge";
import { useRecordInteraction } from "@/hooks/use-persona";
import { extractDismissSignals } from "@/lib/persona/signals";
import type { PersonaSignal } from "@/lib/persona/types";
import type { ProductResult } from "@/components/chat/tool-ui-types";

interface ProductCardProps {
  product: ProductResult;
  onDetails?: (product: ProductResult) => void;
  onBuy?: (product: ProductResult) => void;
  onAddToCart?: (product: ProductResult) => void;
}

export function ProductCard({ product, onDetails, onBuy, onAddToCart }: ProductCardProps) {
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

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    recordClickSignals();
    onAddToCart?.(product);
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
    <div className="relative flex flex-col rounded-xl border bg-card transition-shadow hover:shadow-md group">

      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 z-10 rounded-md p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted hover:text-foreground transition-all"
        title="Not for me"
      >
        <XIcon className="size-3.5" />
      </button>

      {product.imageUrl && (
        <div className="aspect-square w-full overflow-hidden rounded-t-xl bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.imageUrl}
            alt={product.title}
            loading="lazy"
            className="h-full w-full object-contain"
          />
        </div>
      )}

      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-baseline justify-between gap-2">
          <PriceDisplay
            price={product.currentPrice}
            originalPrice={product.originalPrice}
            currency={product.currency}
            size="sm"
          />
          <SourceBadge source={product.source} />
        </div>

        <p className="line-clamp-1 text-xs text-muted-foreground" title={product.title}>
          {product.title}
        </p>

        <div className="flex gap-1.5">
          <button
            onClick={handleDetails}
            className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border bg-background px-2 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <InfoIcon className="size-3" />
            Details
          </button>
          {product.productUrl && (
            <>
              <button
                onClick={handleAddToCart}
                className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-teal-600 px-2 py-1.5 text-xs font-medium text-white transition-colors hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600"
              >
                <ShoppingCartIcon className="size-3" />
                Cart
              </button>
              <button
                onClick={handleBuy}
                className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Buy
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
