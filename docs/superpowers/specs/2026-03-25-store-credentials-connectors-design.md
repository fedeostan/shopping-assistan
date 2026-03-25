# Store Credentials & Connectors — Design Spec

**Date:** 2026-03-25
**Issue:** #60
**Status:** Approved

## Overview

Add encrypted store credentials management and a chat-integrated connector system. Users save retailer login credentials (Amazon, MercadoLibre, etc.), toggle them on/off in chat, and the shopping agent uses authenticated sessions for better prices, member deals, and access to session-gated content.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Profile: /profile/credentials                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │ Add Credential → Select Retailer → Save (enc)   │ │
│  │ List → Card per credential (icon, name, status) │ │
│  │ Remove → Hard delete                            │ │
│  └─────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────┤
│  Chat: + Menu → Connectors Section                   │
│  ┌─────────────────────────────────────────────────┐ │
│  │ Toggle mode: switch connectors on/off           │ │
│  │ Targeted mode: radio select → single retailer   │ │
│  └─────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────┤
│  Search Pipeline                                     │
│  ┌─────────────────────────────────────────────────┐ │
│  │ 0 connectors: current flow (SerpAPI + AgentQL)  │ │
│  │ 1-3 connectors: parallel TinyFish auth agents   │ │
│  │ >3 connectors: auto-pick 3 most relevant        │ │
│  │ targeted: single agent, one retailer only       │ │
│  └─────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────┤
│  Supabase: store_credentials table (AES-256-GCM)    │
│  Persona: activeConnectors[] for toggle state        │
└─────────────────────────────────────────────────────┘
```

## 1. Supabase Schema

### New table: `store_credentials`

```sql
CREATE TABLE store_credentials (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  retailer_id     TEXT NOT NULL,        -- e.g. "amazon", "mercadolibre", "custom_abc123"
  retailer_name   TEXT NOT NULL,        -- display name, e.g. "Amazon" or "My Custom Store"
  retailer_url    TEXT,                 -- base URL for custom stores (null for pre-defined)
  retailer_icon   TEXT,                 -- icon identifier for UI (null for custom)
  username        TEXT NOT NULL,        -- email/username (stored in plaintext for display)
  encrypted_data  TEXT NOT NULL,        -- AES-256-GCM encrypted JSON: { password: string }
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'verified', 'failed')),
  verified_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, retailer_id)        -- one credential per retailer per user
);

-- RLS: user can only access their own credentials
ALTER TABLE store_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own credentials"
  ON store_credentials FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Max 10 credentials per user (enforced in API, not DB)
```

### Persona extension: `activeConnectors`

Add to `UserPersona` type:
```typescript
activeConnectors?: string[];  // retailer_ids that are toggled on
```

No migration needed — this is a JSONB field in `user_personas.persona`.

## 2. Pre-defined Retailers

```typescript
export const PREDEFINED_RETAILERS = [
  { id: "amazon",       name: "Amazon",       icon: "amazon",       url: "https://www.amazon.com",           loginUrl: "https://www.amazon.com/ap/signin" },
  { id: "mercadolibre", name: "MercadoLibre", icon: "mercadolibre", url: "https://www.mercadolibre.com",     loginUrl: "https://www.mercadolibre.com/jms/login" },
  { id: "ebay",         name: "eBay",         icon: "ebay",         url: "https://www.ebay.com",             loginUrl: "https://signin.ebay.com" },
  { id: "walmart",      name: "Walmart",      icon: "walmart",      url: "https://www.walmart.com",          loginUrl: "https://www.walmart.com/account/login" },
  { id: "bestbuy",      name: "Best Buy",     icon: "bestbuy",      url: "https://www.bestbuy.com",          loginUrl: "https://www.bestbuy.com/identity/signin" },
  { id: "target",       name: "Target",       icon: "target",       url: "https://www.target.com",           loginUrl: "https://www.target.com/account" },
  { id: "alibaba",      name: "Alibaba",      icon: "alibaba",      url: "https://www.alibaba.com",          loginUrl: "https://login.alibaba.com" },
  { id: "shein",        name: "Shein",        icon: "shein",        url: "https://www.shein.com",            loginUrl: "https://www.shein.com/user/auth/login" },
  { id: "temu",         name: "Temu",         icon: "temu",         url: "https://www.temu.com",             loginUrl: "https://www.temu.com/login.html" },
] as const;
```

Each retailer gets a site-specific TinyFish login goal (see Section 6).

## 3. Credentials Page

**Route:** `/profile/credentials`
**Navigation:** Link from profile page (new section below Shipping Address)

### States

**Empty state:**
- Store icon illustration
- "Connect your store accounts"
- "Add credentials to let the shopping agent access member prices, saved addresses, and personalized deals."
- Primary button: "Add Credential"

**List state:**
- Grid of credential cards (responsive: 1 col mobile, 2 col desktop)
- Each card: retailer icon, retailer name, username (truncated), status badge, remove button
- Status badges: "Verifying..." (yellow pulse), "Verified" (green), "Failed" (red + retry button)
- "Add Credential" button in top-right

### Add Credential Flow (Sheet/Modal)

1. **Step 1 — Select Retailer**
   - Grid of retailer buttons (icon + name) for pre-defined options
   - "Custom Store" button at bottom
   - If custom: text inputs for Store Name and Store URL

2. **Step 2 — Enter Credentials**
   - Email/Username field
   - Password field (type=password)
   - "Save" button
   - Note: "Your password is encrypted with AES-256 and never visible again."

3. **On Save:**
   - POST `/api/credentials` → encrypts password, stores in Supabase
   - Immediately fires background TinyFish verification (login test)
   - Card appears in list with "Verifying..." status
   - Background: TinyFish navigates to login URL, enters credentials, reports success/failure
   - Status updated to "verified" or "failed" via PATCH

### Remove Flow

- Click remove button on card → confirmation dialog ("Remove Amazon credentials?")
- DELETE `/api/credentials/[id]` → hard delete from Supabase
- If retailer was in `activeConnectors`, auto-remove from persona

## 4. API Endpoints

### `POST /api/credentials`

```typescript
// Input
{
  retailerId: string,       // "amazon" or "custom_abc123"
  retailerName?: string,    // required for custom
  retailerUrl?: string,     // required for custom
  username: string,
  password: string,
}

