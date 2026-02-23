# Full Push Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship purchase flow, auth, onboarding, price tracking, recommendations, and deploy for TinyFish Accelerator demo.

**Architecture:** Next.js App Router with Supabase Auth (cookie-based via `@supabase/ssr`), persona engine wired to real user IDs, TinyFish Web Agent for purchase execution, AgentQL for price scraping.

**Tech Stack:** Next.js 16, Vercel AI SDK 6, Supabase Auth + PostgreSQL, @supabase/ssr, TinyFish Web Agent, AgentQL, assistant-ui, shadcn/ui, Tailwind CSS v4.

---

## Task 1: Commit & Clean Up Purchase Flow

The purchase tool, TinyFish client, and UI are already written as uncommitted WIP. Clean up dead references and commit.

**Files:**
- Delete: `src/lib/ai/tools/compare.ts`
- Delete: `src/components/chat/compare-prices-ui.tsx`
- Modify: `src/components/assistant-ui/thread.tsx:9,219` — remove compare_prices import + registration
- Already modified (WIP): `src/lib/ai/orchestrator.ts`, `src/lib/ai/types.ts`, `src/components/chat/tool-ui-types.ts`, `src/lib/agentql/queries.ts`
- Already created (WIP): `src/lib/tinyfish/client.ts`, `src/lib/ai/tools/buy.ts`, `src/components/chat/purchase-ui.tsx`

**Step 1: Remove dead compare_prices references**

In `src/components/assistant-ui/thread.tsx`:
- Remove line 9: `import { ComparePricesUI } from "@/components/chat/compare-prices-ui";`
- Remove line 219: `compare_prices: ComparePricesUI,`

**Step 2: Delete dead files**

```bash
rm src/lib/ai/tools/compare.ts src/components/chat/compare-prices-ui.tsx
```

**Step 3: Verify build**

```bash
npm run build
```

Expected: Compiles successfully with routes /, /_not-found, /api/chat.

**Step 4: Commit**

```bash
git add -A
git commit -m "Add purchase flow via TinyFish Web Agent

- TinyFish SSE client (src/lib/tinyfish/client.ts)
- Purchase tool with shipping form + safety guardrails
- Purchase UI component (loading, payment-ready, error states)
- Remove dead compare_prices tool (merged into search_products)
- Add retailerUrl field to Product type + AgentQL queries
- Update orchestrator system prompt for purchase flow"
```

---

## Task 2: Install Supabase SSR + Create Auth Utilities

**Files:**
- Modify: `package.json` — add `@supabase/ssr`
- Create: `src/lib/db/supabase-server.ts`
- Create: `src/lib/db/supabase-browser.ts`

**Step 1: Install dependency**

```bash
npm install @supabase/ssr
```

**Step 2: Create server-side Supabase client**

Create `src/lib/db/supabase-server.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from Server Component — ignore
          }
        },
      },
    }
  );
}
```

**Step 3: Create browser-side Supabase client**

Create `src/lib/db/supabase-browser.ts`:

```typescript
import { createBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowserClient() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return client;
}
```

**Step 4: Verify build**

```bash
npm run build
```

**Step 5: Commit**

```bash
git add package.json package-lock.json src/lib/db/supabase-server.ts src/lib/db/supabase-browser.ts
git commit -m "Add Supabase SSR auth utilities for cookie-based sessions"
```

---

## Task 3: Add Auth Middleware

**Files:**
- Create: `src/middleware.ts`

**Step 1: Create middleware**

Create `src/middleware.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Allow auth routes and API routes through
  if (pathname.startsWith("/auth") || pathname.startsWith("/api")) {
    return supabaseResponse;
  }

  // Redirect unauthenticated users to /auth
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users who haven't onboarded
  if (pathname !== "/onboarding") {
    const { data: persona } = await supabase
      .from("user_personas")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!persona) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

**Step 2: Verify build**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "Add auth middleware — redirect to /auth if unauthenticated"
```

---

## Task 4: Build Auth Page (Login/Signup)

**Files:**
- Create: `src/app/auth/page.tsx`

**Step 1: Create the auth page**

Create `src/app/auth/page.tsx` — a client component with email/password form, toggle between login and signup modes. On success: login redirects to `/`, signup redirects to `/onboarding`.

Use `getSupabaseBrowserClient()` from `src/lib/db/supabase-browser.ts`.
Use shadcn `Button`, `Input`, `Card` components (already installed).

The form should:
- Show "Shopping Assistant" heading
- Toggle between "Sign in" and "Create account" modes
- Email input + password input + submit button
- Error display for auth failures
- On signup success: `supabase.auth.signUp({ email, password })` → redirect to `/onboarding`
- On login success: `supabase.auth.signInWithPassword({ email, password })` → redirect to `/`
- Style with Tailwind, centered on page, max-w-sm

