# Shopping Assistant Agent - Implementation Plan

> **Date:** February 19, 2026
> **Target:** TinyFish Accelerator (deadline: March 29, 2026, $2M seed funding)
> **Full Research:** See `RESEARCH.md` in this repo

---

## Context

We're building an AI personal shopping agent that **learns who you are** — your style, budget, brand preferences, purchase patterns, and priorities — and uses that knowledge to proactively find deals tailored to you, then executes real purchases on your behalf once approved. The better it knows you, the better its offers convert.

**Why now:** The AI shopping agent market is heating up in 2026, but almost all competitors (Amazon Rufus, ChatGPT Shopping, Albertsons AI) are US-only. Latin America via MercadoLibre is a massive underserved gap.

**TinyFish alignment:** AgentQL's semantic web queries are purpose-built for cross-site e-commerce - their official examples are literally "Compare Product Prices" and "Collect E-commerce Pricing Data." Our demo leads with e-commerce price comparison, then layers in grocery.

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | **Next.js 15** (App Router) | Full-stack, SSR, API routes, Vercel AI SDK native |
| AI SDK | **Vercel AI SDK 6** | Streaming, tool loops, MCP support, provider-agnostic |
| LLM | **Claude** (Sonnet default, Opus for complex reasoning) | Best tool use + safety |
| UI | **shadcn/ui + assistant-ui** | Chat-native, AI-editable components |
| Database | **Supabase** (PostgreSQL + pgvector) | Structured data + vector search + auth |
| Web Agent | **TinyFish AgentQL** (JS SDK) | Semantic web queries for any e-commerce site |
| Deployment | **Vercel** | Native Next.js hosting, partner credits |

---

## Architecture: Orchestrator-Workers

Following Anthropic's recommended pattern for multi-domain tasks.

```
User ↔ Chat UI (assistant-ui + generative UI)
         ↕ streaming (Vercel AI SDK)
   Orchestrator Agent (Claude Sonnet) ← user persona injected on every call
     ├─→ Persona Engine      → Builds/updates user profile from all interactions
     ├─→ Search Worker       → Filters results by persona (brands, budget, preferences)
     ├─→ Compare Worker      → Weights by user's quality-vs-price sensitivity
     ├─→ Buy Agent           → Uses size/fit/payment data from persona
     ├─→ Price Tracker       → Monitors products matching persona interests
     └─→ Recommender         → Proactive deals based on persona behavioral patterns
         ↕
   Supabase (user_personas, user_interactions, user_stated_preferences, products, price_history)
```

**How it works:**
1. User sends natural language request ("Find the cheapest iPhone 15 across MercadoLibre and Amazon")
2. Orchestrator classifies intent and routes to appropriate worker(s)
3. Workers execute in parallel where possible (search MercadoLibre + Amazon simultaneously)
4. Results stream back via generative UI (product cards, comparison tables rendered inline)
5. User can act on results (track price, buy, get recommendation)

---

## User Persona System (Core)

The persona is the heart of the agent. Every recommendation, search result ranking, and deal surfaced is filtered through a rich, evolving user persona that learns from every interaction.

### What We Store

- **Identity & demographics:** location, language, currency, household size, life stage
- **Shopping DNA:** budget ranges by category, brand affinities/aversions, quality-vs-price spectrum, preferred retailers, size/fit data
- **Behavioral signals** (learned over time): purchase history, search patterns, click engagement, time patterns, seasonal behavior, promotion responsiveness
- **Lifestyle & interests:** dietary restrictions, hobbies, upcoming events/needs
- **Preference vectors** via pgvector: embedding of product preferences for semantic matching, continuously updated

### How the Persona Evolves

- **Explicit signals** (high confidence): onboarding questionnaire, direct chat statements ("I'm vegan"), feedback on recommendations
- **Implicit signals** (accumulated): every search/click/purchase/dismissal updates persona, agent infers patterns ("user always buys organic milk on Mondays"), price sensitivity calibrated from actual decisions

### Persona Update Loop

1. User interacts → 2. Logged to `user_interactions` → 3. Periodic Claude analysis updates persona JSON → 4. Preference vector re-embedded in pgvector → 5. Updated persona injected into next orchestrator call

### How Persona Is Used

- Injected into orchestrator system prompt on every request
- Each worker gets relevant persona slice:
  - **Search** gets brands + budget
  - **Compare** gets price sensitivity
  - **Buy** gets size/payment
  - **Recommender** gets full history

### Database Schema