// Validation
- Max 10 credentials per user
- No duplicate retailer_id per user
- retailerUrl must be valid URL for custom stores
- username and password required, non-empty

// Process
1. Encrypt { password } with AES-256-GCM (reuse CARD_ENCRYPTION_KEY)
2. INSERT into store_credentials
3. Fire background TinyFish verification (non-blocking)
4. Return credential (without encrypted_data)
```

### `GET /api/credentials`

```typescript
// Returns all credentials for authenticated user
// Fields: id, retailerId, retailerName, retailerUrl, retailerIcon, username, status, verifiedAt, createdAt
// NEVER returns encrypted_data or password
```

### `DELETE /api/credentials/[id]`

```typescript
// Ownership check: credential.user_id === auth.uid()
// Hard delete from Supabase
// Remove from activeConnectors in persona if present
```

### `POST /api/credentials/[id]/verify`

```typescript
// Re-run TinyFish login verification
// Decrypts password server-side
// Fires TinyFish automation with login goal
// Updates status to "verified" or "failed"
```

## 5. Chat Connectors UI

### Location: + Menu Panel

The chat input has a `+` button that opens an action panel. Add a new section:

**"Connectors" section:**
- Header: "Connectors" with connector count badge (e.g., "2 active")
- If no credentials: "No store credentials. Add them in Settings." with link
- If credentials exist: list with toggle switches

**Toggle behavior:**
- Toggle ON → add retailer_id to `activeConnectors` in persona (PATCH)
- Toggle OFF → remove from `activeConnectors`
- Visual: retailer icon + name + toggle switch
- Persists globally (not per conversation)

**"Targeted Search" button:**
- Below the toggles
- Opens a sub-panel with radio buttons (same credential list)
- Selecting a retailer sets a one-shot `targetedRetailer` in conversation context
- After the next search completes, `targetedRetailer` resets to null
- UI shows a chip/badge in the chat input area: "Searching Amazon only ×"

## 6. Search Pipeline Changes

### New: `searchWithConnectors` function

Location: `src/lib/search/authenticated-search.ts`

```typescript
export async function searchWithConnectors(
  query: string,
  connectorIds: string[],
  userId: string
): Promise<Product[]>
```

**Logic:**
1. Load credentials for `connectorIds` from Supabase (service client)
2. Decrypt passwords server-side
3. For each connector (max 3), build a TinyFish automation:
   - Navigate to retailer login URL
   - Log in with username/password
   - Search for the query
   - Extract product results as JSON
4. Submit all via `submitBatch` (parallel execution)
5. Poll via `pollBatchResults`
6. Normalize results to `Product[]` shape
7. **Security:** credentials are NEVER logged, NEVER in tool results, NEVER in chat messages

### TinyFish Login Goals (per retailer)

```typescript
const LOGIN_GOALS: Record<string, (username: string, password: string, query: string) => string> = {
  amazon: (u, p, q) =>
    `Navigate to Amazon sign-in. Enter email "${u}" and password "${p}". After login, search for "${q}" using the search bar. Return JSON: {"products": [{"name": "...", "price": 0, "url": "...", "image_url": "...", "rating": 0, "prime": true/false}]}`,

  mercadolibre: (u, p, q) =>
    `Navigate to MercadoLibre login. Enter "${u}" and "${p}". After login, search for "${q}". Return JSON: {"products": [{"name": "...", "price": 0, "currency": "...", "url": "...", "image_url": "...", "rating": 0, "free_shipping": true/false}]}`,

  // ... similar for each pre-defined retailer

  _custom: (u, p, q) =>
    `Navigate to the login page. Enter username/email "${u}" and password "${p}". After login, search for "${q}" using the site's search. Return JSON: {"products": [{"name": "...", "price": 0, "url": "...", "image_url": "..."}]}`,
};
```

### Integration with `searchMultiSource`

```typescript
// In the search tool or orchestrator:

