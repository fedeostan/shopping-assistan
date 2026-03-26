"use client";

import { useRef, useCallback } from "react";
import { ExternalLinkIcon, InfoIcon, TrophyIcon, StarIcon, BanknoteIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { useThreadRuntime } from "@assistant-ui/react";
import type {
  CompareProductsArgs,
  CompareProductsResult,
  ComparisonBadge,
} from "./tool-ui-types";

const badgeColors: Record<ComparisonBadge["variant"], string> = {
  green: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
};

function formatCurrency(price: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(price);
  } catch {
    return `${currency} ${price.toFixed(2)}`;
  }
}

function getDimensionValue(
  product: CompareProductsArgs["products"][number],
  dimension: string
): string {
  if (dimension === "Price")
    return formatCurrency(product.currentPrice, product.currency);
  if (dimension === "Rating")
    return product.rating != null ? `${product.rating} / 5` : "—";
  if (dimension === "Reviews")
    return product.reviewCount != null
      ? product.reviewCount.toLocaleString()
      : "—";
  return product.specs?.[dimension] ?? "—";
}

const badgeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  "Best Value": BanknoteIcon,
  "Top Rated": StarIcon,
  "Best Overall": TrophyIcon,
};

function BadgePills({ badges }: { badges: ComparisonBadge[] }) {
  if (badges.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {badges.map((b) => {
        const Icon = badgeIcons[b.label];
        return (
          <span
            key={b.label}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${badgeColors[b.variant]}`}
          >
            {Icon && <Icon className="size-3" />}
            {b.label}
          </span>
        );
      })}
    </div>
  );
}

export const CompareProductsUI: ToolCallMessagePartComponent<
  CompareProductsArgs,
  CompareProductsResult
> = ({ args, result, status }) => {
  const threadRuntime = useThreadRuntime();
  const pendingRef = useRef(false);

  const safeAppend = useCallback(
    (message: Parameters<typeof threadRuntime.append>[0]) => {
      if (pendingRef.current) return;
      pendingRef.current = true;
      threadRuntime.append(message);
      setTimeout(() => {
        pendingRef.current = false;
      }, 2000);
    },
    [threadRuntime]
  );

  const handleMoreInfo = useCallback(
    (product: CompareProductsArgs["products"][number]) => {
      const urlHint = product.productUrl ? ` (${product.productUrl})` : "";
      safeAppend({
        role: "user",
        content: [
          { type: "text", text: `Tell me more about "${product.title}"${urlHint}` },
        ],
      });
    },
    [safeAppend]
  );

  const handleAddToCart = useCallback(
    (product: CompareProductsArgs["products"][number]) => {
      const url = product.retailerUrl || product.productUrl;
      safeAppend({
        role: "user",
        content: [
          { type: "text", text: `Add to cart: "${product.title}" from ${url}` },
        ],
      });
    },
    [safeAppend]
  );

  if (status.type === "running") {
    const count = args.products?.length ?? 3;
    return (
      <div className="rounded-xl border bg-card p-4">
        <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
          <InfoIcon className="size-4 animate-pulse" />
          Comparing {count} products...
        </div>
        <div className="flex gap-4 overflow-x-auto">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="flex min-w-[180px] flex-1 flex-col gap-2">
              <Skeleton className="aspect-square w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!result) return null;

  const { products, dimensions, winners, badges } = result;

  const getBadges = (index: number) =>
    badges.filter((b) => b.productIndex === index);

  return (
    <div className="flex flex-col gap-1">
      {result.focus && (
        <p className="text-xs text-muted-foreground">
          Focused on: <span className="font-medium">{result.focus}</span>
        </p>
      )}

      {/* ── Mobile: stacked cards ── */}
      <div className="flex flex-col gap-3 sm:hidden">
        {products.map((product, i) => {
          const productBadges = getBadges(i);
          return (
            <div key={i} className="rounded-xl border bg-card p-4">
              {productBadges.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  <BadgePills badges={productBadges} />
                </div>
              )}

              {product.imageUrl && (
                <img
                  src={product.imageUrl}
                  alt={product.title}
                  className="w-full aspect-[4/3] object-cover rounded-lg"
                />
              )}
              <div className="mt-2">
                <h4 className="line-clamp-2 text-sm font-semibold">
                  {product.title}
                </h4>
                {product.brand && (
                  <p className="text-xs text-muted-foreground">
                    {product.brand}
                  </p>
                )}
                <p className="mt-1 text-base font-bold">
                  {formatCurrency(product.currentPrice, product.currency)}
                  {product.originalPrice &&
                    product.originalPrice > product.currentPrice && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground line-through">
                        {formatCurrency(product.originalPrice, product.currency)}
                      </span>
                    )}
                </p>
              </div>

              <div className="mt-3 space-y-1.5">
                {dimensions.map((dim) => {
                  const isWinner = winners[dim] === i;
                  return (
                    <div
                      key={dim}
                      className={`flex justify-between rounded px-2 py-1 text-sm ${
                        isWinner ? "bg-green-50 dark:bg-green-900/20" : ""
                      }`}
                    >
                      <span className="text-muted-foreground">{dim}</span>
                      <span className={isWinner ? "font-medium" : ""}>
                        {getDimensionValue(product, dim)}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleMoreInfo(product)}
                >
                  More Info
                </Button>
                {(product.retailerUrl || product.productUrl) && (
                  <>
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleAddToCart(product)}
                    >
                      Add to Cart
                      <ExternalLinkIcon className="ml-1 size-3" />
                    </Button>
                    <a
                      href={product.retailerUrl || product.productUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md bg-teal-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-teal-700 transition-colors"
                    >
                      <ExternalLinkIcon className="size-3" />
                      Visit Store
                    </a>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Desktop: grid table ── */}
      <div className="hidden overflow-x-auto rounded-xl border bg-card sm:block">
        <div
          className="grid min-w-max"
          style={{
            gridTemplateColumns: `140px repeat(${products.length}, minmax(180px, 1fr))`,
          }}
        >
          {/* Header row: empty corner + product headers */}
          <div className="sticky left-0 z-10 border-b border-r bg-card p-3" />
          {products.map((product, i) => {
            const productBadges = getBadges(i);
            return (
              <div
                key={i}
                className="flex flex-col items-center gap-2 border-b p-3 text-center"
              >
                {product.imageUrl && (
                  <img
                    src={product.imageUrl}
                    alt={product.title}
                    className="size-32 rounded-lg object-cover"
                  />
                )}
                <h4 className="line-clamp-2 text-sm font-semibold">
                  {product.title}
                </h4>
                {product.brand && (
                  <p className="text-xs text-muted-foreground">{product.brand}</p>
                )}
                {productBadges.length > 0 && (
                  <BadgePills badges={productBadges} />
                )}
                {(product.retailerUrl || product.productUrl) && (
                  <a
                    href={product.retailerUrl || product.productUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md bg-teal-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-teal-700 transition-colors"
                  >
                    <ExternalLinkIcon className="size-3" />
                    Visit Store
                  </a>
                )}
              </div>
            );
          })}

          {/* Dimension rows */}
          {dimensions.map((dim, rowIdx) => (
            <div key={dim} className="contents">
              {/* Label cell */}
              <div
                className={`sticky left-0 z-10 flex items-center border-r bg-card px-3 py-2 text-sm font-medium text-muted-foreground ${
                  rowIdx < dimensions.length - 1 ? "border-b" : ""
                } ${rowIdx % 2 === 0 ? "bg-muted/20" : ""}`}
              >
                {dim}
                {result.focus &&
                  dim.toLowerCase().includes(result.focus.toLowerCase()) && (
                    <span className="ml-1 text-xs text-amber-500">★</span>
                  )}
              </div>

              {/* Value cells */}
              {products.map((product, colIdx) => {
                const isWinner = winners[dim] === colIdx;
                return (
                  <div
                    key={`${dim}-${colIdx}`}
                    className={`flex items-center justify-center px-3 py-2 text-center text-sm ${
                      rowIdx < dimensions.length - 1 ? "border-b" : ""
                    } ${
                      isWinner
                        ? "bg-green-50 font-medium ring-1 ring-inset ring-green-500/20 dark:bg-green-900/20 dark:ring-green-500/15"
                        : rowIdx % 2 === 0
                          ? "bg-muted/20"
                          : ""
                    }`}
                  >
                    {getDimensionValue(product, dim)}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Action row */}
          <div className="sticky left-0 z-10 border-r border-t bg-card p-3" />
          {products.map((product, i) => (
            <div
              key={`actions-${i}`}
              className="flex items-center justify-center gap-2 border-t p-3"
            >
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleMoreInfo(product)}
              >
                More Info
              </Button>
              {(product.retailerUrl || product.productUrl) && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleAddToCart(product)}
                >
                  Add to Cart
                  <ExternalLinkIcon className="ml-1 size-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
