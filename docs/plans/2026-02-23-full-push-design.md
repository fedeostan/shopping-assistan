# Full Push: Purchase + Auth + Price Tracking + Deploy

**Date:** 2026-02-23
**Goal:** Ship all remaining features for TinyFish Accelerator demo (deadline March 29)

---

## 1. Commit & Clean Up Purchase Flow

The TinyFish Web Agent purchase tool is already written (uncommitted WIP). Tasks:
- Commit `src/lib/tinyfish/client.ts`, `src/lib/ai/tools/buy.ts`, `src/components/chat/purchase-ui.tsx`
- Remove dead `compare_prices` registration from `thread.tsx` (tool merged into `search_products`)
- Remove or clean up `src/lib/ai/tools/compare.ts` (currently an empty comment file)
- Remove `ComparePricesUI` import from `thread.tsx`
- Verify `TINYFISH_API_KEY` env var is set

## 2. Supabase Auth (Email/Password)

### Dependencies
- `@supabase/ssr` for cookie-based auth in Next.js App Router

### Files
- `src/lib/db/supabase-server.ts` — Server-side Supabase client with cookie handling
- `src/lib/db/supabase-browser.ts` — Browser-side Supabase client
- `src/middleware.ts` — Refresh auth session on every request
- `src/app/auth/page.tsx` — Login/signup page (email + password form, toggle between modes)
- `src/app/api/chat/route.ts` — Extract `userId` from session, pass to persona engine

### Behavior
- Unauthenticated users → redirect to `/auth`
- After signup → redirect to `/onboarding`
- After login (returning user) → redirect to `/` (chat)
- Session stored in cookies (SSR-compatible)

## 3. Onboarding Questionnaire

### Route: `/onboarding`

Multi-step form (single page with sections, not separate routes):

1. **Budget range** — Preset buttons: Under $50, $50–200, $200–500, $500+
2. **Favorite categories** — Multi-select chips: Electronics, Clothing, Home & Garden, Sports, Beauty, Books, Toys, Food & Grocery
3. **Brand preferences** — Free text input (comma-separated)
4. **Quality vs. price** — 5-point scale slider (1 = cheapest always, 5 = quality first)
5. **Household** — Single select: Living alone, Couple, Family with kids, Shared household
6. **Shopping frequency** — Single select: Weekly, Monthly, A few times a year, Rarely
7. **Preferred retailers** — Multi-select chips: Amazon, MercadoLibre, Walmart, eBay, Other

### On submit
- Call `initializePersona(userId, signals)` with extracted signals
- Set `user_personas.onboarding_completed = true`
- Redirect to `/` (chat)

### Returning users
- Check `onboarding_completed` flag; skip if already done

## 4. Real Price Tracking

### track_price tool (replace mock)
- Validate user is authenticated
- Write to `price_alerts` table: product_name, product_url, target_price, current_price, currency, user_id
- Return real confirmation with alert ID

### Check alerts API: `GET /api/alerts/check`
- Fetch user's active `price_alerts` from Supabase
- For each alert with a `product_url`: re-scrape via `scrapeProductDetail()` to get current price
- Compare with target_price, return status per alert (price dropped / still above / scrape failed)
- Rate-limit to avoid hammering AgentQL (max 5 checks per request)

### UI
- Add "Check my alerts" action in the chat welcome or as a suggested prompt
- Alert results shown as a chat response (Claude summarizes which prices dropped)

## 5. Recommendations (replace mock)

- Wire `get_recommendations` to use `search_products` internally with persona-informed queries
- Query user's persona for preferred categories, brands, budget
- Run 2-3 targeted Google Shopping searches based on persona
- Return real products ranked by persona relevance

## 6. Vercel Deployment

- Configure env vars in Vercel dashboard
- `vercel deploy --prod`
- Verify all features work on deployed URL
- Update CORS/redirect URLs for Supabase Auth

---

## Sequence

1. Commit purchase flow WIP (cleanup)
2. Add Supabase Auth
3. Build onboarding questionnaire
4. Wire real price tracking
5. Wire real recommendations
6. Deploy to Vercel
7. End-to-end test on production URL
