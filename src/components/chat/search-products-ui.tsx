"use client";

import { useState } from "react";
import { SearchIcon, PackageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/products/product-card";
import { ProductCardSkeleton } from "@/components/products/product-card-skeleton";
import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import type { SearchProductsArgs, SearchProductsResult } from "./tool-ui-types";

const INITIAL_SHOW = 6;

export const SearchProductsUI: ToolCallMessagePartComponent<
  SearchProductsArgs,
  SearchProductsResult
> = ({ args, result, status }) => {
  const [showAll, setShowAll] = useState(false);

  if (status.type === "running") {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <SearchIcon className="size-4 animate-pulse" />
          Searching for &ldquo;{args.query}&rdquo;...
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (!result) return null;

  if (result.resultCount === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border bg-card p-6 text-center">
        <PackageIcon className="size-8 text-muted-foreground" />
        <p className="font-medium text-foreground">No products found</p>
        <p className="text-sm text-muted-foreground">
          {result.note ?? `No results for "${result.query}". Try a different search term.`}
        </p>
        {result.errors && result.errors.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {result.errors.join(", ")}
          </p>
        )}
      </div>
    );
  }

  const products = result.products;
  const visible = showAll ? products : products.slice(0, INITIAL_SHOW);
  const hasMore = products.length > INITIAL_SHOW;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Found {result.resultCount} result{result.resultCount !== 1 ? "s" : ""}{" "}
        for &ldquo;{result.query}&rdquo;
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((product, i) => (
          <ProductCard key={product.id ?? i} product={product} />
        ))}
      </div>
      {hasMore && !showAll && (
        <Button
          variant="ghost"
          size="sm"
          className="self-center"
          onClick={() => setShowAll(true)}
        >
          Show all {products.length} results
        </Button>
      )}
    </div>
  );
};