```sql
CREATE TABLE user_personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  persona JSONB NOT NULL DEFAULT '{}',
  preference_vector vector(1536),
  confidence_score FLOAT DEFAULT 0.0,  -- how well we know this user (0-1)
  last_refreshed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,        -- 'search','click','purchase','dismiss','feedback','chat_statement'
  payload JSONB NOT NULL,
  persona_signals JSONB,     -- extracted signals for persona update
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_stated_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL,    -- 'brand','diet','budget','size','lifestyle'
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  source TEXT NOT NULL,      -- 'onboarding','chat','feedback','inferred'
  confidence FLOAT DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Project Structure

```
src/
  app/
    page.tsx                    # Main chat interface
    api/chat/route.ts           # AI streaming endpoint
    layout.tsx                  # Root layout
  lib/
    ai/
      orchestrator.ts           # Main agent with tool definitions + routing
      tools/
        search.ts               # Product search across platforms
        compare.ts              # Price comparison logic
        buy.ts                  # Purchase execution via AgentQL
        track.ts                # Price tracking setup
        recommend.ts            # Buy/wait recommendations
    persona/
      engine.ts                 # Persona build/update/refresh logic
      signals.ts                # Extract signals from user interactions
      inject.ts                 # Format persona for agent system prompts
      types.ts                  # Persona TypeScript types
    db/
      supabase.ts               # Supabase client + helpers
      schema.sql                # Full database schema
    agentql/
      client.ts                 # AgentQL wrapper
      queries.ts                # Reusable semantic queries
  components/
    chat/                       # Chat UI components
    products/                   # Product cards, comparison views
    ui/                         # shadcn/ui components
.env.local                      # API keys (Anthropic, Supabase, MercadoLibre, AgentQL)
CLAUDE.md                       # Project conventions for Claude Code
```

---

## Implementation Phases

### Phase 1: Project Foundation (Days 1-3)

**Step 1: Initialize Next.js project**
- `npx create-next-app@latest` with App Router, TypeScript, Tailwind, ESLint
- Install core deps: `@ai-sdk/anthropic`, `ai`, `@supabase/supabase-js`
- Install UI: `shadcn/ui` + `@assistant-ui/react`

**Step 2: Supabase setup**
- Create project, define schema:
  - `users` - User profiles and preferences
  - `products` - Normalized product data from all sources
  - `price_history` - Historical prices for tracking/trends
  - `searches` - Search history for personalization
  - `user_preferences` - Budget limits, preferred stores, categories
  - `user_personas` - Rich persona JSONB + preference vector per user
  - `user_interactions` - Every interaction logged with extracted persona signals
  - `user_stated_preferences` - Explicit preferences by category with confidence scores
- Enable pgvector for semantic product search
- Configure Row Level Security + auth (email + OAuth)

**Step 3: Basic chat UI**
- assistant-ui chat interface with streaming responses
- Vercel AI SDK `useChat` hook → `/api/chat`
- Basic Claude integration responding to messages

### Phase 2: Core Agent System (Days 4-7)

**Step 4: Orchestrator agent**
- Define Claude tools via Vercel AI SDK `tool()`:
  - `search_products` - Search across platforms
  - `compare_prices` - Cross-source price comparison
  - `get_product_details` - Deep product info from URL
  - `track_price` - Set up price monitoring
  - `get_recommendations` - Personalized suggestions
- Intent routing: classify user request → call appropriate tools

**Step 4.5: Persona Engine**
- Onboarding flow: quick questionnaire (budget, categories, brands, household, lifestyle)
- Signal extraction: every interaction logs to `user_interactions` with extracted signals
- Persona refresh: periodic Claude call analyzes recent interactions → updates persona JSONB
- Preference vector: embed persona into pgvector for semantic product matching
- Injection helper: `injectPersona(userId)` returns formatted system prompt context

**Step 5: MercadoLibre API**
- OAuth 2.0 auth flow
- Search: `/sites/{site_id}/search`
- Multi-country: MLA (Argentina), MLB (Brazil), MLM (Mexico), MLC (Chile), MCO (Colombia)
- Normalize results to common product schema

**Step 6: AgentQL integration**
- Install `agentql` JS SDK (Playwright-based)
- Reusable semantic queries:
  ```
  { products[] { name, price(integer), rating, image_url, availability } }
  ```
- `queryData()` for price extraction across any e-commerce site
- `queryElements()` + `getByPrompt()` for search bars, filters, add-to-cart
- Stealth mode for anti-bot protection

**Step 7: Amazon product data**
- Integrate Amazon Creators API (replacing deprecated PA-API 5.0)
- Fallback: AgentQL scraping for Amazon product pages
- Normalize to common schema

### Phase 3: Generative UI & Smart Features (Days 8-12)

**Persona integration across all features:**
- Search results ranked by persona relevance (not just price)
- Comparisons weighted by user's price-vs-quality sensitivity
- Recommendations explain "why this is good FOR YOU specifically"
- Price tracker auto-monitors products matching persona interests
- Persona confidence score displayed in UI (shows how well the agent knows you)

**Step 8: Generative UI components**
- Product cards streamed inline during model generation
- Price comparison tables (side-by-side multi-retailer)
- Deal alert / recommendation cards
- Purchase confirmation flow with safety guardrails
- Real-time progress: "Searching MercadoLibre... Found 23 results... Comparing prices..."

**Step 9: Price tracking & recommendations**
- Supabase Edge Functions for scheduled price checks
- Price history + trend analysis
- "Buy now" vs "wait" with reasoning based on price trends
- Push notifications for price drops (Supabase Realtime)

**Step 10: Purchase execution**
- AgentQL-powered real web navigation:
  - Search → Select → Add to cart → Checkout
- **Critical guardrail:** Always require explicit user confirmation before any purchase
- Screenshot capture at each step for transparency
- Handle login/authentication on shopping sites

### Phase 4: Polish & Demo (Days 13-16)

**Step 11: UX polish**
- Responsive design (mobile-first)
- Onboarding flow (connect accounts, set preferences, budget)
- Search history and saved products
- Multi-language (English + Spanish + Portuguese for LatAm)

**Step 12: Demo & submission**
- Record 2-3 minute demo video showing:
  - Natural language search ("Find the cheapest iPhone 15 across MercadoLibre and Amazon")
  - Real-time price comparison with generative UI
  - Purchase recommendation with reasoning
  - Real purchase execution via AgentQL
- Post on X with `#TinyFishAccelerator` `#BuildInPublic`
- Submit application before March 29

