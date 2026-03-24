# Cart-First MVP: Retailer Cart Permalinks

**Date:** 2026-03-24
**Issue:** #45 — Add-to-cart mode, lighter purchase flow for MVP
**Status:** Approved (rev 2 — addresses spec review findings)

## Problem

The current "Add to Cart" button is misleading for non-Shopify stores. When clicked:

1. For Shopify stores: builds a direct cart permalink (works well)
2. For all other stores: returns a "Open Product Page" link — the user lands on the product page and must manually find the product, select options, and add to cart themselves

This defeats the purpose of a shopping assistant. The user expects a pre-filled cart when they click "Add to Cart."

Additionally, the product card shows three buttons (Details, Cart, Buy) which creates decision fatigue. The MVP vision is "best option placed in cart, user approves."

## Solution

### Approach: Cart Permalink Registry + Context-Aware UI

Build direct "add to cart" URL patterns for retailers with verified GET-based cart permalinks. Dynamically show "Add to Cart" only when we can actually do it; otherwise show "Open on Store."

No TinyFish/browser automation involved — all cart links are constructed from URL patterns.

## Design

### 1. Cart Permalink Module

**New file:** `src/lib/cart/permalink.ts`

This module must be **client-safe** (no server-only imports) since `canBuildCartLink` runs in product cards at render time.

Two exports:

- `canBuildCartLink(url: string): boolean` — synchronous hostname + path check. Returns `true` only if we can extract a valid product ID from the URL for a supported retailer.
- `buildCartPermalink(url: string, quantity?: number): CartPermalinkResult | null` — constructs the cart URL using the **same origin** as the input URL (not a hardcoded domain). Returns result or `null`.

#### Supported Retailers (Launch)

| Retailer | Hostname Match | ID Extraction | Cart URL Pattern | Verified |
|----------|---------------|--------------|-----------------|----------|
| **Shopify** | (existing `tryShopifyCart` flow — async, server-only) | Scrapes `product.json` → variant ID | `/cart/{variantId}:{qty}` | Yes |
| **Amazon** | `amazon.com`, `amazon.co.uk`, `amazon.de`, `amazon.co.jp`, etc. | ASIN via regex `/\/(?:dp\|gp\/product)\/(B[A-Z0-9]{9})/` from URL path | `{sameOrigin}/gp/aws/cart/add.html?ASIN.1={ASIN}&Quantity.1={qty}` | Yes — well-documented public endpoint |

**Important:** `cartUrl` must use the same origin as the input URL (e.g., `amazon.co.uk` stays `amazon.co.uk`), not a hardcoded `amazon.com`.

#### Deferred Retailers (Need Validation)

| Retailer | Status | Issue |
|----------|--------|-------|
| **Walmart** | Deferred | No verified GET-based cart permalink. Walmart uses POST-based cart APIs. Needs research. |
| **MercadoLibre** | Deferred | No verified GET-based cart permalink. Uses session-based checkout APIs. URL forms vary (`mercadolibre.com.ar/MLA-...`, `articulo.mercadolibre.com.ar/MLA-...`). Needs research. |

These will fall back to "Open on Store" for now. Each can be added later by implementing a builder function and adding a hostname mapping — the registry pattern makes this trivial.

#### ASIN Extraction Edge Cases

- `/dp/B0XXXXXXXX` — standard product page (supported)
- `/gp/product/B0XXXXXXXX` — alternate product page (supported)
- `amzn.to/...` shortened URLs — not supported, returns `null`
- `/product-reviews/B0XXXXXXXX` — review page, not supported
- Affiliate URLs with `tag=` parameter — ASIN extraction still works if `/dp/` is in the path
- If ASIN cannot be extracted, `canBuildCartLink` returns `false` → card shows "Open on Store"

#### Types

```typescript
interface CartPermalinkResult {
  cartUrl: string;       // The pre-filled cart URL to open
  retailer: string;      // e.g. "amazon", "shopify"
  method: "cart_permalink";
}
```

### 2. Product Card — Two Buttons, Context-Aware

**Modified file:** `src/components/products/product-card.tsx`

Current:
```
[ Details ]  [ Cart ]  [ Buy ]
```

New:
```
[ More Info ]  [ Add to Cart ]     ← when canBuildCartLink(url) is true
[ More Info ]  [ Open on Store ]   ← fallback for unknown retailers
```

Changes:
- Remove `onBuy` prop entirely
- Rename `onDetails` to `onMoreInfo` (same behavior, updated label)
- `onAddToCart` remains but the button label and icon change based on `canBuildCartLink(product.retailerUrl || product.productUrl)`
- "Add to Cart" uses teal/green styling (ShoppingCartIcon) — primary CTA
- "Open on Store" uses blue styling (ExternalLinkIcon) — secondary CTA
- "More Info" uses outline styling (InfoIcon) — same as current Details

**Known limitation:** Products with `urlReliability: "google"` (unresolved Google Shopping redirects) will always show "Open on Store" since the actual retailer hostname is unknown at render time. This is acceptable — the URL gets resolved later in the buy tool if the user clicks through.

### 3. Search Products UI

**Modified file:** `src/components/chat/search-products-ui.tsx`