**Step 2: Verify build + test manually**

```bash
npm run build
npm run dev
# Open http://localhost:3000/auth — should see login form
# Signup with a test email → should redirect to /onboarding (which 404s for now, OK)
```

**Step 3: Commit**

```bash
git add src/app/auth/page.tsx
git commit -m "Add auth page with email/password login and signup"
```

---

## Task 5: Wire userId into Chat Route

**Files:**
- Modify: `src/app/api/chat/route.ts:59-63` — replace hardcoded `null` userId with session user

**Step 1: Update the chat route**

In `src/app/api/chat/route.ts`, replace:
```typescript
// TODO: Get actual userId from auth session
const userId: string | null = null;
```

With:
```typescript
import { createSupabaseServerClient } from "@/lib/db/supabase-server";

// ... inside POST handler:
const supabase = await createSupabaseServerClient();
const { data: { user } } = await supabase.auth.getUser();
const userId: string | null = user?.id ?? null;
```

Add the import at the top of the file.

**Step 2: Verify build**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "Wire real userId from Supabase auth session into chat route"
```

---

## Task 6: Build Onboarding Page

**Files:**
- Create: `src/app/onboarding/page.tsx`

**Step 1: Create the onboarding page**

Create `src/app/onboarding/page.tsx` — a client component with a multi-step form (all on one page, scrollable sections):

1. **Budget range** — 4 preset buttons (Under $50, $50–200, $200–500, $500+), single select
2. **Categories** — Multi-select chips: Electronics, Clothing, Home & Garden, Sports, Beauty, Books, Toys, Food & Grocery
3. **Brands** — Free text input, comma-separated
4. **Quality vs. Price** — 5 radio buttons (1=Cheapest always → 5=Quality first)
5. **Household** — 4 radio buttons: Living alone, Couple, Family with kids, Shared household
6. **Shopping frequency** — 4 radio buttons: Weekly, Monthly, A few times a year, Rarely
7. **Preferred retailers** — Multi-select chips: Amazon, MercadoLibre, Walmart, eBay, Other

Use `getSupabaseBrowserClient()`.
On submit: POST to `/api/onboarding` with all form data, then `router.push("/")`.

Style: centered card layout, max-w-lg, progress indicator showing which section you're on. Use shadcn Button, Card, Input, Badge for chips.

**Step 2: Create the onboarding API route**

Create `src/app/api/onboarding/route.ts`:

```typescript
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { initializePersona } from "@/lib/persona/engine";
import type { PersonaSignal } from "@/lib/persona/types";

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  // body: { budgetRange, categories, brands, qualityVsPrice, household, shoppingFrequency, retailers }

  const signals: PersonaSignal[] = [];

  // Budget
  if (body.budgetRange) {
    const ranges: Record<string, { min: number; max: number }> = {
      "under-50": { min: 0, max: 50 },
      "50-200": { min: 50, max: 200 },
      "200-500": { min: 200, max: 500 },
      "500+": { min: 500, max: 2000 },
    };
    const range = ranges[body.budgetRange];
    if (range) {
      signals.push({
        type: "budget_signal",
        key: "actual_spend",
        value: (range.min + range.max) / 2,
        confidence: 0.8,
        source: "onboarding",
      });
    }
  }

  // Categories
  if (body.categories?.length > 0) {
    for (const cat of body.categories) {
      signals.push({
        type: "category_interest",
        key: cat,
        value: 1.0,
        confidence: 0.9,
        source: "onboarding",
      });
    }
  }

  // Brands
  if (body.brands) {
    const brandList = body.brands.split(",").map((b: string) => b.trim()).filter(Boolean);
    for (const brand of brandList) {
      signals.push({
        type: "brand_preference",
        key: brand,
        value: 0.8,
        confidence: 0.85,
        source: "onboarding",
      });
    }
  }

  // Quality vs Price (1-5 scale → -1 to 1)
  if (body.qualityVsPrice) {
    signals.push({
      type: "quality_preference",
      key: "spectrum",
      value: body.qualityVsPrice >= 4 ? "quality_focused" : body.qualityVsPrice <= 2 ? "price_focused" : "balanced",
      confidence: 0.9,
      source: "onboarding",
    });
  }

  // Retailers
  if (body.retailers?.length > 0) {
    for (const retailer of body.retailers) {
      signals.push({
        type: "retailer_preference",
        key: retailer,
        value: 1.0,
        confidence: 0.9,
        source: "onboarding",
      });
    }
  }

  // Build initial persona from signals
  await initializePersona(user.id, {
    currency: "USD",
    locale: "en",
    householdSize: body.household === "living-alone" ? 1 : body.household === "couple" ? 2 : body.household === "family" ? 4 : 3,
    priceQualitySpectrum: body.qualityVsPrice ? (body.qualityVsPrice - 3) / 2 : 0,
    preferredRetailers: body.retailers ?? [],
    brandAffinities: Object.fromEntries(
      (body.brands?.split(",").map((b: string) => b.trim()).filter(Boolean) ?? []).map((b: string) => [b, 0.8])
    ),
    categoryInterests: Object.fromEntries(
      (body.categories ?? []).map((c: string) => [c, 1.0])
    ),
  });

  return Response.json({ success: true });
}
```

**Step 3: Verify build + test manually**

```bash
npm run build
npm run dev
# Sign up → should redirect to /onboarding
# Fill out form → submit → should redirect to /
```

**Step 4: Commit**

```bash
git add src/app/onboarding/page.tsx src/app/api/onboarding/route.ts
git commit -m "Add onboarding questionnaire — 7-question persona seeding flow"
```

---

## Task 7: Wire Real Price Tracking

**Files:**
- Modify: `src/lib/ai/tools/track.ts` — replace mock with Supabase writes
- Create: `src/app/api/alerts/check/route.ts` — on-demand alert checker

**Step 1: Replace mock track_price**

Rewrite `src/lib/ai/tools/track.ts` to:
- Accept `userId` from context (will need to thread it — see note below)
- Write to `price_alerts` table: `user_id`, `product_url`, `target_price`, `current_price`, `currency`, `is_active`
- Return real confirmation with alert ID

Since tools don't have access to `userId` directly, we need to pass it via a closure or tool context. The simplest approach: modify `src/lib/ai/orchestrator.ts` to export a function `getShoppingTools(userId)` that returns the tool set with `userId` bound.

Update `src/lib/ai/orchestrator.ts`:
```typescript
export function getShoppingTools(userId: string | null) {
  return {
    search_products: searchProducts,
    get_product_details: getProductDetails,
    track_price: trackPrice(userId),
    get_recommendations: getRecommendations,
    purchase: purchase,
  } satisfies ToolSet;
}
```

Update `src/lib/ai/tools/track.ts`:
```typescript
export function trackPrice(userId: string | null) {
  return tool({
    description: "Set up a price alert...",
    inputSchema: z.object({ ... }),
    execute: async ({ productName, productUrl, targetPrice, currency }) => {
      if (!userId) {
        return { status: "error", message: "You must be logged in to track prices." };
      }
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from("price_alerts")
        .insert({
          user_id: userId,
          product_url: productUrl,
          target_price: targetPrice,
          current_price: null,
          currency,
          is_active: true,
        })
        .select("id")
        .single();

      if (error) return { status: "error", message: error.message };
      return {
        status: "tracking",
        alertId: data.id,
        productName,
        targetPrice,
        currency,
        message: targetPrice
          ? `Price alert set! I'll check when ${productName} drops to ${currency} ${targetPrice}.`
          : `Now tracking ${productName}. I'll check for any price changes.`,
      };
    },
  });
}
```

Update `src/app/api/chat/route.ts` to use `getShoppingTools(userId)` instead of `shoppingTools`.

**Step 2: Create check-alerts API**

Create `src/app/api/alerts/check/route.ts`:
```typescript
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { scrapeProductDetail } from "@/lib/agentql/queries";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: alerts } = await supabase
    .from("price_alerts")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(5);

  if (!alerts || alerts.length === 0) {
    return Response.json({ alerts: [], message: "No active price alerts." });
  }

  const results = await Promise.allSettled(
    alerts.map(async (alert) => {
      if (!alert.product_url) return { ...alert, status: "no_url" };
      try {
        const detail = await scrapeProductDetail(alert.product_url);
        const priceDropped = alert.target_price
          ? detail.currentPrice <= alert.target_price
          : alert.current_price && detail.currentPrice < alert.current_price;
        return {
          id: alert.id,
          productUrl: alert.product_url,
          targetPrice: alert.target_price,
          previousPrice: alert.current_price,
          currentPrice: detail.currentPrice,
          currency: detail.currency,
          priceDropped: !!priceDropped,
          status: "checked",
        };
      } catch {
        return { id: alert.id, status: "scrape_failed" };
      }
    })
  );

  return Response.json({
    alerts: results.map((r) => (r.status === "fulfilled" ? r.value : { status: "error" })),
  });
}
```

**Step 3: Verify build**

```bash
npm run build
```

**Step 4: Commit**

```bash
git add src/lib/ai/tools/track.ts src/lib/ai/orchestrator.ts src/app/api/chat/route.ts src/app/api/alerts/check/route.ts
git commit -m "Wire real price tracking — Supabase writes + on-demand alert checker"
```

---

## Task 8: Wire Real Recommendations

**Files:**
- Modify: `src/lib/ai/tools/recommend.ts` — replace mock with persona-driven Google Shopping queries

**Step 1: Rewrite recommendations tool**

The recommendation tool should:
1. Fetch user's persona from DB (categories, brands, budget)
2. Build 2-3 targeted search queries from persona data
3. Run `scrapeGoogleShoppingSearch()` for each
4. Return real products, ranked by relevance to persona

Update `src/lib/ai/tools/recommend.ts` to accept `userId` (same pattern as `trackPrice`):

```typescript
export function getRecommendations(userId: string | null) {
  return tool({
    description: "Get personalized product recommendations...",
    inputSchema: z.object({ category, budget, currency, occasion }),
    execute: async ({ category, budget, currency }) => {
      const persona = userId ? await getPersona(userId) : null;

      // Build search queries from persona + request
      const queries: string[] = [];
      if (category) queries.push(category);
      if (persona?.persona.categoryInterests) {
        const topCategories = Object.entries(persona.persona.categoryInterests)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 2)
          .map(([cat]) => cat);
        queries.push(...topCategories.filter((c) => c !== category));
      }

      // Add brand context
      const brandHints = persona?.persona.brandAffinities
        ? Object.entries(persona.persona.brandAffinities)
            .filter(([, score]) => score > 0.3)
            .map(([brand]) => brand)
            .slice(0, 3)
        : [];

      // Search for each query
      const allProducts = [];
      for (const q of queries.slice(0, 3)) {
        const searchQuery = brandHints.length > 0
          ? `${q} ${brandHints[0]}`
          : q;
        const products = await scrapeGoogleShoppingSearch(searchQuery);
        allProducts.push(...products);
      }

      // Filter by budget
      let filtered = allProducts;
      if (budget) filtered = filtered.filter((p) => p.currentPrice <= budget);

      // Dedupe by title similarity, take top 6
      const seen = new Set();
      const unique = filtered.filter((p) => {
        const key = p.title.toLowerCase().slice(0, 30);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 6);

      return {
        recommendations: unique.map((p) => ({
          title: p.title,
          reason: brandHints.includes(p.brand ?? "")
            ? `Matches your preferred brand: ${p.brand}`
            : category
              ? `Top result in ${category}`
              : "Based on your interests",
          product: {
            title: p.title,
            currentPrice: p.currentPrice,
            currency: p.currency,
            rating: p.rating,
            source: p.source,
            retailerUrl: p.retailerUrl,
          },
          action: p.currentPrice <= (budget ?? Infinity) * 0.6 ? "buy_now" : "wait",
          confidence: persona ? Math.min(persona.confidence_score + 0.2, 1) : 0.3,
        })),
      };
    },
  });
}
```

Update orchestrator to use `getRecommendations(userId)`.

**Step 2: Verify build**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/lib/ai/tools/recommend.ts src/lib/ai/orchestrator.ts
git commit -m "Wire real recommendations — persona-driven Google Shopping queries"
```

