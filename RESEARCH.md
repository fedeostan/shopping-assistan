# Shopping Assistant Agent - Deep Research Report

> **Date:** February 19, 2026
> **Objective:** Define architecture, tech stack, and strategy for building an AI-powered personal shopping assistant agent
> **Target:** TinyFish Accelerator application (deadline: March 29, 2026)

---

## Table of Contents

1. [TinyFish Accelerator Requirements](#1-tinyfish-accelerator-requirements)
2. [Competitor & Market Landscape](#2-competitor--market-landscape)
3. [Anthropic's Agent Building Best Practices](#3-anthropics-agent-building-best-practices)
4. [Recommended Architecture](#4-recommended-architecture)
5. [Tech Stack Decision](#5-tech-stack-decision)
6. [Available APIs & Data Sources](#6-available-apis--data-sources)
7. [Key Open Source References](#7-key-open-source-references)
8. [Implementation Strategy](#8-implementation-strategy)
9. [Sources](#9-sources)

---

## 1. TinyFish Accelerator Requirements

### Program Overview
- **Duration:** 9 weeks (started Feb 17, 2026)
- **Funding:** $2M seed pool (Mango Capital / Robin Vasan)
- **Format:** 100% remote
- **Deadline:** March 29, 2026

### Three Phases
1. **Apply Phase (6 weeks):** Build with free API credits, share work publicly on X
2. **Build Phase (2 weeks):** Partner tools access, weekly mentorship, production support
3. **Review Phase + Demo Day (3 days):** Live pitches, real-time funding decisions

### What They Want
- **Working code, NOT pitch decks** - they explicitly stated this multiple times
- A functional app using TinyFish that navigates **real web interfaces**
- Must execute **real transactions** (not API wrappers)
- 2-3 minute demo video showing the agent performing real tasks
- Public X post with `#TinyFishAccelerator` and `#BuildInPublic`

### Why a Shopping Assistant Fits Perfectly
- Performs a valuable, real-world task (finding best prices, comparing products)
- Requires multi-step web workflows (searching stores, comparing, managing carts)
- TinyFish's AgentQL/WebQL is purpose-built for navigating e-commerce sites
- Addresses a clear consumer pain point with measurable value
- Latin American market (MercadoLibre) is underserved by US-focused competitors

### Partner Credits Available
Google Cloud, Vercel, ElevenLabs, MongoDB, Fireworks.ai, Composio, and 15+ more companies offering free credits.

---

## 2. Competitor & Market Landscape

### Major Corporate Players

| Player | Key Stats | Focus |
|--------|-----------|-------|
| **Amazon Rufus** | $12B incremental sales, 300M+ users, 60% higher conversion | US e-commerce, "Buy For Me" cross-retailer feature |
| **ChatGPT Shopping** | Embedded checkout, partnerships with Target/Instacart/DoorDash | US general shopping |
| **Albertsons AI** | Reduces shopping to ~4 minutes | US grocery, recipe digitization |
| **Uber Eats Cart Assistant** | Turns handwritten lists into checkout-ready baskets (Feb 2026) | US grocery delivery |
| **Kroger + Google Gemini** | Google Cloud powered | US grocery |

### Startups & Niche Players
- **Phia** - Price comparison (co-founded by Phoebe Gates)
- **OneOff** - Product recommendations based on celebrity looks
- **Pantry Pilot** - AI grocery agent
- **GroceryAI** - Dedicated grocery assistant

### Critical Gap: Latin America
**Almost all competitors are US-focused.** No major AI shopping agent serves the Latin American market (MercadoLibre, Rappi, local supermarkets). This is our differentiation opportunity.

### Market Outlook
- ~25% of Americans 18-39 have used AI to shop
- 2026 is "the year AI shopping agent wars heat up" (Modern Retail)
- Consumer adoption is the key challenge - narrow focus beats broad ambition
- Anthropic's own experiment: Claude running a shop lost money because it gave too many discounts - highlights the need for well-designed guardrails

---

## 3. Anthropic's Agent Building Best Practices

### Core Philosophy
> "Start simple, add complexity only when demonstrably improving outcomes."

Anthropic explicitly cautions against heavy frameworks. Start with direct API calls and add layers only when measurement proves they help.

### The Five Composable Workflow Patterns

1. **Prompt Chaining** - Sequential LLM calls with programmatic quality gates between steps
2. **Routing** - Classify inputs and direct to specialized handlers (e.g., simple queries → Haiku, complex → Opus)
3. **Parallelization** - Run simultaneous tasks (sectioning for independent subtasks, voting for multi-perspective)
4. **Orchestrator-Workers** - Central LLM dynamically decomposes tasks and delegates to worker LLMs
5. **Evaluator-Optimizer** - One LLM generates, another evaluates in a refinement loop

**For our shopping assistant:** The **Orchestrator-Workers** pattern is the best fit - a central agent that understands user intent and delegates to specialized workers (price comparison worker, product search worker, purchase execution worker).

### Tool Design: Agent-Computer Interface (ACI)

Anthropic treats tool design as equivalent to UX design:

- **Quality over quantity** - Fewer, well-crafted tools beat many mediocre ones
- **Consolidate operations** - One `find_best_deal` tool > separate `search`, `compare`, `filter` tools
- **Search over list** - `search_products` not `list_all_products` (saves tokens)
- **Poka-yoke** - Design structural constraints that prevent common errors
- **Meaningful returns** - Return human-readable fields, not raw IDs
- **Token efficiency** - Implement pagination, filtering, truncation with sensible defaults

### Advanced Tool Use Features

| Feature | Benefit |
|---------|---------|
| **Tool Search (defer_loading)** | 85% reduction in token usage, tools loaded on-demand |
| **Programmatic Tool Calling** | Claude writes Python to orchestrate tools, 37% token reduction |
| **Tool Use Examples** | Accuracy improvement from 72% to 90% |

### The Agent Loop (4 Steps)
1. **Gather Context** → Retrieve relevant info (search, APIs, user history)
2. **Take Action** → Execute tasks using tools
3. **Verify Work** → Validate output (rules-based, visual, LLM-as-judge)
4. **Iterate** → Refine based on feedback

### Memory & Context Management
- **CLAUDE.md files** for project-level persistent instructions
- **Compaction** - Auto-summarize conversation when approaching limits
- **Session persistence** - Resume sessions with full context
- **Progressive disclosure** - Load information in tiers (minimal → full → detailed)

### Guardrails
- **Parallel safety checks** - Run content screening alongside query processing
- **Vote-based thresholds** - Multiple evaluations for critical decisions (like purchases)
- **Iteration limits** - Always cap loop counts
- **Sandboxed execution** - Never trust agent code in production without sandboxing
- **Hooks** - Validate inputs/outputs at lifecycle points

---

## 4. Recommended Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                 │
│  ┌──────────┐ ┌──────────────┐ ┌─────────────────┐  │
│  │ Chat UI  │ │ Generative   │ │ Product Cards / │  │
│  │(assistant│ │ UI Components│ │ Comparison Views│  │
│  │   -ui)   │ │ (streaming)  │ │   (shadcn/ui)   │  │
│  └──────────┘ └──────────────┘ └─────────────────┘  │
└──────────────────────┬──────────────────────────────┘
                       │ Streaming (Vercel AI SDK)
┌──────────────────────┴──────────────────────────────┐
│              API Layer (Next.js API Routes)           │
│  ┌──────────────────────────────────────────────┐    │
│  │         Orchestrator Agent (Claude)           │    │
│  │  Routes intent → delegates to worker agents   │    │
│  └──────┬───────┬───────┬───────┬───────┬───────┘    │
│         │       │       │       │       │            │
│    ┌────┴──┐┌───┴───┐┌──┴──┐┌──┴───┐┌──┴────┐       │
│    │Search ││Compare││Buy  ││Track ││Recom- │       │
│    │Worker ││Worker ││Agent││Price ││mend   │       │
│    └───────┘└───────┘└─────┘└──────┘└───────┘       │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────┐
│                   External Services                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│  │MercadoL. │ │ TinyFish │ │ Amazon   │             │
│  │  API     │ │  AgentQL │ │  API     │             │
│  └──────────┘ └──────────┘ └──────────┘             │
│  ┌──────────┐ ┌──────────┐                          │
│  │ Supabase │ │ Price    │                          │
│  │ (DB+Vec) │ │ APIs     │                          │
│  └──────────┘ └──────────┘                          │
└─────────────────────────────────────────────────────┘
```

### Agent Architecture: Orchestrator-Workers

**Orchestrator Agent** (Claude Opus/Sonnet)
- Understands user intent via natural language
- Routes to appropriate worker agents
- Manages conversation context and memory
- Presents results via generative UI

**Worker Agents:**
| Worker | Responsibility | Tools |
|--------|---------------|-------|
| **Search Worker** | Find products across platforms | MercadoLibre API, Amazon API, TinyFish web scraping |
| **Compare Worker** | Price comparison, feature analysis | Database queries, price APIs |
| **Buy Agent** | Execute purchases with user confirmation | TinyFish AgentQL for real web navigation |
| **Price Tracker** | Monitor prices, alert on deals | Supabase scheduled functions, price APIs |
| **Recommender** | Personalized suggestions, buy timing | User history (Supabase), market data |

### Why This Architecture

Following Anthropic's own recommendations:
1. **Orchestrator-Workers** pattern handles the dynamic, multi-domain nature of shopping
2. **Tool search with deferred loading** keeps token costs manageable across many e-commerce tools
3. **Generative UI** lets the agent render rich product cards, comparison tables, and checkout flows
4. **TinyFish AgentQL** handles the "real web navigation" requirement for the accelerator

---

## 5. Tech Stack Decision

### Final Recommendations

| Layer | Choice | Why |
|-------|--------|-----|
| **Framework** | **Next.js 15 (App Router)** | Full-stack, SSR, API routes, native Vercel AI SDK integration, best AI code generation support |
| **AI SDK** | **Vercel AI SDK 6** | Streaming-first, tool loops via `ToolLoopAgent`, MCP support, provider-agnostic |
| **LLM** | **Claude (Sonnet for speed, Opus for complex reasoning)** | Best tool use, safety, reasoning. Route simple tasks to Haiku for cost savings |
| **UI Components** | **shadcn/ui + assistant-ui** | AI-editable components, chat-native UI, 50k+ monthly downloads |
| **Database** | **Supabase** | PostgreSQL + pgvector for semantic search, unlimited API requests pricing, open source, better for structured product/price data, built-in auth |
| **Web Agent** | **TinyFish AgentQL** | Required for accelerator; real web navigation/scraping for stores without APIs |
| **Real-time** | **Vercel AI SDK streaming + generative UI** | Server-streamed UI components during model generation |
| **Deployment** | **Vercel** | Native Next.js hosting, edge functions, partner credits from TinyFish |
| **State Management** | **TanStack Query** | Server state caching, optimistic updates |

### Why Supabase over Firebase

| Factor | Supabase | Firebase |
|--------|----------|---------|
| **Query language** | Full SQL | NoSQL (limited querying) |
| **Vector search** | Built-in pgvector | Requires external service |
| **Pricing** | Storage-based (unlimited API calls) | Per-read/write (expensive at scale) |
| **Product data** | Structured relational data is natural fit | Document model is awkward for comparisons |
| **Open source** | Yes, self-hostable | No |
| **Complex joins** | Native SQL joins for price comparisons | Requires denormalization or client-side joins |

### Why Next.js over React SPA

- API routes serve as backend for agent calls (no separate server needed)
- SSR for SEO on product pages and shared comparisons
- Vercel AI SDK is purpose-built for Next.js
- Edge functions for low-latency agent responses
- LLMs generate higher-quality Next.js code (dominates training data)

---

## 6. Available APIs & Data Sources

### MercadoLibre API (Latin America - Primary Market)
- **Search:** `GET /sites/{site_id}/search` - search active listings
- **Auth:** OAuth 2.0
- **Rate limit:** 1,500 req/min per seller
- **Site IDs:** MLA (Argentina), MLB (Brazil), MLM (Mexico), MLC (Chile), MCO (Colombia)
- **For 1000+ results:** Use `search_type=scan`
- [Documentation](https://developers.mercadolibre.com.ar/en_us/api-docs)

### Amazon Product Data
- **Product Advertising API 5.0** - Being deprecated April 30, 2026
- **Amazon Creators API** - The replacement; use this for new projects
- **Third-party alternative:** Canopy API (REST & GraphQL, free tier: 100 req/month)
- [PA-API Docs](https://webservices.amazon.com/paapi5/documentation/)

### Grocery & Price Comparison APIs
| API | Type | Best For |
|-----|------|----------|
| **PriceAPI** | Price tracking | Amazon, Google Shopping, eBay data collection |
| **Walmart API** | Official | US grocery prices |
| **Kroger API** | Official | US grocery + digital coupons |
| **Google Shopping Content API** | Official | Cross-merchant price competitiveness |
| **Zyte Grocery Scraper** | ML-powered | Anti-ban scraping with structured output |
| **Apify** | Web scraping | AI product matcher for cross-site comparison |

### TinyFish AgentQL (Core Integration)

AgentQL is a **semantic query language** that uses natural-language field names instead of CSS selectors. Queries are self-healing (survive UI changes) and cross-site compatible.

**Three core methods:**
- `queryData(query)` → Returns structured JSON (product name, price, rating)
- `queryElements(query)` → Returns Playwright locators for interaction
- `getByPrompt("the search bar")` → Single element by natural language

**Query syntax example:**
```
{ products[] { name, price(integer), rating, description } }
```

**SDKs:** JavaScript (`npm install agentql`) and Python (`pip install agentql`), both Playwright-based. Also a REST API at `api.agentql.com/v1/query-data`.

**Best for:** General e-commerce browsing and price comparison across any website. Official examples include "Compare Product Prices" and "Collect E-commerce Pricing Data."

**Pricing:** Free tier: 300 calls. Starter: $0.02/call. Professional: $99/mo for 10k calls at $0.015/call.

**Integrations:** LangChain, LlamaIndex, Google ADK, MCP (Model Context Protocol).

- [AgentQL Docs](https://docs.agentql.com/home)
- [AgentQL GitHub (25 examples)](https://github.com/tinyfish-io/agentql)
- [AgentQL REST API](https://docs.agentql.com/rest-api/api-reference)

---

## 7. Key Open Source References

| Project | Stack | What to Learn |
|---------|-------|---------------|
| [**NVIDIA Retail Shopping Assistant**](https://github.com/NVIDIA-AI-Blueprints/retail-shopping-assistant) | LangGraph, Docker, NIM | Multi-agent architecture, real-time streaming, cart management |
| [**ShoppingGPT**](https://github.com/Hoanganhvu123/ShoppingGPT) | Gemini, RAG, SQLite | Semantic routing, query handling patterns |
| [**Redis Shopping AI Agent**](https://github.com/redis-developer/shopping-ai-agent-langgraph-js-demo) | LangGraph JS, Redis | Recipe tools, semantic caching for grocery |
| [**AI Shopping Agent (Codefest)**](https://github.com/Ranjuna120/ai-shopping-agent) | React, Flask, OpenAI | Multi-platform scraping (eBay, Walmart), price comparison |
| [**Vercel AI SDK Demos**](https://github.com/vercel/ai) | Next.js, AI SDK | Streaming patterns, generative UI, tool loops |
| [**Claude Agent SDK Demos**](https://github.com/anthropics/claude-agent-sdk-demos) | Python/TS | Anthropic's official agent patterns |

---

## 8. Implementation Strategy

### Phase 1: Foundation (Week 1)
- Next.js 15 project setup with App Router
- Supabase project + schema (users, products, price_history, searches)
- Vercel AI SDK 6 integration with Claude
- Basic chat UI with assistant-ui + shadcn/ui
- Single agent: product search via MercadoLibre API

### Phase 2: Multi-Agent System (Week 2)
- Orchestrator agent with intent routing
- Search worker (MercadoLibre + Amazon)
- Compare worker (side-by-side pricing)
- Generative UI: product cards, comparison tables streamed from server
- TinyFish AgentQL integration for web scraping

### Phase 3: Smart Features (Week 3)
- Price tracking + alerts (Supabase scheduled functions)
- Purchase recommendations ("buy now" vs "wait - price dropping")
- User preference learning (pgvector for semantic matching)
- Purchase execution via TinyFish (real web navigation)

### Phase 4: Polish & Demo (Week 4)
- Real-time streaming UI refinement
- Error handling and guardrails (purchase confirmation, spending limits)
- Record demo video (2-3 minutes)
- Post on X with #TinyFishAccelerator #BuildInPublic
- Submit application

### Key Principles (from Anthropic)
1. **Start simple** - Get one flow working end-to-end before adding complexity
2. **Measure everything** - Add agent complexity only when evaluation proves it helps
3. **Invest in tool design** - Well-crafted tools > more tools
4. **Guardrails through architecture** - Parallel safety checks on purchases
5. **Evaluation-driven** - Build test cases for each agent capability

---

## 9. Sources

### Anthropic Official
- [Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)
- [Writing Tools for Agents](https://www.anthropic.com/engineering/writing-tools-for-agents)
- [Effective Harnesses for Long-Running Agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [Advanced Tool Use](https://www.anthropic.com/engineering/advanced-tool-use)
- [Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Building Agents with Claude Agent SDK](https://claude.com/blog/building-agents-with-the-claude-agent-sdk)
- [Agent Skills](https://claude.com/blog/equipping-agents-for-the-real-world-with-agent-skills)
- [Claude Agent SDK Python](https://github.com/anthropics/claude-agent-sdk-python)
- [Claude Agent SDK Demos](https://github.com/anthropics/claude-agent-sdk-demos)

### TinyFish
- [TinyFish Accelerator](https://www.tinyfish.ai/accelerator)
- [TinyFish Launch - BusinessWire](https://www.businesswire.com/news/home/20250820555825/en/)

### Market & Competitors
- [Amazon Rufus AI 2026](https://ecomclips.com/blog/amazon-rufus-ai-2026/)
- [Fortune - Rufus $10B](https://fortune.com/2025/11/02/amazon-rufus-ai-shopping-assistant-chatbot-10-billion-sales-monetization/)
- [Modern Retail - AI Shopping Agent Wars](https://www.modernretail.co/technology/why-the-ai-shopping-agent-wars-will-heat-up-in-2026/)
- [WEF - AI Shopping Agents](https://www.weforum.org/stories/2025/11/ai-shopping-agents-energy-news/)

### Tech Stack
- [Vercel AI SDK 6](https://vercel.com/blog/ai-sdk-6)
- [AI SDK Docs](https://ai-sdk.dev/docs/introduction)
- [Next.js vs React 2026](https://nextjstemplates.com/blog/nextjs-vs-reactjs)
- [Supabase vs Firebase](https://www.bytebase.com/blog/supabase-vs-firebase/)
- [assistant-ui](https://github.com/assistant-ui/assistant-ui)
- [AG-UI Protocol](https://www.marktechpost.com/2025/09/18/bringing-ai-agents-into-any-ui-the-ag-ui-protocol-for-real-time-structured-agent-frontend-streams/)

### APIs
- [MercadoLibre API Docs](https://developers.mercadolibre.com.ar/en_us/api-docs)
- [Amazon PA-API 5.0 Docs](https://webservices.amazon.com/paapi5/documentation/)
- [PriceAPI](https://www.priceapi.com/)
- [Canopy API](https://www.canopyapi.co/)

### Open Source References
- [NVIDIA Retail Shopping Assistant](https://github.com/NVIDIA-AI-Blueprints/retail-shopping-assistant)
- [Cloudflare Anthropic Patterns Guide](https://github.com/cloudflare/agents/blob/main/guides/anthropic-patterns/README.md)
- [Anthropic Cookbook - Agent Patterns](https://github.com/anthropics/anthropic-cookbook/tree/main/patterns/agents)
