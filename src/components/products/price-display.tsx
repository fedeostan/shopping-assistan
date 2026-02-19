"use client";

interface PriceDisplayProps {
  price: number;
  originalPrice?: number;
  currency: string;
  size?: "sm" | "md" | "lg";
}

function formatPrice(price: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);
  } catch {
    return `${currency} ${price.toLocaleString()}`;
  }
}

const sizeClasses = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl",
} as const;

export function PriceDisplay({
  price,
  originalPrice,
  currency,
  size = "md",
}: PriceDisplayProps) {
  const discount =
    originalPrice && originalPrice > price
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className={`font-bold text-foreground ${sizeClasses[size]}`}>
        {formatPrice(price, currency)}
      </span>
      {originalPrice && originalPrice > price && (
        <span className="text-muted-foreground line-through text-sm">
          {formatPrice(originalPrice, currency)}
        </span>
      )}
      {discount && (
        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
          -{discount}%
        </span>
      )}
    </div>
  );
}

export { formatPrice };
