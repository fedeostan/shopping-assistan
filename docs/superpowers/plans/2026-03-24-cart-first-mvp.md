# Cart-First MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 3-button product card (Details/Cart/Buy) with a 2-button context-aware layout (More Info / Add to Cart or Open on Store) backed by retailer cart permalink builders.

**Architecture:** New `src/lib/cart/permalink.ts` module provides synchronous `canBuildCartLink()` for UI decisions and `buildCartPermalink()` for URL construction. The buy tool integrates this before the existing MercadoLibre connector and Shopify flows. Product cards, comparison UI, and purchase UI adapt their labels/states based on whether a cart permalink can be built. The existing MercadoLibre connector (`src/lib/connectors/`) is preserved and integrated into the unified flow.

**Tech Stack:** TypeScript, Next.js App Router, React (client components), Zod

**Spec:** `docs/superpowers/specs/2026-03-24-cart-first-mvp-design.md`

---

## Prerequisite: Fix Build Error

The build currently fails due to `buildTopPickReason` not found in `src/lib/ai/tools/recommend.ts:130`. This must be fixed first to have a green baseline.

- [ ] **Read `src/lib/ai/tools/recommend.ts`** around line 125-140 to understand the issue
- [ ] **Fix the reference** — likely rename `buildTopPickReason` to `topPickReason` or define the missing function
- [ ] **Run `npm run build`** — verify build passes
- [ ] **Commit**

```bash
git add src/lib/ai/tools/recommend.ts
git commit -m "fix: resolve buildTopPickReason reference error in recommend tool"
```

---

## Task 1: Create Cart Permalink Module

**Files:**
- Create: `src/lib/cart/permalink.ts`

This module must be **client-safe** — no server-only imports. It's used in product card components at render time.

- [ ] **Step 1: Create `src/lib/cart/permalink.ts`** with types and Amazon builder