---

## Key Design Decisions

1. **E-commerce first, grocery second** - AgentQL's strengths align with cross-site product comparison. Grocery layered in via store-specific APIs later.
2. **Vercel AI SDK over raw Anthropic SDK** - Handles streaming, tool loops, and generative UI out of the box with Next.js.
3. **AgentQL for the "real web" requirement** - TinyFish wants agents navigating real interfaces, not API wrappers. AgentQL is their product.
4. **Supabase over Firebase** - SQL is better for price comparison queries, pgvector for semantic search, storage-based pricing.
5. **Orchestrator-Workers pattern** - Anthropic's recommended approach for multi-domain tasks. Each worker is focused and testable.
6. **Both markets from the start** - MercadoLibre API for LatAm + Amazon for US + AgentQL as universal fallback for any site.

---

## Verification Checklist

- [ ] Chat works: Send message → get streamed Claude response
- [ ] Search works: "Find iPhone 15 cases" → products from MercadoLibre
- [ ] AgentQL works: Extract product data from a retail website
- [ ] Compare works: "Compare prices for X" → side-by-side table
- [ ] Purchase flow: Full add-to-cart via AgentQL with user confirmation
- [ ] Generative UI: Product cards and tables render inline in chat
- [ ] Price tracking: Set alert → triggers on price change
- [ ] Deploy: Live on Vercel at accessible URL
- [ ] Persona builds: Complete onboarding → persona JSON populated with preferences
- [ ] Persona learns: Make 3 searches → persona updates with inferred preferences
- [ ] Persona-driven results: Two different personas get different result rankings for same query
- [ ] Persona injection: Orchestrator system prompt includes user persona data
- [ ] Demo video: 2-3 minutes covering all key features
- [ ] X post: Published with required hashtags

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/lib/persona/engine.ts` | Persona build/update/refresh logic |
| `src/lib/persona/signals.ts` | Extract signals from interactions |
| `src/lib/persona/inject.ts` | Format persona for agent system prompts |
| `src/lib/persona/types.ts` | Persona TypeScript types |

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| AgentQL rate limits (10-50/min) | Cache results in Supabase, batch requests, use REST API for lightweight lookups |
| Anti-bot detection on retailers | AgentQL stealth mode + proxy support + respectful rate limiting |
| Amazon API deprecation (April 2026) | AgentQL fallback for scraping, migrate to Creators API |
| MercadoLibre OAuth complexity | Start with public search endpoints (no auth needed), add OAuth for purchase |
| Purchase safety | Multi-step confirmation, spending limits, screenshot at each step |
| Context window limits | Vercel AI SDK auto-compaction, tool search with deferred loading |