---

## Task 9: Add Suggested Prompts to Chat Welcome

**Files:**
- Modify: `src/app/page.tsx` — add suggested prompts via assistant-ui's suggestion API

**Step 1: Add suggestions to the transport or page**

Update the chat page to include suggested prompts that showcase all features:
- "Find me the best wireless earbuds under $100"
- "Compare prices for a Nintendo Switch"
- "Track the price of the MacBook Air M4"
- "What do you recommend based on my preferences?"

Use assistant-ui's `ThreadPrimitive.Suggestions` (already rendered in thread.tsx). Need to provide suggestion data via the runtime/transport.

**Step 2: Verify build**

```bash
npm run build
```

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "Add suggested prompts to chat welcome screen"
```

---

## Task 10: Deploy to Vercel

**Step 1: Verify local build passes**

```bash
npm run build
```

**Step 2: Deploy**

```bash
npx vercel --prod
```

Set environment variables in Vercel dashboard:
- `ANTHROPIC_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AGENTQL_API_KEY`
- `TINYFISH_API_KEY`

**Step 3: Configure Supabase Auth redirect**

In Supabase Dashboard → Authentication → URL Configuration:
- Site URL: `https://<your-vercel-url>`
- Redirect URLs: `https://<your-vercel-url>/**`

**Step 4: End-to-end test on production**

1. Visit deployed URL → should see /auth page
2. Sign up with email → should redirect to /onboarding
3. Complete onboarding → should redirect to chat
4. Search for a product → should see real Google Shopping results
5. Ask to track a price → should write to Supabase
6. Ask for recommendations → should return persona-informed results
7. (Optional) Test purchase flow with TinyFish

**Step 5: Commit any deployment fixes**

```bash
git add -A
git commit -m "Fix deployment issues (if any)"
```