```typescript
// src/lib/cart/permalink.ts
// Client-safe cart permalink builders for major retailers.
// Used by product cards (canBuildCartLink) and buy tool (buildCartPermalink).

export interface CartPermalinkResult {
  cartUrl: string;
  retailer: string;
  method: "cart_permalink";
}

// --- Amazon ---

const AMAZON_HOSTS = [
  "amazon.com", "amazon.co.uk", "amazon.de", "amazon.fr", "amazon.it",
  "amazon.es", "amazon.co.jp", "amazon.ca", "amazon.com.au", "amazon.com.br",
  "amazon.com.mx", "amazon.in", "amazon.nl", "amazon.sg", "amazon.se",
  "amazon.pl", "amazon.com.be", "amazon.com.tr", "amazon.sa", "amazon.ae",
];

const ASIN_REGEX = /\/(?:dp|gp\/product)\/(B[A-Z0-9]{9})/;

function isAmazonHost(hostname: string): boolean {
  return AMAZON_HOSTS.some(
    (h) => hostname === h || hostname === `www.${h}`,
  );
}

function extractAsin(url: string): string | null {
  const match = url.match(ASIN_REGEX);
  return match ? match[1] : null;
}

function buildAmazonCartUrl(
  origin: string,
  asin: string,
  quantity: number,
): string {
  return `${origin}/gp/aws/cart/add.html?ASIN.1=${asin}&Quantity.1=${quantity}`;
}

// --- Registry ---

// --- MercadoLibre (client-safe hostname check only) ---

function isMercadoLibreHost(hostname: string): boolean {
  return hostname.includes("mercadoli");
}

function hasMeliItemId(url: string): boolean {
  return /\/p\/ML[A-Z]\d+/.test(url) || /ML[A-Z]-?\d+/.test(url);
}

// --- Registry ---

/**
 * Synchronous check — can we build a cart permalink for this URL?
 * Used at render time in product cards to decide button label.
 * Covers: Amazon (via ASIN extraction), MercadoLibre (via item ID detection).
 * Shopify is async (header probe) so NOT included here — it's handled server-side.
 */
export function canBuildCartLink(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const { hostname } = new URL(url);
    if (isAmazonHost(hostname) && extractAsin(url)) return true;
    if (isMercadoLibreHost(hostname) && hasMeliItemId(url)) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Build a direct "add to cart" URL for supported retailers.
 * Returns null for unsupported stores — caller falls through to Shopify or direct link.
 * Uses the same origin as the input URL (no hardcoded domains).
 */
export function buildCartPermalink(
  url: string,
  quantity: number = 1,
): CartPermalinkResult | null {
  try {
    const parsed = new URL(url);
    const { hostname, origin } = parsed;

    // Amazon
    if (isAmazonHost(hostname)) {
      const asin = extractAsin(url);
      if (asin) {
        return {
          cartUrl: buildAmazonCartUrl(origin, asin, quantity),
          retailer: "amazon",
          method: "cart_permalink",
        };
      }
    }

    // MercadoLibre — detected here for canBuildCartLink symmetry,
    // but actual cart URL is built server-side by the existing connector.
    // This branch is only reached if buildCartPermalink is called client-side
    // (it shouldn't be — buy.ts uses the connector directly).
    return null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Verify the module compiles**

Run: `npx tsc --noEmit src/lib/cart/permalink.ts 2>&1 || echo 'type check done'`

If there's a tsconfig issue with checking a single file, just run `npm run build` at the end of the full task set.

- [ ] **Step 3: Commit**

```bash
git add src/lib/cart/permalink.ts
git commit -m "feat(cart): add cart permalink module with Amazon builder (#45)"
```

---

## Task 2: Update Client Types

**Files:**
- Modify: `src/components/chat/tool-ui-types.ts` (lines 100-125)

- [ ] **Step 1: Update `PurchaseArgs`** — remove `addToCartOnly`

Replace:
```typescript
export interface PurchaseArgs {
  productUrl: string;
  productName: string;
  quantity?: number;
  addToCartOnly?: boolean;
}
```

With:
```typescript
export interface PurchaseArgs {
  productUrl: string;
  productName: string;
  quantity?: number;
}
```

- [ ] **Step 2: Update `PurchaseResult`** — add `"cart_permalink"` to cartMethod, simplify

Replace:
```typescript
export interface PurchaseResult {
  success: boolean;
  waitingForPayment: boolean;
  paymentAutoFilled: boolean;
  mode?: "cart_only" | "full_checkout";
  addedToCart?: boolean;
  productName: string;
  productUrl: string;
  quantity?: number;
  cartMethod?: "shopify_permalink" | "marketplace_cart" | "direct_link";
  checkoutUrl?: string;
  shopifyVariant?: {
    title: string;
    price: string;
  };
  statusMessages?: string[];
  error?: string;
}
```

With:
```typescript
export interface PurchaseResult {
  success: boolean;
  addedToCart?: boolean;
  productName: string;
  productUrl: string;
  quantity?: number;
  cartMethod?: "cart_permalink" | "shopify_permalink" | "direct_link";
  cartUrl?: string;
  retailer?: string;
  shopifyVariant?: {
    title: string;
    price: string;
  };
  statusMessages?: string[];
  error?: string;
}
```

Key changes:
- Removed `waitingForPayment`, `paymentAutoFilled`, `mode` — no checkout in MVP
- Added `"cart_permalink"` to cartMethod union
- Renamed `checkoutUrl` → `cartUrl` (it's a cart link, not checkout)
- Added `retailer` field
- Removed `"marketplace_cart"` (unused)

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/tool-ui-types.ts
git commit -m "feat(types): simplify PurchaseResult for cart-first MVP (#45)"
```

---

## Task 3: Update Buy Tool

**Files:**
- Modify: `src/lib/ai/tools/buy.ts`

- [ ] **Step 1: Update imports**

Replace line 6:
```typescript
import { findConnectorForUrl } from "@/lib/connectors";
```
With:
```typescript
import { findConnectorForUrl } from "@/lib/connectors";
import { buildCartPermalink } from "@/lib/cart/permalink";
```

Note: `findConnectorForUrl` is KEPT — the MercadoLibre connector (`src/lib/connectors/mercadolibre/cart.ts`) has a working cart builder that we preserve.

