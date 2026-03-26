"use client";

import { useState } from "react";
import { XIcon, ShoppingCartIcon, InfoIcon, PackageIcon, ExternalLinkIcon } from "lucide-react";
import { PriceDisplay } from "./price-display";
import { SourceBadge } from "./source-badge";
import { useRecordInteraction } from "@/hooks/use-persona";
import { extractDismissSignals } from "@/lib/persona/signals";
import type { PersonaSignal } from "@/lib/persona/types";
import type { ProductResult } from "@/components/chat/tool-ui-types";
import { canBuildCartLink } from "@/lib/cart/permalink";

interface ProductCardProps {
  product: ProductResult;
  onMoreInfo?: (product: ProductResult) => void;
  onAddToCart?: (product: ProductResult) => void;
}

export function ProductCard({ product, onMoreInfo, onAddToCart }: ProductCardProps) {
  const { recordInteraction } = useRecordInteraction();
  const [dismissed, setDismissed] = useState(false);
  const [imgError, setImgError] = useState(false);

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

  const handleMoreInfo = (e: React.MouseEvent) => {
    e.stopPropagation();
    recordClickSignals();
    onMoreInfo?.(product);
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

      <div className="aspect-square w-full overflow-hidden rounded-t-xl bg-muted">
        {product.imageUrl && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.title}
            loading="lazy"
            className="h-full w-full object-contain p-2"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <PackageIcon className="size-10 text-muted-foreground/40" />
          </div>
        )}
      </div>

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
            onClick={handleMoreInfo}
            className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border bg-background px-2 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <InfoIcon className="size-3" />
            More Info
          </button>
          {(product.retailerUrl || product.productUrl) && (
            <button
              onClick={handleAddToCart}
              className={`flex-1 inline-flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-white transition-colors ${
                canBuildCartLink(product.retailerUrl || product.productUrl)
                  ? "bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600"
                  : "bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              }`}
            >
              {canBuildCartLink(product.retailerUrl || product.productUrl) ? (
                <>
                  <ShoppingCartIcon className="size-3" />
                  Add to Cart
                </>
              ) : (
                <>
                  <ExternalLinkIcon className="size-3" />
                  Open on Store
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
