# TinyFish Web Agent — Purchase Flow Design

**Date:** 2026-02-20

## Overview

Integrate TinyFish Web Agent (`agent.tinyfish.ai/v1/automation/run-sse`) to enable full purchase execution through the chat interface. Two tools with a mandatory user confirmation gate between them.

## Architecture

```
User: "Buy this from Amazon"
  → Claude calls add_to_cart(productUrl, quantity)
    → TinyFish Web Agent navigates, adds to cart (stealth mode)
    → Returns: cart summary + base64 screenshot
  → Claude shows cart UI, asks user to confirm
  → User: "Yes, checkout"
  → Claude calls checkout(productUrl, shippingNotes?)
    → TinyFish completes checkout flow (stops before final payment)
    → Returns: order summary + screenshot
  → Claude shows checkout summary
```

## New Files

### `src/lib/tinyfish/client.ts`
- SSE client for `POST agent.tinyfish.ai/v1/automation/run-sse`
- Auth: `X-API-Key` header from `TINYFISH_API_KEY` env var
- Consumes SSE stream, collects STATUS events, returns COMPLETE result
- Supports `browser_profile: "stealth"` and proxy options

### `src/lib/ai/tools/buy.ts`
- `add_to_cart` tool: Takes product URL + quantity, returns cart state + screenshot
- `checkout` tool: Proceeds from current cart to checkout, returns order summary + screenshot
- Both use `tinyfish/client.ts` with natural language goals

### `src/components/chat/buy-product-ui.tsx`
- Shows add-to-cart progress and result
- Displays screenshot of cart state
- Clear "items added" confirmation with product details

### `src/components/chat/checkout-ui.tsx`
- Shows checkout progress and result
- Displays screenshot of checkout page
- Order summary with total, shipping, etc.

### Modified Files
- `src/lib/ai/orchestrator.ts` — Add buy tools + update system prompt with safety instructions
- `src/components/assistant-ui/thread.tsx` — Register new UI components
- `src/components/chat/tool-ui-types.ts` — Add types for buy tools
- `src/components/products/source-badge.tsx` — No changes needed (already has retailer badges)

## Safety Guardrails

1. Claude MUST ask for explicit user confirmation before calling `checkout`
2. System prompt enforces: "NEVER call checkout without user saying 'yes', 'confirm', 'proceed', or equivalent"
3. Checkout goal instructs TinyFish to stop before submitting payment
4. Screenshots at every step for transparency

## TinyFish API Details

```
POST https://agent.tinyfish.ai/v1/automation/run-sse
Headers: X-API-Key, Content-Type: application/json
Body: { url, goal, browser_profile: "stealth" }
Response: SSE stream → streamingUrl, STATUS events, COMPLETE with resultJson
```