- [ ] **Step 2: Remove `addToCartOnly` from input schema**

Replace the full `inputSchema` with:
```typescript
inputSchema: z.object({
  productUrl: z
    .string()
    .url()
    .describe(
      "URL to the product page — can be a Google Shopping link or a direct retailer URL"
    ),
  productName: z
    .string()
    .describe("Name of the product (for display)"),
  quantity: z
    .number()
    .optional()
    .default(1)
    .describe("Number of items to add"),
}),
```

- [ ] **Step 3: Update tool description**

Replace the `description` string with:
```typescript
description:
  "Add a product to the user's cart. For supported retailers (Amazon, MercadoLibre, Shopify), builds a direct cart link. For other stores, returns the product URL for the user to open directly.",
```

- [ ] **Step 4: Rewrite the `execute` function**

Replace the entire `execute` function body (from `async ({` to the closing `},`):

```typescript
execute: async ({ productUrl, productName, quantity }) => {
  console.log(`[Tool:purchase] START product="${productName}" url=${productUrl} qty=${quantity}`);
  const t0 = Date.now();

  const isGoogleShopping = isGoogleShoppingUrl(productUrl);

  // 1. Resolve Google Shopping redirects
  const resolvedUrl = isGoogleShopping
    ? await resolveRedirectUrl(productUrl)
    : productUrl;
  console.log(`[Tool:purchase] resolvedUrl=${resolvedUrl}`);

  // Pre-flight: reject if still on Google
  if (isGoogleUrl(resolvedUrl)) {
    console.warn(`[Tool:purchase] BLOCKED — resolved URL is still Google: ${resolvedUrl}`);
    return {
      success: false,
      addedToCart: false,
      productName,
      productUrl: resolvedUrl,
      quantity,
      cartMethod: "direct_link" as const,
      error: "This product only has a Google Shopping link — no direct retailer URL could be found. Try searching again with preferDirectLinks: true, or use search_store to find this product on a specific retailer.",
      statusMessages: [],
    };
  }

  // 2. Try cart permalink (Amazon)
  const cartResult = buildCartPermalink(resolvedUrl, quantity);
  if (cartResult) {
    console.log(`[Tool:purchase] Cart permalink SUCCESS retailer=${cartResult.retailer} elapsed=${Date.now() - t0}ms`);

    if (userId) {
      let source: string;
      try { source = new URL(resolvedUrl).hostname; } catch { source = "unknown"; }
      const signals = extractPurchaseSignals({ brand: undefined, category: undefined, price: 0, source });
      logInteraction({
        userId,
        type: "add_to_cart",
        payload: { productName, productUrl: resolvedUrl, quantity, retailer: cartResult.retailer },
        personaSignals: signals,
      }).catch(console.error);
    }

    return {
      success: true,
      addedToCart: true,
      productName,
      productUrl: resolvedUrl,
      quantity,
      cartMethod: cartResult.method,
      cartUrl: cartResult.cartUrl,
      retailer: cartResult.retailer,
      statusMessages: [],
    };
  }

  // 3. Try marketplace connector cart (MercadoLibre)
  const connector = findConnectorForUrl(resolvedUrl);
  if (connector?.tryCart) {
    const connectorResult = await connector.tryCart(resolvedUrl, quantity);
    if (connectorResult?.success) {
      console.log(`[Tool:purchase] ${connector.displayName} cart SUCCESS elapsed=${Date.now() - t0}ms`);

      if (userId) {
        const signals = extractPurchaseSignals({ brand: undefined, category: undefined, price: 0, source: connector.id });
        logInteraction({
          userId,
          type: "add_to_cart",
          payload: { productName, productUrl: resolvedUrl, quantity, connector: connector.id },
          personaSignals: signals,
        }).catch(console.error);
      }

      return {
        success: true,
        addedToCart: true,
        productName,
        productUrl: resolvedUrl,
        quantity,
        cartMethod: "cart_permalink" as const,
        cartUrl: connectorResult.checkoutUrl,
        retailer: connector.id,
        statusMessages: [],
      };
    }
  }

  // 5. Try Shopify cart permalink
  const shopifyResult = await tryShopifyCart(resolvedUrl, quantity);
  if (shopifyResult.success) {
    console.log(`[Tool:purchase] Shopify cart SUCCESS elapsed=${Date.now() - t0}ms`);

    if (userId) {
      const signals = extractPurchaseSignals({
        brand: undefined,
        category: undefined,
        price: parseFloat(shopifyResult.variant.price) || 0,
        source: shopifyResult.storeDomain,
      });
      logInteraction({
        userId,
        type: "add_to_cart",
        payload: { productName, productUrl: resolvedUrl, quantity, shopify: true },
        personaSignals: signals,
      }).catch(console.error);
    }

    return {
      success: true,
      addedToCart: true,
      productName,
      productUrl: resolvedUrl,
      quantity,
      cartMethod: "shopify_permalink" as const,
      cartUrl: shopifyResult.checkoutUrl,
      retailer: "shopify",
      shopifyVariant: {
        title: shopifyResult.variant.title,
        price: shopifyResult.variant.price,
      },
      statusMessages: [],
    };
  }

  // 6. Fallback: direct link
  console.log(`[Tool:purchase] No cart permalink available — direct link fallback elapsed=${Date.now() - t0}ms`);

  if (userId) {
    let source: string;
    try { source = new URL(resolvedUrl).hostname; } catch { source = "unknown"; }
    const signals = extractPurchaseSignals({ brand: undefined, category: undefined, price: 0, source });
    logInteraction({
      userId,
      type: "add_to_cart",
      payload: { productName, productUrl: resolvedUrl, quantity, directLink: true },
      personaSignals: signals,
    }).catch(console.error);
  }

  return {
    success: true,
    addedToCart: false,
    productName,
    productUrl: resolvedUrl,
    quantity,
    cartMethod: "direct_link" as const,
    statusMessages: [],
  };
},
```

