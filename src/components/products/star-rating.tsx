"use client";

import { StarIcon } from "lucide-react";

interface StarRatingProps {
  rating?: number;
  reviewCount?: number;
}

export function StarRating({ rating, reviewCount }: StarRatingProps) {
  if (!rating) return null;

  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);

  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {Array.from({ length: fullStars }).map((_, i) => (
          <StarIcon
            key={`full-${i}`}
            className="size-3.5 fill-yellow-400 text-yellow-400"
          />
        ))}
        {hasHalf && (
          <div className="relative">
            <StarIcon className="size-3.5 text-muted-foreground/30" />
            <div className="absolute inset-0 overflow-hidden w-1/2">
              <StarIcon className="size-3.5 fill-yellow-400 text-yellow-400" />
            </div>
          </div>
        )}
        {Array.from({ length: emptyStars }).map((_, i) => (
          <StarIcon
            key={`empty-${i}`}
            className="size-3.5 text-muted-foreground/30"
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">
        {rating.toFixed(1)}
        {reviewCount !== undefined && ` (${reviewCount.toLocaleString()})`}
      </span>
    </div>
  );
}