const activeConnectors = persona.activeConnectors ?? [];
const targetedRetailer = conversationContext.targetedRetailer;

if (targetedRetailer) {
  // Targeted search: single retailer only, authenticated
  return searchWithConnectors(query, [targetedRetailer], userId);
}

if (activeConnectors.length > 0) {
  // Select up to 3 most relevant connectors
  const selected = selectRelevantConnectors(activeConnectors, query, 3);

  // Run authenticated + unauthenticated in parallel
  const [authResults, publicResults] = await Promise.all([
    searchWithConnectors(query, selected, userId),
    searchMultiSource(query, country),
  ]);

  // Merge, deduplicate, sort by reliability
  return mergeAndDeduplicate(authResults, publicResults.products);
}

// No connectors: current behavior
return searchMultiSource(query, country);
```

### Connector Relevance Selection

When >3 connectors are active, auto-pick based on query category:

```typescript
const RETAILER_CATEGORIES: Record<string, string[]> = {
  amazon:       ["electronics", "books", "home", "general"],
  mercadolibre: ["electronics", "home", "automotive", "general"],
  ebay:         ["collectibles", "electronics", "automotive", "used"],
  walmart:      ["groceries", "home", "electronics", "general"],
  bestbuy:      ["electronics", "computers", "gaming", "appliances"],
  target:       ["home", "clothing", "beauty", "baby"],
  alibaba:      ["wholesale", "manufacturing", "electronics"],
  shein:        ["clothing", "fashion", "accessories"],
  temu:         ["clothing", "home", "electronics", "budget"],
};
```

Use lightweight keyword matching on the query to rank connectors. Fall back to most recently verified.

## 7. Encryption

Reuse the existing `src/lib/crypto/card-encryption.ts` pattern:

```typescript
// New file: src/lib/crypto/credential-encryption.ts

import { encryptCardData, decryptCardData } from "./card-encryption";

interface CredentialData {
  password: string;
}

export function encryptCredential(data: CredentialData): string {
  // Same AES-256-GCM as card encryption, reuses CARD_ENCRYPTION_KEY
  return encryptCardData(data as any);
}

export function decryptCredential(encrypted: string): CredentialData {
  return decryptCardData(encrypted) as any;
}
```

Reuses `CARD_ENCRYPTION_KEY` env var. Same security properties: encrypted at rest, decrypted only server-side, never exposed to client.

## 8. Security Considerations

1. **Passwords encrypted at rest** — AES-256-GCM, decrypted only in server-side API routes
2. **Never in logs** — TinyFish goal strings containing credentials are NOT logged (strip from console.log)
3. **Never in tool results** — search results from authenticated sessions don't include how they were obtained
4. **Never in chat** — the AI never mentions or echoes credentials in messages
5. **RLS enforced** — users can only access their own credentials
6. **Hard delete** — remove is permanent, no soft delete
7. **Rate limited** — max 10 credentials per user, verification limited to 1 per minute per credential
8. **Service client only** — decryption happens via service client (bypasses RLS) in API routes only

## 9. File Structure

```
src/
├── app/
│   ├── profile/
│   │   └── credentials/
│   │       └── page.tsx                    # Credentials management page
│   └── api/
│       └── credentials/
│           ├── route.ts                    # GET (list), POST (create)
│           └── [id]/
│               ├── route.ts               # DELETE (remove)
│               └── verify/
│                   └── route.ts            # POST (re-verify)
├── components/
│   ├── credentials/
│   │   ├── credential-card.tsx             # Individual credential display card
│   │   ├── add-credential-sheet.tsx        # Sheet/modal for adding credentials
│   │   ├── retailer-grid.tsx              # Pre-defined retailer selection grid
│   │   └── empty-state.tsx                # Empty state illustration
│   └── chat/
│       └── connectors-panel.tsx            # Chat + menu connectors section
├── lib/
│   ├── connectors/
│   │   └── retailers.ts                   # PREDEFINED_RETAILERS constant + types
│   ├── crypto/
│   │   └── credential-encryption.ts       # Encrypt/decrypt credential data
│   └── search/
│       └── authenticated-search.ts        # searchWithConnectors + login goals
└── supabase/
    └── migrations/
        └── 20260325_store_credentials.sql # New table migration
```

## 10. Implementation Order

1. Supabase migration + encryption module
2. API endpoints (CRUD + verify)
3. Credentials page (empty state, add flow, list, remove)
4. Pre-defined retailers data + login goals
5. Chat connectors panel (toggles + targeted search)
6. Authenticated search pipeline
7. Integration with orchestrator/search tools