- Remove `handleBuy` function and `onBuy` prop from `<ProductCard>`
- Rename `handleDetails` to `handleMoreInfo` for consistency
- `handleAddToCart` message keeps the URL for unambiguous product identification:
  `"Add to cart: \"{product.title}\" from {url}"` — the orchestrator needs the URL to call the purchase tool

### 4. Buy Tool

**Modified file:** `src/lib/ai/tools/buy.ts`

**`addToCartOnly` parameter: removed from schema.** The MVP is always cart-first. The tool always attempts to add to cart. There is no full-checkout path in the MVP.

Updated flow:
1. Resolve Google Shopping redirect (existing `resolveRedirectUrl`)
2. `buildCartPermalink(resolvedUrl, quantity)` receives the **already-resolved** retailer URL, never a Google Shopping URL
3. Try `buildCartPermalink()` — covers Amazon (and future retailers)
4. If no cart permalink → try `tryShopifyCart()` (existing async Shopify flow)
5. If neither works → return `{ cartMethod: "direct_link", productUrl }` (honest fallback)

Tool description updated: "Add a product to cart. For supported retailers (Amazon, Shopify), builds a direct cart link. For other stores, returns the product URL for the user to open directly."

Return type adds `cartMethod: "cart_permalink"` alongside existing `"shopify_permalink"` and `"direct_link"`.

### 5. Purchase UI

**Modified file:** `src/components/chat/purchase-ui.tsx`

Three states:

1. **Running:** "Adding to cart..." spinner (existing, updated copy — no mention of "checkout")
2. **Cart permalink success** (`cartMethod: "cart_permalink"` or `"shopify_permalink"`):
   - Green success card
   - Product name, price (if available), retailer
   - Primary CTA: "Go to Cart" → opens the cart permalink URL in new tab
   - Secondary link: "Open product page" → opens the product URL
3. **Direct link fallback** (`cartMethod: "direct_link"`):
   - Blue info card
   - "Open on Store" with honest copy: "Open this product on the retailer's website"
   - No "added to cart" claim

### 6. Orchestrator

**Modified file:** `src/lib/ai/orchestrator.ts`

Update system prompt:
- Remove all mention of "checkout" or "buy" — MVP is cart-only
- When user says "add to cart" or clicks the cart button, call the purchase tool (no `addToCartOnly` flag needed — it's always cart mode)
- The tool will return either a cart permalink, Shopify cart, or direct link — the UI handles each case

## File Summary

| File | Action | Description |
|------|--------|-------------|
| `src/lib/cart/permalink.ts` | CREATE | Client-safe cart permalink registry — `canBuildCartLink()` + `buildCartPermalink()` with Amazon builder |
| `src/lib/ai/tools/buy.ts` | MODIFY | Remove `addToCartOnly` param, use `buildCartPermalink()` before Shopify fallback |
| `src/components/products/product-card.tsx` | MODIFY | 2 buttons, context-aware labels via `canBuildCartLink()` |
| `src/components/chat/purchase-ui.tsx` | MODIFY | Cart-permalink success state, remove checkout language |
| `src/components/chat/search-products-ui.tsx` | MODIFY | Remove `handleBuy`, rename details→moreInfo |
| `src/components/chat/tool-ui-types.ts` | MODIFY | Add `"cart_permalink"` to `cartMethod` union, remove checkout-related fields |
| `src/lib/ai/orchestrator.ts` | MODIFY | System prompt: cart-only, no checkout |

## Acceptance Criteria

1. **Amazon US**: Clicking "Add to Cart" on an Amazon product opens a new tab with the item in the Amazon cart (via `/gp/aws/cart/add.html?ASIN.1=...`)
2. **Amazon international**: Same behavior for `amazon.co.uk`, `amazon.de`, etc. — cart URL uses the same domain
3. **Shopify stores**: Existing cart permalink flow continues to work unchanged
4. **Unknown retailers**: Card shows "Open on Store" button; clicking opens the product page with honest "open on retailer's website" copy
5. **Google Shopping URLs**: Resolve to retailer URL before attempting cart permalink; if still unresolved, show "Open on Store"
6. **Product card**: Only 2 buttons visible (More Info + Add to Cart/Open on Store). No "Buy" button.
7. **No ASIN in URL**: Amazon product without extractable ASIN falls back to "Open on Store"
8. **Build passes**: No TypeScript errors, all existing tests pass

## Out of Scope

- TinyFish/AgentQL browser automation for cart filling
- Full checkout flow (payment, shipping)
- Retailer-specific size/variant selection before adding to cart
- Affiliate link integration
- Walmart cart integration (deferred — needs POST-based API research)
- MercadoLibre cart integration (deferred — needs session-based API research)

## Risks

- **Amazon cart URL pattern may change** — well-established but not officially guaranteed. Mitigation: isolated builder, easy to update.
- **ASIN extraction may miss edge cases** — shortened URLs, affiliate links. Mitigation: `canBuildCartLink` returns false, graceful fallback to "Open on Store".
- **Walmart/MercadoLibre are deferred** — MVP only covers Amazon + Shopify for true cart permalinks. Other retailers get the honest "Open on Store" fallback. Follow-up issues should be filed for each deferred retailer.
