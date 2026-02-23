"use client";

import {
  ExternalLinkIcon,
  AlertCircleIcon,
  LoaderIcon,
  CreditCardIcon,
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
              Purchasing &ldquo;{args.productName}&rdquo;
            </p>
            <p className="text-sm text-muted-foreground">
              Navigating to store, adding to cart, and filling shipping info...
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 pl-[52px]">
          <Skeleton className="h-3 w-52" />
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-3 w-44" />
        </div>
      </div>
    );
  }

  if (!result) return null;

  // State 3: Error
  if (!result.success) {
    return (
      <div className="rounded-xl border border-l-4 border-l-red-500 bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <AlertCircleIcon className="size-5 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-foreground">Purchase Failed</p>
            <p className="text-sm text-muted-foreground">
              {result.error ?? "Something went wrong during the purchase flow"}
            </p>

            {result.streamingUrl && (
              <a
                href={result.streamingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline dark:text-blue-400"
              >
                Open browser session (may still be active)
                <ExternalLinkIcon className="size-3" />
              </a>
            )}

            {result.retailerUrl && (
              <a
                href={result.retailerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline dark:text-blue-400"
              >
                Complete checkout manually
                <ExternalLinkIcon className="size-3" />
              </a>
            )}

            <StatusMessages messages={result.statusMessages} />
          </div>
        </div>
      </div>
    );
  }

  // State 2: Waiting for payment (happy path)
  if (result.waitingForPayment) {
    const order = result.orderSummary as {
      items?: { name: string; price: string; quantity: number }[];
      subtotal?: string;
      shipping?: string;
      tax?: string;
      total?: string;
      currency?: string;
      estimatedDelivery?: string;
    } | undefined;

    return (
      <div className="rounded-xl border border-l-4 border-l-amber-500 bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <CreditCardIcon className="size-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="font-semibold text-foreground">
              Ready for Payment
            </p>
            <p className="text-sm text-muted-foreground">
              The browser agent has navigated to the payment page for &ldquo;{result.productName}&rdquo;.
              Enter your payment details in the live browser below.
            </p>

            {result.streamingUrl && (
              <a
                href={result.streamingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-2 self-start rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600"
              >
                <ExternalLinkIcon className="size-4" />
                Open Browser — Enter Payment
              </a>
            )}

            <p className="text-xs text-muted-foreground">
              This browser session may expire. Complete payment promptly.
            </p>

            {order && <OrderSummary order={order} />}

            <StatusMessages messages={result.statusMessages} />
          </div>
        </div>
      </div>
    );
  }

  return null;
};

function OrderSummary({ order }: {
  order: {
    items?: { name: string; price: string; quantity: number }[];
    subtotal?: string;
    shipping?: string;
    tax?: string;
    total?: string;
    currency?: string;
    estimatedDelivery?: string;
  };
}) {
  return (
    <div className="mt-1 rounded-lg border bg-muted/50 p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Order Summary
      </p>
      {order.items && order.items.length > 0 && (
        <div className="space-y-1">
          {order.items.map((item, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="truncate pr-2">
                {item.quantity}x {item.name}
              </span>
              <span className="shrink-0 font-medium">{item.price}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 space-y-1 border-t pt-2 text-sm">
        {order.subtotal && (
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{order.subtotal}</span>
          </div>
        )}
        {order.shipping && (
          <div className="flex justify-between text-muted-foreground">
            <span>Shipping</span>
            <span>{order.shipping}</span>
          </div>
        )}
        {order.tax && (
          <div className="flex justify-between text-muted-foreground">
            <span>Tax</span>
            <span>{order.tax}</span>
          </div>
        )}
        {order.total && (
          <div className="flex justify-between border-t pt-1 font-semibold">
            <span>Total</span>
            <span>{order.total}</span>
          </div>
        )}
      </div>

      {order.estimatedDelivery && (
        <p className="mt-2 text-xs text-muted-foreground">
          Estimated delivery: {order.estimatedDelivery}
        </p>
      )}
    </div>
  );
}

function StatusMessages({ messages }: { messages?: string[] }) {
  if (!messages || messages.length === 0) return null;

  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
        Agent activity ({messages.length} steps)
      </summary>
      <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
        {messages.map((msg, i) => (
          <li key={i}>&bull; {msg}</li>
        ))}
      </ul>
    </details>
  );
}