- [ ] **Step 5: Run build to verify**

Run: `npm run build 2>&1 | tail -10`
Expected: May still fail if purchase-ui.tsx references old fields — that's OK, we fix it in Task 5.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai/tools/buy.ts
git commit -m "feat(buy): integrate cart permalink builders, remove addToCartOnly (#45)"
```

---

## Task 4: Update Product Card — Two Buttons

**Files:**
- Modify: `src/components/products/product-card.tsx`

- [ ] **Step 1: Add import for `canBuildCartLink`**

Add at top:
```typescript
import { canBuildCartLink } from "@/lib/cart/permalink";
```

- [ ] **Step 2: Update props interface**

Replace:
```typescript
interface ProductCardProps {
  product: ProductResult;
  onDetails?: (product: ProductResult) => void;
  onBuy?: (product: ProductResult) => void;
  onAddToCart?: (product: ProductResult) => void;
}
```

With:
```typescript
interface ProductCardProps {
  product: ProductResult;
  onMoreInfo?: (product: ProductResult) => void;
  onAddToCart?: (product: ProductResult) => void;
}
```

- [ ] **Step 3: Update component destructuring and handlers**

Replace the component signature and handlers:
```typescript
export function ProductCard({ product, onMoreInfo, onAddToCart }: ProductCardProps) {
```

Replace `handleDetails` with `handleMoreInfo`:
```typescript
const handleMoreInfo = (e: React.MouseEvent) => {
  e.stopPropagation();
  recordClickSignals();
  onMoreInfo?.(product);
};
```

Remove `handleBuy` entirely.

- [ ] **Step 4: Update button JSX**

Replace the entire `<div className="flex gap-1.5">` block (lines 129-154) with:

```tsx
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
```

- [ ] **Step 5: Update imports**

Add `ExternalLinkIcon` to the lucide import (remove unused icons if any):
```typescript
import { XIcon, ShoppingCartIcon, InfoIcon, PackageIcon, ExternalLinkIcon } from "lucide-react";
```

- [ ] **Step 6: Commit**

```bash
git add src/components/products/product-card.tsx
git commit -m "feat(card): two-button context-aware layout — More Info + Add to Cart/Open on Store (#45)"
```

---

## Task 5: Update Search Products UI

**Files:**
- Modify: `src/components/chat/search-products-ui.tsx`

- [ ] **Step 1: Replace `handleDetails` with `handleMoreInfo`**

Replace:
```typescript
const handleDetails = (product: ProductResult) => {
  const urlHint = product.productUrl ? ` (${product.productUrl})` : "";
  safeAppend({
    role: "user",
    content: [{ type: "text", text: `Tell me more about "${product.title}"${urlHint}` }],
  });
};
```

With:
```typescript
const handleMoreInfo = (product: ProductResult) => {
  const urlHint = product.productUrl ? ` (${product.productUrl})` : "";
  safeAppend({
    role: "user",
    content: [{ type: "text", text: `Tell me more about "${product.title}"${urlHint}` }],
  });
};
```

- [ ] **Step 2: Remove `handleBuy`**

Delete the entire `handleBuy` function (lines 42-49).

- [ ] **Step 3: Update `handleAddToCart` message**

Replace:
```typescript
const handleAddToCart = (product: ProductResult) => {
  const url = product.retailerUrl || product.productUrl;
  safeAppend({
    role: "user",
    content: [{ type: "text", text: `Add "${product.title}" to cart from ${url}` }],
  });
};
```

With:
```typescript
const handleAddToCart = (product: ProductResult) => {
  const url = product.retailerUrl || product.productUrl;
  safeAppend({
    role: "user",
    content: [{ type: "text", text: `Add to cart: "${product.title}" from ${url}` }],
  });
};
```

- [ ] **Step 4: Update ProductCard usage**

Replace:
```tsx
<ProductCard key={product.id ?? i} product={product} onDetails={handleDetails} onBuy={handleBuy} onAddToCart={handleAddToCart} />
```

With:
```tsx
<ProductCard key={product.id ?? i} product={product} onMoreInfo={handleMoreInfo} onAddToCart={handleAddToCart} />
```

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/search-products-ui.tsx
git commit -m "feat(search-ui): remove Buy button, rename Details to More Info (#45)"
```

---

## Task 6: Update Compare Products UI

**Files:**
- Modify: `src/components/chat/compare-products-ui.tsx`

This file renders its own product action buttons (not via `ProductCard`), so it needs separate updates.

- [ ] **Step 1: Rename `handleDetails` to `handleMoreInfo`**

Replace (lines 82-93):
```typescript
const handleDetails = useCallback(
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
```

With:
```typescript
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
```

- [ ] **Step 2: Replace `handleBuy` with `handleAddToCart`**

Replace (lines 95-105):
```typescript
const handleBuy = useCallback(
  (product: CompareProductsArgs["products"][number]) => {
    safeAppend({
      role: "user",
      content: [
        { type: "text", text: `Buy "${product.title}" from ${product.productUrl}` },
      ],
    });
  },
  [safeAppend]
);
```

With:
```typescript
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
```

- [ ] **Step 3: Update mobile card buttons** (lines 205-225)

Replace:
```tsx
<Button
  variant="outline"
  size="sm"
  className="flex-1"
  onClick={() => handleDetails(product)}
>
  Details
</Button>
{product.productUrl && (
  <Button
    variant="default"
    size="sm"
    className="flex-1"
    onClick={() => handleBuy(product)}
  >
    Buy
    <ExternalLinkIcon className="ml-1 size-3" />
  </Button>
)}
```

With:
```tsx
<Button
  variant="outline"
  size="sm"
  className="flex-1"
  onClick={() => handleMoreInfo(product)}
>
  More Info
</Button>
{product.productUrl && (
  <Button
    variant="default"
    size="sm"
    className="flex-1"
    onClick={() => handleAddToCart(product)}
  >
    Add to Cart
    <ExternalLinkIcon className="ml-1 size-3" />
  </Button>
)}
```

- [ ] **Step 4: Update desktop table action row** (lines 312-328)

Replace:
```tsx
<Button
  variant="outline"
  size="sm"
  onClick={() => handleDetails(product)}
>
  Details
</Button>
{product.productUrl && (
  <Button
    variant="default"
    size="sm"
    onClick={() => handleBuy(product)}
  >
    Buy
    <ExternalLinkIcon className="ml-1 size-3" />
  </Button>
)}
```

With:
```tsx
<Button
  variant="outline"
  size="sm"
  onClick={() => handleMoreInfo(product)}
>
  More Info
</Button>
{product.productUrl && (
  <Button
    variant="default"
    size="sm"
    onClick={() => handleAddToCart(product)}
  >
    Add to Cart
    <ExternalLinkIcon className="ml-1 size-3" />
  </Button>
)}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/compare-products-ui.tsx
git commit -m "feat(compare-ui): rename Details→More Info, Buy→Add to Cart (#45)"
```

---

## Task 7: Update Purchase UI

**Files:**
- Modify: `src/components/chat/purchase-ui.tsx`

- [ ] **Step 1: Update the running state** (lines 21-43)

Replace the running state text:
- `"Preparing cart link"` / `"Preparing checkout"` → just `"Adding to cart"`
- Remove the ternary on `isCartOnly` — it's always cart mode now
- Replace subtitle: `"Resolving product link and checking store compatibility..."`

Replace:
```typescript
const isCartOnly = args.addToCartOnly;
```
with nothing — remove this line entirely.

Update the running state JSX — replace:
```tsx
<p className="font-semibold text-foreground">
  {isCartOnly ? "Preparing cart link" : "Preparing checkout"} for &ldquo;{args.productName}&rdquo;
</p>
```
with:
```tsx
<p className="font-semibold text-foreground">
  Adding &ldquo;{args.productName}&rdquo; to cart
</p>
```

- [ ] **Step 2: Update error state** (lines 48-77)

Replace:
```tsx
<p className="font-semibold text-foreground">
  {isCartOnly ? "Could not add to cart" : "Checkout unavailable"}
</p>
```
with:
```tsx
<p className="font-semibold text-foreground">
  Could not add to cart
</p>
```

- [ ] **Step 3: Update Shopify permalink state** (lines 80-128)

Remove the `isCheckout` variable and ternary. The state is always "Added to Cart".

Replace:
```typescript
const isCheckout = result.mode === "full_checkout";
```
Remove this line.

Replace button text:
```tsx
{isCheckout ? "Go to Checkout" : "View Cart & Checkout"}
```
with:
```tsx
Go to Cart
```

Replace header:
```tsx
{isCheckout ? "Ready for Checkout" : "Added to Cart"}
```
with:
```tsx
Added to Cart
```

Update the `href` — replace `result.checkoutUrl` with `result.cartUrl` (we renamed this field):
```tsx
{result.cartUrl && (
  <a href={result.cartUrl} ...>
```

- [ ] **Step 4: Add new cart_permalink state** — insert before the Shopify block

Add a new block right after the error state check (before `if (result.cartMethod === "shopify_permalink")`):

```tsx
// State: Cart permalink (Amazon, etc.)
if (result.cartMethod === "cart_permalink") {
  return (
    <div className="rounded-xl border border-l-4 border-l-green-500 bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <ShoppingCartIcon className="size-5 text-green-600 dark:text-green-400" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="font-semibold text-foreground">
            Added to Cart
          </p>
          <p className="text-sm text-muted-foreground">
            &ldquo;{result.productName}&rdquo; has been added to your {result.retailer ?? "store"} cart
          </p>

          {result.cartUrl && (
            <a
              href={result.cartUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-2 self-start rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
            >
              <ExternalLinkIcon className="size-4" />
              Go to Cart
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
```

- [ ] **Step 5: Remove the `marketplace_cart` block** (lines 130-163)

Delete the entire block:
```tsx
// State: Marketplace cart (MeLi, Amazon, etc.)
if (result.cartMethod === "marketplace_cart") {
  ...
}
```

This state is replaced by the new `cart_permalink` block added in Step 4. The MercadoLibre connector now returns `cartMethod: "cart_permalink"` instead of `"marketplace_cart"`. Also remove the `StoreIcon` import if it becomes unused (it was only used by the direct_link block — check if still needed).

- [ ] **Step 6: Update direct link fallback** (after removing marketplace_cart block)

Remove the `isCartOnly` ternary in the copy. Replace:
```tsx
{isCartOnly
  ? " and add it to your cart."
  : " to complete your purchase."}
```
with:
```tsx
{" to add it to your cart."}
```

- [ ] **Step 7: Verify ExternalLinkIcon import**

Verify `ExternalLinkIcon` is in the lucide imports (it already is — line 4).

- [ ] **Step 8: Commit**

```bash
git add src/components/chat/purchase-ui.tsx
git commit -m "feat(purchase-ui): cart-permalink state, remove marketplace_cart and checkout language (#45)"
```

---

## Task 8: Update Orchestrator System Prompt

**Files:**
- Modify: `src/lib/ai/orchestrator.ts` (lines 38-55)

- [ ] **Step 1: Replace the Purchase Flow section**

Replace the entire `## Purchase Flow` block (from `## Purchase Flow` through `**Proxy support**...`) with:

```
## Purchase Flow
When the user wants to add a product to cart or buy:
1. Call \`purchase\` with the product's \`productUrl\` — Google Shopping URLs are fine, the tool resolves the redirect automatically.
2. The "Add to Cart" button on product cards IS the user's confirmation — do NOT ask again.
3. The tool builds a cart permalink for supported retailers (Amazon, MercadoLibre, Shopify) or returns a direct link for others.
4. The UI shows a button for the user to open their cart or the store page.

**After the purchase tool runs**:
   - If \`cartMethod === "cart_permalink"\`: direct cart link built (e.g., Amazon, MercadoLibre). The \`cartUrl\` opens the store with the item in cart.
   - If \`cartMethod === "shopify_permalink"\`: Shopify direct cart link. The \`cartUrl\` opens checkout with items pre-loaded.
   - If \`cartMethod === "direct_link"\`: unsupported store. The \`productUrl\` opens the product page — the user adds to cart themselves.
   - If failed: suggest trying a different retailer or using search_store.
```

Note: The "Add to Cart vs Full Checkout" paragraph and the "Proxy support" paragraph are both within the replaced range — they're removed by Step 1.

- [ ] **Step 2: Commit**

```bash
git add src/lib/ai/orchestrator.ts
git commit -m "feat(orchestrator): update system prompt for cart-first flow (#45)"
```

---

## Task 9: Build Verification & Cleanup

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: Build passes with no TypeScript errors

- [ ] **Step 2: Run lint**

Run: `npm run lint 2>&1 | grep -E "^(src/|  [0-9])" | head -20`
Expected: No new errors (existing warnings are OK)

- [ ] **Step 3: Manual verification checklist**

Verify by reading the code:
- [ ] `product-card.tsx` — only 2 buttons rendered, no `onBuy` prop
- [ ] `search-products-ui.tsx` — no `handleBuy`, no `onBuy` prop
- [ ] `compare-products-ui.tsx` — "More Info" + "Add to Cart" buttons, no "Buy" or "Details"
- [ ] `buy.ts` — no `addToCartOnly` in schema, `buildCartPermalink` called before connector before `tryShopifyCart`
- [ ] `purchase-ui.tsx` — handles `cart_permalink`, `shopify_permalink`, and `direct_link` states; NO `marketplace_cart` block
- [ ] `tool-ui-types.ts` — `PurchaseArgs` has no `addToCartOnly`, `PurchaseResult` has `cartUrl` and `"cart_permalink"` in cartMethod
- [ ] `orchestrator.ts` — no mention of "checkout" or `addToCartOnly`
- [ ] `permalink.ts` — `canBuildCartLink` covers Amazon + MercadoLibre, `buildCartPermalink` covers Amazon

- [ ] **Step 4: Final commit if any fixups needed**

```bash
git add -A
git commit -m "fix: address build/lint issues from cart-first MVP (#45)"
```
