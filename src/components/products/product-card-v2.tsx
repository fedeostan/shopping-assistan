"use client";

import { useState } from "react";
import { XIcon, ExternalLinkIcon, PackageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PriceDisplay } from "./price-display";
import { SourceBadge } from "./source-badge";
import { useRecordInteraction } from "@/hooks/use-persona";
import { extractDismissSignals } from "@/lib/persona/signals";
import type { PersonaSignal } from "@/lib/persona/types";
import type { ProductResult } from "@/components/chat/tool-ui-types";

interface ProductCardV2Props {
  product: ProductResult;
  index?: number;
  onVisitStore?: (product: ProductResult) => void;
}

export function ProductCardV2({ product, index = 0, onVisitStore }: ProductCardV2Props) {
  const { recordInteraction } = useRecordInteraction();
  const [dismissed, setDismissed] = useState(false);

  const storeUrl = product.retailerUrl || product.productUrl;

  const savingsPercent =
    product.originalPrice && product.originalPrice > product.currentPrice
      ? Math.round(((product.originalPrice - product.currentPrice) / product.originalPrice) * 100)
      : null;

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
    recordInteraction(
      "click",
      {
        productId: product.id,
        title: product.title,
        brand: product.brand,
        price: product.currentPrice,
        source: product.source,
      },
      signals,
    );
  };

  const handleVisitStore = (e: React.MouseEvent) => {
    e.stopPropagation();
    recordClickSignals();
    if (onVisitStore) {
      onVisitStore(product);
    } else if (storeUrl) {
      window.open(storeUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    recordInteraction(
      "dismiss",
      {
        title: product.title,
        brand: product.brand,
        price: product.currentPrice,
        source: product.source,
      },
      extractDismissSignals({
        title: product.title,
        brand: product.brand,
        category: product.category,
      }),
    );
    setDismissed(true);
  };

  const [imgError, setImgError] = useState(false);

  if (dismissed) return null;

  const ratingStars = product.rating
    ? "★".repeat(Math.round(product.rating)) + "☆".repeat(5 - Math.round(product.rating))
    : null;

  const hasValidImage = product.imageUrl && !imgError;

  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both rounded-xl border bg-card overflow-hidden group hover:shadow-lg transition-shadow"
      style={{ animationDelay: `${index * 75}ms` }}
    >
      {/* Image container */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {hasValidImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.imageUrl}
            alt={product.title}
            loading="lazy"
            className="h-full w-full object-contain p-2 group-hover:scale-105 transition-transform duration-300"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <PackageIcon className="size-12 text-muted-foreground/40" />
          </div>
        )}

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 z-20 rounded-full bg-black/50 p-1.5 text-white opacity-0 group-hover:opacity-100 hover:bg-black/70 transition-all"
          title="Not for me"
        >
          <XIcon className="size-3.5" />
        </button>

        {/* Source badge - top right, below dismiss */}
        <div className="absolute top-10 right-2 z-10">
          <SourceBadge source={product.source} />
        </div>

        {/* Savings badge - top left */}
        {savingsPercent && (
          <Badge className="absolute top-2 left-2 z-10 bg-green-600 hover:bg-green-600 text-white border-0 text-xs font-semibold">
            {savingsPercent}% off
          </Badge>
        )}

        {/* Hover overlay with description + rating */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent p-3 pt-8 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          {product.description && (
            <p className="line-clamp-2 text-xs text-white/90 mb-1">
              {product.description}
            </p>
          )}
          {ratingStars && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-yellow-400 tracking-wide">{ratingStars}</span>
              {product.reviewCount != null && (
                <span className="text-xs text-white/60">({product.reviewCount.toLocaleString()})</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Content below image */}
      <div className="flex flex-col gap-1.5 p-3">
        <p className="line-clamp-2 text-sm font-medium text-foreground leading-snug" title={product.title}>
          {product.title}
        </p>

        {product.brand && (
          <p className="text-xs text-muted-foreground">{product.brand}</p>
        )}

        <PriceDisplay
          price={product.currentPrice}
          originalPrice={product.originalPrice}
          currency={product.currency}
          size="md"
        />

        {/* Visit Store CTA */}
        {storeUrl && (
          <button
            onClick={handleVisitStore}
            className="mt-1.5 w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 px-3 py-2 text-sm font-medium text-white transition-colors"
          >
            <ExternalLinkIcon className="size-3.5" />
            Visit Store
          </button>
        )}
      </div>
    </div>
  );
}
