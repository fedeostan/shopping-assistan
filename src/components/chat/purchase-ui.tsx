"use client";

import {
  ExternalLinkIcon,
  AlertCircleIcon,
  LoaderIcon,
  ShoppingCartIcon,
  StoreIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import type { PurchaseArgs, PurchaseResult } from "./tool-ui-types";

export const PurchaseUI: ToolCallMessagePartComponent<
  PurchaseArgs,
  PurchaseResult
> = ({ args, result, status }) => {
  // State 1: Running
  if (status.type === "running") {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-l-4 border-l-blue-500 bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
            <LoaderIcon className="size-5 animate-spin text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-foreground">
              Preparing cart link for &ldquo;{args.productName}&rdquo;
            </p>
            <p className="text-sm text-muted-foreground">
              Resolving product link and checking store compatibility...
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 pl-[52px]">
          <Skeleton className="h-3 w-52" />
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
    );
  }

  if (!result) return null;

  // State: Error
  if (!result.success) {
    return (
      <div className="rounded-xl border border-l-4 border-l-red-500 bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <AlertCircleIcon className="size-5 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-foreground">Could not add to cart</p>
            <p className="text-sm text-muted-foreground">
              {result.error ?? "Something went wrong"}
            </p>

            {result.productUrl && (
              <a
                href={result.productUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-2 self-start rounded-lg bg-muted px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted/80"
              >
                <ExternalLinkIcon className="size-4" />
                Open product page
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  // State: Cart permalink (Amazon, MercadoLibre, Shopify, or any supported retailer)
  if (
    result.cartMethod === "cart_permalink" ||
    result.cartMethod === "shopify_permalink"
  ) {
    const accentColor =
      result.cartMethod === "shopify_permalink" ? "green" : "yellow";
    const bgClass =
      accentColor === "green"
        ? "border-l-green-500"
        : "border-l-yellow-500";
    const iconBgClass =
      accentColor === "green"
        ? "bg-green-100 dark:bg-green-900/30"
        : "bg-yellow-100 dark:bg-yellow-900/30";
    const iconColorClass =
      accentColor === "green"
        ? "text-green-600 dark:text-green-400"
        : "text-yellow-600 dark:text-yellow-400";
    const buttonClass =
      accentColor === "green"
        ? "bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
        : "bg-yellow-500 hover:bg-yellow-600";

    return (
      <div className={`rounded-xl border border-l-4 ${bgClass} bg-card p-4`}>
        <div className="flex items-start gap-3">
          <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${iconBgClass}`}>
            <ShoppingCartIcon className={`size-5 ${iconColorClass}`} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="font-semibold text-foreground">Added to Cart</p>
            <p className="text-sm text-muted-foreground">
              &ldquo;{result.productName}&rdquo; is ready
              {result.shopifyVariant?.price && (
                <> &mdash; {result.shopifyVariant.price}</>
              )}
              {result.shopifyVariant?.title &&
                result.shopifyVariant.title !== "Default Title" && (
                  <> ({result.shopifyVariant.title})</>
                )}
            </p>

            {result.cartUrl && (
              <a
                href={result.cartUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`mt-1 inline-flex items-center gap-2 self-start rounded-lg ${buttonClass} px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors`}
              >
                <ExternalLinkIcon className="size-4" />
                View Cart &amp; Checkout
              </a>
            )}

            {result.productUrl && (
              <a
                href={result.productUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-foreground hover:underline"
              >
                <ExternalLinkIcon className="size-3.5" />
                Open product page
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  // State: Direct link (unsupported store — open on retailer site)
  if (result.cartMethod === "direct_link") {
    return (
      <div className="rounded-xl border border-l-4 border-l-blue-500 bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
            <StoreIcon className="size-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="font-semibold text-foreground">Open on Store</p>
            <p className="text-sm text-muted-foreground">
              Click below to open &ldquo;{result.productName}&rdquo; on the
              retailer&rsquo;s website and add it to your cart.
            </p>

            {result.productUrl && (
              <a
                href={result.productUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-2 self-start rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                <ExternalLinkIcon className="size-4" />
                Open Product Page
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
};
