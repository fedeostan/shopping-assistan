# Store Credentials & Connectors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users save encrypted retailer credentials, toggle them in chat, and run authenticated TinyFish shopping agents for member pricing and session-gated content.

**Architecture:** Supabase table with AES-256-GCM encrypted passwords (reusing existing card encryption pattern). API endpoints follow the payment-methods CRUD pattern. Chat connectors panel with toggle/targeted modes. Authenticated search via TinyFish batch API with site-specific login goals.

**Tech Stack:** Next.js App Router, Supabase (RLS), AES-256-GCM encryption, TinyFish batch API, Zod validation, shadcn/ui components

---

## File Structure

```
Create: supabase/migrations/20260325_store_credentials.sql
Create: src/lib/connectors/retailers.ts
Create: src/lib/crypto/credential-encryption.ts
Create: src/app/api/credentials/route.ts
Create: src/app/api/credentials/[id]/route.ts
Create: src/app/api/credentials/[id]/verify/route.ts
Create: src/components/credentials/credential-card.tsx
Create: src/components/credentials/add-credential-sheet.tsx
Create: src/components/credentials/retailer-grid.tsx
Create: src/app/profile/credentials/page.tsx
Create: src/components/chat/connectors-panel.tsx
Create: src/lib/search/authenticated-search.ts
Modify: src/lib/persona/types.ts
Modify: src/lib/ai/tools/search.ts
Modify: src/app/profile/page.tsx
```

---

### Task 1: Supabase Migration

**Files:**
- Create: `supabase/migrations/20260325_store_credentials.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- supabase/migrations/20260325_store_credentials.sql

CREATE TABLE store_credentials (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  retailer_id     TEXT NOT NULL,
  retailer_name   TEXT NOT NULL,
  retailer_url    TEXT,
  retailer_icon   TEXT,
  username        TEXT NOT NULL,
  encrypted_data  TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'verified', 'failed')),
  verified_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, retailer_id)
);

ALTER TABLE store_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own credentials"
  ON store_credentials FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own credentials"
  ON store_credentials FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own credentials"
  ON store_credentials FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own credentials"
  ON store_credentials FOR DELETE
  USING (auth.uid() = user_id);
```

- [ ] **Step 2: Apply the migration via Supabase MCP**

Use the Supabase MCP `apply_migration` tool to apply the SQL above with name `20260325_store_credentials`.

- [ ] **Step 3: Verify the table exists**

Use the Supabase MCP `list_tables` tool. Confirm `store_credentials` appears in the list.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260325_store_credentials.sql
git commit -m "feat(db): add store_credentials table with RLS (#60)"
```

---

### Task 2: Retailers Data + Encryption Module

**Files:**
- Create: `src/lib/connectors/retailers.ts`
- Create: `src/lib/crypto/credential-encryption.ts`
- Modify: `src/lib/persona/types.ts`

- [ ] **Step 1: Create retailers data file**

```typescript
// src/lib/connectors/retailers.ts

export interface RetailerDef {
  id: string;
  name: string;
  icon: string;
  url: string;
  loginUrl: string;
}

export const PREDEFINED_RETAILERS: RetailerDef[] = [
  { id: "amazon",       name: "Amazon",       icon: "amazon",       url: "https://www.amazon.com",       loginUrl: "https://www.amazon.com/ap/signin" },
  { id: "mercadolibre", name: "MercadoLibre", icon: "mercadolibre", url: "https://www.mercadolibre.com", loginUrl: "https://www.mercadolibre.com/jms/login" },
  { id: "ebay",         name: "eBay",         icon: "ebay",         url: "https://www.ebay.com",         loginUrl: "https://signin.ebay.com" },
  { id: "walmart",      name: "Walmart",      icon: "walmart",      url: "https://www.walmart.com",      loginUrl: "https://www.walmart.com/account/login" },
  { id: "bestbuy",      name: "Best Buy",     icon: "bestbuy",      url: "https://www.bestbuy.com",      loginUrl: "https://www.bestbuy.com/identity/signin" },
  { id: "target",       name: "Target",       icon: "target",       url: "https://www.target.com",       loginUrl: "https://www.target.com/account" },
  { id: "alibaba",      name: "Alibaba",      icon: "alibaba",      url: "https://www.alibaba.com",      loginUrl: "https://login.alibaba.com" },
  { id: "shein",        name: "Shein",        icon: "shein",        url: "https://www.shein.com",        loginUrl: "https://www.shein.com/user/auth/login" },
  { id: "temu",         name: "Temu",         icon: "temu",         url: "https://www.temu.com",         loginUrl: "https://www.temu.com/login.html" },
];

export function getRetailerById(id: string): RetailerDef | undefined {
  return PREDEFINED_RETAILERS.find((r) => r.id === id);
}

/** Categories each retailer is strong in — used for auto-selection when >3 active */
export const RETAILER_CATEGORIES: Record<string, string[]> = {
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

- [ ] **Step 2: Create credential encryption module**

```typescript
// src/lib/crypto/credential-encryption.ts

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

export interface CredentialData {
  password: string;
}

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const hex = process.env.CARD_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("CARD_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

export function encryptCredential(data: CredentialData): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const plaintext = JSON.stringify(data);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptCredential(encoded: string): CredentialData {
  const key = getKey();
  const buf = Buffer.from(encoded, "base64");
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8")) as CredentialData;
}
```

- [ ] **Step 3: Add `activeConnectors` to UserPersona type**

In `src/lib/persona/types.ts`, add after the `upcomingNeeds` field:

```typescript
  // Connectors
  activeConnectors?: string[];  // retailer_ids toggled on for authenticated search
```

- [ ] **Step 4: Verify build passes**

```bash
npm run build 2>&1 | tail -5
```

Expected: build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/connectors/retailers.ts src/lib/crypto/credential-encryption.ts src/lib/persona/types.ts
git commit -m "feat: add retailers data, credential encryption, and activeConnectors type (#60)"
```

---

### Task 3: Credentials API Endpoints

**Files:**
- Create: `src/app/api/credentials/route.ts`
- Create: `src/app/api/credentials/[id]/route.ts`
- Create: `src/app/api/credentials/[id]/verify/route.ts`

- [ ] **Step 1: Create GET + POST endpoint**

```typescript
// src/app/api/credentials/route.ts

import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { createServiceClient } from "@/lib/db/supabase";
import { encryptCredential } from "@/lib/crypto/credential-encryption";
import { getRetailerById, PREDEFINED_RETAILERS } from "@/lib/connectors/retailers";
import { z } from "zod";

const SAFE_FIELDS = "id, retailer_id, retailer_name, retailer_url, retailer_icon, username, status, verified_at, created_at, updated_at";

const addCredentialSchema = z.object({
  retailerId: z.string().min(1).max(100),
  retailerName: z.string().min(1).max(100).optional(),
  retailerUrl: z.string().url().optional(),
  username: z.string().min(1).max(200),
  password: z.string().min(1).max(200),
});

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { data, error } = await service
    .from("store_credentials")
    .select(SAFE_FIELDS)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true, data });
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = addCredentialSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { retailerId, retailerName, retailerUrl, username, password } = parsed.data;

  // Resolve retailer info
  const predefined = getRetailerById(retailerId);
  const isCustom = !predefined;

  if (isCustom && (!retailerName || !retailerUrl)) {
    return Response.json({ error: "Custom stores require retailerName and retailerUrl" }, { status: 400 });
  }

  const service = createServiceClient();

  // Max 10 credentials per user
  const { count } = await service
    .from("store_credentials")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if ((count ?? 0) >= 10) {
    return Response.json({ error: "Maximum of 10 store credentials allowed." }, { status: 400 });
  }

  // Encrypt password
  let encrypted: string;
  try {
    encrypted = encryptCredential({ password });
  } catch {
    console.error("Credential encryption failed — check CARD_ENCRYPTION_KEY env var");
    return Response.json({ error: "Unable to securely store credential." }, { status: 500 });
  }

  const { data, error } = await service
    .from("store_credentials")
    .insert({
      user_id: user.id,
      retailer_id: retailerId,
      retailer_name: predefined?.name ?? retailerName!,
      retailer_url: predefined?.url ?? retailerUrl ?? null,
      retailer_icon: predefined?.icon ?? null,
      username,
      encrypted_data: encrypted,
      status: "pending",
    })
    .select(SAFE_FIELDS)
    .single();

  if (error) {
    if (error.code === "23505") {
      return Response.json({ error: "You already have credentials for this store." }, { status: 409 });
    }
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true, data }, { status: 201 });
}
```

- [ ] **Step 2: Create DELETE endpoint**

```typescript
// src/app/api/credentials/[id]/route.ts

import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { createServiceClient } from "@/lib/db/supabase";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();

  // Ownership check
  const { data: credential } = await service
    .from("store_credentials")
    .select("id, user_id, retailer_id")
    .eq("id", id)
    .single();

  if (!credential || credential.user_id !== user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Remove from activeConnectors in persona if present
  const { data: personaRow } = await service
    .from("user_personas")
    .select("persona")
    .eq("user_id", user.id)
    .single();

  if (personaRow?.persona?.activeConnectors) {
    const updated = (personaRow.persona.activeConnectors as string[]).filter(
      (c: string) => c !== credential.retailer_id
    );
    await service
      .from("user_personas")
      .update({ persona: { ...personaRow.persona, activeConnectors: updated } })
      .eq("user_id", user.id);
  }

  // Hard delete
  const { error } = await service
    .from("store_credentials")
    .delete()
    .eq("id", id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ success: true });
}
```

- [ ] **Step 3: Create verify endpoint**

```typescript
// src/app/api/credentials/[id]/verify/route.ts

import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { createServiceClient } from "@/lib/db/supabase";
import { decryptCredential } from "@/lib/crypto/credential-encryption";
import { getRetailerById } from "@/lib/connectors/retailers";
import { runAutomation } from "@/lib/tinyfish/client";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();

  const { data: credential } = await service
    .from("store_credentials")
    .select("*")
    .eq("id", id)
    .single();

  if (!credential || credential.user_id !== user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  // Decrypt password
  let password: string;
  try {
    const decrypted = decryptCredential(credential.encrypted_data);
    password = decrypted.password;
  } catch {
    await service.from("store_credentials").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", id);
    return Response.json({ error: "Failed to decrypt credential" }, { status: 500 });
  }

  // Build login verification goal
  const retailer = getRetailerById(credential.retailer_id);
  const loginUrl = retailer?.loginUrl ?? credential.retailer_url ?? "";
  const goal = `Navigate to "${loginUrl}". Log in with username/email "${credential.username}" and password "${password}". After login, verify you are logged in (look for account name, profile icon, or dashboard). Return JSON: {"loggedIn": true/false, "accountName": "visible name or null"}`;

  try {
    const result = await runAutomation(
      { url: loginUrl, goal, browser_profile: "stealth" },
      { timeoutMs: 45_000, maxSteps: 15 }
    );

    const loggedIn = result.success && result.data?.loggedIn === true;
    const now = new Date().toISOString();

    await service
      .from("store_credentials")
      .update({
        status: loggedIn ? "verified" : "failed",
        verified_at: loggedIn ? now : null,
        updated_at: now,
      })
      .eq("id", id);

    return Response.json({ success: true, status: loggedIn ? "verified" : "failed" });
  } catch (err) {
    await service.from("store_credentials").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", id);
    return Response.json({ success: true, status: "failed" });
  }
}
```

- [ ] **Step 4: Verify build passes**

```bash
npm run build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/credentials/
git commit -m "feat(api): add credentials CRUD + verify endpoints (#60)"
```

---

### Task 4: Credentials Page UI

**Files:**
- Create: `src/components/credentials/credential-card.tsx`
- Create: `src/components/credentials/add-credential-sheet.tsx`
- Create: `src/components/credentials/retailer-grid.tsx`
- Create: `src/app/profile/credentials/page.tsx`
- Modify: `src/app/profile/page.tsx`

- [ ] **Step 1: Create credential card component**

```typescript
// src/components/credentials/credential-card.tsx
"use client";

import { Trash2Icon, RefreshCwIcon, LoaderIcon, CheckCircleIcon, XCircleIcon, StoreIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export interface CredentialItem {
  id: string;
  retailer_id: string;
  retailer_name: string;
  retailer_url: string | null;
  retailer_icon: string | null;
  username: string;
  status: "pending" | "verified" | "failed";
  verified_at: string | null;
  created_at: string;
}

interface CredentialCardProps {
  credential: CredentialItem;
  onRemove: (id: string) => void;
  onVerify: (id: string) => void;
  removing: boolean;
  verifying: boolean;
}

export function CredentialCard({ credential, onRemove, onVerify, removing, verifying }: CredentialCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
          <StoreIcon className="size-5 text-muted-foreground" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="font-medium text-foreground">{credential.retailer_name}</p>
          <p className="truncate text-sm text-muted-foreground">{credential.username}</p>
        </div>
        <div className="flex items-center gap-2">
          {credential.status === "pending" && (
            <Badge variant="outline" className="gap-1 border-yellow-500 text-yellow-600">
              <LoaderIcon className="size-3 animate-spin" /> Verifying
            </Badge>
          )}
          {credential.status === "verified" && (
            <Badge variant="outline" className="gap-1 border-green-500 text-green-600">
              <CheckCircleIcon className="size-3" /> Verified
            </Badge>
          )}
          {credential.status === "failed" && (
            <Badge variant="outline" className="gap-1 border-red-500 text-red-600">
              <XCircleIcon className="size-3" /> Failed
            </Badge>
          )}
          {credential.status === "failed" && (
            <Button variant="ghost" size="icon" onClick={() => onVerify(credential.id)} disabled={verifying}>
              <RefreshCwIcon className={`size-4 ${verifying ? "animate-spin" : ""}`} />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => onRemove(credential.id)} disabled={removing}>
            <Trash2Icon className="size-4 text-destructive" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create retailer selection grid**

```typescript
// src/components/credentials/retailer-grid.tsx
"use client";

import { StoreIcon } from "lucide-react";
import { PREDEFINED_RETAILERS } from "@/lib/connectors/retailers";

interface RetailerGridProps {
  onSelect: (retailerId: string) => void;
  disabledIds: string[];
}

export function RetailerGrid({ onSelect, disabledIds }: RetailerGridProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        {PREDEFINED_RETAILERS.map((r) => {
          const disabled = disabledIds.includes(r.id);
          return (
            <button
              key={r.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(r.id)}
              className="flex flex-col items-center gap-2 rounded-lg border p-3 text-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
            >
              <StoreIcon className="size-6 text-muted-foreground" />
              <span className="font-medium">{r.name}</span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => onSelect("custom")}
        className="flex items-center justify-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <StoreIcon className="size-4" />
        Custom Store
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Create add credential sheet**

```typescript
// src/components/credentials/add-credential-sheet.tsx
"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RetailerGrid } from "./retailer-grid";
import { getRetailerById } from "@/lib/connectors/retailers";

interface AddCredentialSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingRetailerIds: string[];
  onSaved: () => void;
}

export function AddCredentialSheet({ open, onOpenChange, existingRetailerIds, onSaved }: AddCredentialSheetProps) {
  const [step, setStep] = useState<"select" | "credentials">("select");
  const [selectedRetailerId, setSelectedRetailerId] = useState<string>("");
  const [customName, setCustomName] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCustom = selectedRetailerId === "custom";
  const retailer = getRetailerById(selectedRetailerId);

  function handleSelect(id: string) {
    setSelectedRetailerId(id);
    setStep("credentials");
    setError(null);
  }

  function reset() {
    setStep("select");
    setSelectedRetailerId("");
    setCustomName("");
    setCustomUrl("");
    setUsername("");
    setPassword("");
    setError(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const finalRetailerId = isCustom ? `custom_${Date.now()}` : selectedRetailerId;
      const res = await fetch("/api/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          retailerId: finalRetailerId,
          retailerName: isCustom ? customName : undefined,
          retailerUrl: isCustom ? customUrl : undefined,
          username,
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save");
        return;
      }

      // Fire verification in background
      if (data.data?.id) {
        fetch(`/api/credentials/${data.data.id}/verify`, { method: "POST" }).catch(() => {});
      }

      onSaved();
      onOpenChange(false);
      reset();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <SheetContent className="flex flex-col gap-6">
        <SheetHeader>
          <SheetTitle>{step === "select" ? "Select Store" : `Add ${retailer?.name ?? customName || "Custom"} Credentials`}</SheetTitle>
        </SheetHeader>

        {step === "select" && (
          <RetailerGrid onSelect={handleSelect} disabledIds={existingRetailerIds} />
        )}

        {step === "credentials" && (
          <div className="flex flex-col gap-4">
            {isCustom && (
              <>
                <Input placeholder="Store name" value={customName} onChange={(e) => setCustomName(e.target.value)} />
                <Input placeholder="Store URL (https://...)" value={customUrl} onChange={(e) => setCustomUrl(e.target.value)} />
              </>
            )}
            <Input placeholder="Email or username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
            <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            <p className="text-xs text-muted-foreground">Your password is encrypted with AES-256 and never visible again.</p>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("select")} className="flex-1">Back</Button>
              <Button onClick={handleSave} disabled={saving || !username || !password || (isCustom && (!customName || !customUrl))} className="flex-1">
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 4: Create credentials page**

```typescript
// src/app/profile/credentials/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, PlusIcon, StoreIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CredentialCard, type CredentialItem } from "@/components/credentials/credential-card";
import { AddCredentialSheet } from "@/components/credentials/add-credential-sheet";

export default function CredentialsPage() {
  const [credentials, setCredentials] = useState<CredentialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const loadCredentials = useCallback(async () => {
    try {
      const res = await fetch("/api/credentials");
      const data = await res.json();
      if (data.success) setCredentials(data.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCredentials(); }, [loadCredentials]);

  async function handleRemove(id: string) {
    if (!confirm("Remove this store credential? This cannot be undone.")) return;
    setRemovingId(id);
    try {
      await fetch(`/api/credentials/${id}`, { method: "DELETE" });
      setCredentials((prev) => prev.filter((c) => c.id !== id));
    } finally {
      setRemovingId(null);
    }
  }

  async function handleVerify(id: string) {
    setVerifyingId(id);
    setCredentials((prev) => prev.map((c) => c.id === id ? { ...c, status: "pending" as const } : c));
    try {
      const res = await fetch(`/api/credentials/${id}/verify`, { method: "POST" });
      const data = await res.json();
      setCredentials((prev) => prev.map((c) => c.id === id ? { ...c, status: data.status } : c));
    } finally {
      setVerifyingId(null);
    }
  }

  const existingIds = credentials.map((c) => c.retailer_id);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/profile">
            <Button variant="ghost" size="icon"><ArrowLeft className="size-5" /></Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">Store Credentials</h1>
            <p className="text-sm text-muted-foreground">Connect store accounts for authenticated shopping</p>
          </div>
        </div>
        {credentials.length > 0 && (
          <Button onClick={() => setSheetOpen(true)} size="sm">
            <PlusIcon className="mr-1.5 size-4" /> Add
          </Button>
        )}
      </div>

      {loading && <div className="py-12 text-center text-muted-foreground">Loading...</div>}

      {!loading && credentials.length === 0 && (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed p-12 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-muted">
            <StoreIcon className="size-8 text-muted-foreground" />
          </div>
          <div>
            <p className="text-lg font-semibold">Connect your store accounts</p>
            <p className="mt-1 text-sm text-muted-foreground">Add credentials to let the shopping agent access member prices, saved addresses, and personalized deals.</p>
          </div>
          <Button onClick={() => setSheetOpen(true)}>
            <PlusIcon className="mr-1.5 size-4" /> Add Credential
          </Button>
        </div>
      )}

      {!loading && credentials.length > 0 && (
        <div className="flex flex-col gap-3">
          {credentials.map((c) => (
            <CredentialCard
              key={c.id}
              credential={c}
              onRemove={handleRemove}
              onVerify={handleVerify}
              removing={removingId === c.id}
              verifying={verifyingId === c.id}
            />
          ))}
        </div>
      )}

      <AddCredentialSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        existingRetailerIds={existingIds}
        onSaved={loadCredentials}
      />
    </div>
  );
}
```

- [ ] **Step 5: Add link from profile page**

In `src/app/profile/page.tsx`, find the section that renders the shipping address card (search for "Shipping") and add after it:

```typescript
{/* Store Credentials Link */}
<Card>
  <CardHeader>
    <CardTitle className="flex items-center justify-between">
      Store Credentials
      <Link href="/profile/credentials">
        <Button variant="outline" size="sm">Manage</Button>
      </Link>
    </CardTitle>
    <CardDescription>Connect store accounts for authenticated shopping</CardDescription>
  </CardHeader>
</Card>
```

- [ ] **Step 6: Verify build passes**

```bash
npm run build 2>&1 | tail -5
```

- [ ] **Step 7: Commit**

```bash
git add src/components/credentials/ src/app/profile/credentials/ src/app/profile/page.tsx
git commit -m "feat(ui): add credentials management page with add/remove/verify (#60)"
```

---

### Task 5: Chat Connectors Panel

**Files:**
- Create: `src/components/chat/connectors-panel.tsx`

- [ ] **Step 1: Create the connectors panel component**

```typescript
// src/components/chat/connectors-panel.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { StoreIcon, RadioIcon, SettingsIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CredentialItem } from "@/components/credentials/credential-card";

interface ConnectorsPanelProps {
  activeConnectors: string[];
  onToggle: (retailerId: string, active: boolean) => void;
  targetedRetailer: string | null;
  onTargetSelect: (retailerId: string | null) => void;
}

export function ConnectorsPanel({ activeConnectors, onToggle, targetedRetailer, onTargetSelect }: ConnectorsPanelProps) {
  const [credentials, setCredentials] = useState<CredentialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTargeted, setShowTargeted] = useState(false);

  const loadCredentials = useCallback(async () => {
    try {
      const res = await fetch("/api/credentials");
      const data = await res.json();
      if (data.success) setCredentials(data.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCredentials(); }, [loadCredentials]);

  const activeCount = activeConnectors.length;

  if (loading) {
    return <div className="px-4 py-3 text-sm text-muted-foreground">Loading connectors...</div>;
  }

  if (credentials.length === 0) {
    return (
      <div className="flex flex-col gap-2 px-4 py-3">
        <p className="text-sm text-muted-foreground">No store credentials configured.</p>
        <Link href="/profile/credentials">
          <Button variant="outline" size="sm" className="gap-1.5">
            <SettingsIcon className="size-3.5" /> Add in Settings
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Connectors</span>
          {activeCount > 0 && (
            <Badge variant="secondary" className="text-xs">{activeCount} active</Badge>
          )}
        </div>
      </div>

      {!showTargeted && (
        <div className="flex flex-col gap-2">
          {credentials.filter((c) => c.status === "verified").map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-md px-2 py-1.5">
              <div className="flex items-center gap-2">
                <StoreIcon className="size-4 text-muted-foreground" />
                <span className="text-sm">{c.retailer_name}</span>
              </div>
              <Switch
                checked={activeConnectors.includes(c.retailer_id)}
                onCheckedChange={(checked) => onToggle(c.retailer_id, checked)}
              />
            </div>
          ))}
        </div>
      )}

      {showTargeted && (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">Search one store only (next search)</p>
          {credentials.filter((c) => c.status === "verified").map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onTargetSelect(targetedRetailer === c.retailer_id ? null : c.retailer_id);
                setShowTargeted(false);
              }}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted ${
                targetedRetailer === c.retailer_id ? "bg-muted font-medium" : ""
              }`}
            >
              <RadioIcon className={`size-4 ${targetedRetailer === c.retailer_id ? "text-primary" : "text-muted-foreground"}`} />
              {c.retailer_name}
            </button>
          ))}
        </div>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="justify-start text-xs"
        onClick={() => setShowTargeted(!showTargeted)}
      >
        {showTargeted ? "Back to toggles" : "Targeted Search →"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/connectors-panel.tsx
git commit -m "feat(chat): add connectors panel with toggle + targeted search (#60)"
```

---

### Task 6: Authenticated Search Pipeline

**Files:**
- Create: `src/lib/search/authenticated-search.ts`

- [ ] **Step 1: Create the authenticated search module**

```typescript
// src/lib/search/authenticated-search.ts

import { createServiceClient } from "@/lib/db/supabase";
import { decryptCredential } from "@/lib/crypto/credential-encryption";
import { getRetailerById, RETAILER_CATEGORIES } from "@/lib/connectors/retailers";
import { submitBatch, pollBatchResults } from "@/lib/tinyfish/client";
import type { BatchRunConfig } from "@/lib/tinyfish/client";
import type { Product } from "@/lib/ai/types";

// ---------------------------------------------------------------------------
// Login + Search goals per retailer
// ---------------------------------------------------------------------------

type GoalBuilder = (username: string, password: string, query: string) => string;

const LOGIN_SEARCH_GOALS: Record<string, GoalBuilder> = {
  amazon: (u, p, q) =>
    `Navigate to Amazon sign-in page. Enter email "${u}" and click Continue. Enter password "${p}" and click Sign-In. If 2FA prompt appears, report it and stop. After login, search for "${q}" using the search bar. Return JSON: {"products": [{"name": "string", "price": 0, "url": "string", "image_url": "string", "rating": 0, "prime": true}]}`,

  mercadolibre: (u, p, q) =>
    `Navigate to MercadoLibre login. Enter "${u}" and click Continue. Enter "${p}" and click Log in. After login, search for "${q}". Return JSON: {"products": [{"name": "string", "price": 0, "currency": "string", "url": "string", "image_url": "string", "free_shipping": true}]}`,

  ebay: (u, p, q) =>
    `Navigate to eBay sign-in. Enter "${u}" and "${p}" then click Sign in. After login, search for "${q}". Return JSON: {"products": [{"name": "string", "price": 0, "url": "string", "image_url": "string", "rating": 0}]}`,

  walmart: (u, p, q) =>
    `Navigate to Walmart sign-in. Enter email "${u}" and password "${p}" then click Sign in. After login, search for "${q}". Return JSON: {"products": [{"name": "string", "price": 0, "url": "string", "image_url": "string", "rating": 0}]}`,

  bestbuy: (u, p, q) =>
    `Navigate to Best Buy sign-in. Enter email "${u}" and password "${p}" then click Sign In. After login, search for "${q}". Return JSON: {"products": [{"name": "string", "price": 0, "url": "string", "image_url": "string", "rating": 0}]}`,

  target: (u, p, q) =>
    `Navigate to Target sign-in. Enter email "${u}" and password "${p}" then click Sign in. After login, search for "${q}". Return JSON: {"products": [{"name": "string", "price": 0, "url": "string", "image_url": "string", "rating": 0}]}`,

  alibaba: (u, p, q) =>
    `Navigate to Alibaba login. Enter "${u}" and "${p}" then sign in. After login, search for "${q}". Return JSON: {"products": [{"name": "string", "price": 0, "url": "string", "image_url": "string", "min_order": "string"}]}`,

  shein: (u, p, q) =>
    `Navigate to Shein login. Enter email "${u}" and password "${p}" then log in. After login, search for "${q}". Return JSON: {"products": [{"name": "string", "price": 0, "url": "string", "image_url": "string", "rating": 0}]}`,

  temu: (u, p, q) =>
    `Navigate to Temu login. Enter "${u}" and "${p}" then sign in. After login, search for "${q}". Return JSON: {"products": [{"name": "string", "price": 0, "url": "string", "image_url": "string", "rating": 0}]}`,

  _custom: (u, p, q) =>
    `Navigate to the login page. Enter username/email "${u}" and password "${p}" then sign in. After login, search for "${q}" using the site search. Return JSON: {"products": [{"name": "string", "price": 0, "url": "string", "image_url": "string"}]}`,
};

function getGoalBuilder(retailerId: string): GoalBuilder {
  return LOGIN_SEARCH_GOALS[retailerId] ?? LOGIN_SEARCH_GOALS._custom;
}

// ---------------------------------------------------------------------------
// Core: authenticated search via TinyFish batch
// ---------------------------------------------------------------------------

interface CredentialRow {
  retailer_id: string;
  retailer_name: string;
  retailer_url: string | null;
  username: string;
  encrypted_data: string;
}

export async function searchWithConnectors(
  query: string,
  connectorIds: string[],
  userId: string
): Promise<Product[]> {
  if (connectorIds.length === 0) return [];

  const service = createServiceClient();
  const { data: rows } = await service
    .from("store_credentials")
    .select("retailer_id, retailer_name, retailer_url, username, encrypted_data")
    .eq("user_id", userId)
    .eq("status", "verified")
    .in("retailer_id", connectorIds);

  if (!rows || rows.length === 0) return [];

  console.log(`[AuthSearch] Building ${rows.length} authenticated searches for query="${query}"`);

  const runs: BatchRunConfig[] = [];
  const runMeta: { retailerId: string; retailerName: string }[] = [];

  for (const row of rows as CredentialRow[]) {
    let password: string;
    try {
      password = decryptCredential(row.encrypted_data).password;
    } catch {
      console.warn(`[AuthSearch] Failed to decrypt credential for ${row.retailer_id}`);
      continue;
    }

    const retailer = getRetailerById(row.retailer_id);
    const loginUrl = retailer?.loginUrl ?? row.retailer_url ?? "";
    const goalBuilder = getGoalBuilder(row.retailer_id);

    runs.push({
      url: loginUrl,
      goal: goalBuilder(row.username, password, query),
      browser_profile: "stealth",
      proxy_config: { enabled: true, country_code: "US" },
    });
    runMeta.push({ retailerId: row.retailer_id, retailerName: row.retailer_name });
  }

  if (runs.length === 0) return [];

  try {
    const runIds = await submitBatch(runs);
    const results = await pollBatchResults(runIds, { pollIntervalMs: 8_000, timeoutMs: 90_000 });

    const products: Product[] = [];
    let runIndex = 0;
    for (const [, result] of results) {
      const meta = runMeta[runIndex++];
      if (result.status !== "COMPLETED" || !result.result?.products) continue;

      const items = result.result.products as Array<Record<string, unknown>>;
      for (let i = 0; i < items.length && i < 10; i++) {
        const item = items[i];
        products.push({
          id: `auth-${meta.retailerId}-${Date.now()}-${i}`,
          source: meta.retailerId,
          title: String(item.name ?? ""),
          currentPrice: Number(item.price ?? 0),
          currency: String(item.currency ?? "USD"),
          productUrl: String(item.url ?? ""),
          retailerUrl: String(item.url ?? ""),
          imageUrl: item.image_url ? String(item.image_url) : undefined,
          rating: item.rating ? Number(item.rating) : undefined,
          availability: "in_stock",
          urlReliability: "direct",
        });
      }
    }

    console.log(`[AuthSearch] Done: ${products.length} products from ${runs.length} connectors`);
    return products;
  } catch (err) {
    console.warn("[AuthSearch] Batch failed:", err instanceof Error ? err.message : err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Connector relevance selection
// ---------------------------------------------------------------------------

export function selectRelevantConnectors(
  activeConnectors: string[],
  query: string,
  max: number
): string[] {
  if (activeConnectors.length <= max) return activeConnectors;

  const queryLower = query.toLowerCase();
  const scored = activeConnectors.map((id) => {
    const categories = RETAILER_CATEGORIES[id] ?? ["general"];
    const score = categories.reduce((acc, cat) => {
      if (queryLower.includes(cat)) return acc + 2;
      if (cat === "general") return acc + 0.5;
      return acc;
    }, 0);
    return { id, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, max).map((s) => s.id);
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/search/authenticated-search.ts
git commit -m "feat: add authenticated search pipeline with TinyFish batch (#60)"
```

---

### Task 7: Integrate with Search Tool + Orchestrator

**Files:**
- Modify: `src/lib/ai/tools/search.ts`

- [ ] **Step 1: Read the current search tool**

Read `src/lib/ai/tools/search.ts` to understand its current structure and where to add connector-aware logic.

- [ ] **Step 2: Add connector-aware search**

At the top of the search tool's execute function, add:

```typescript
import { searchWithConnectors, selectRelevantConnectors } from "@/lib/search/authenticated-search";
```

Then in the execute function, before the existing `searchMultiSource` call, add:

```typescript
// Check for active connectors from persona
const activeConnectors = persona?.activeConnectors ?? [];
const targetedRetailer = opts?.targetedRetailer ?? null;

if (targetedRetailer) {
  // Targeted search: single retailer only, authenticated
  const authProducts = await searchWithConnectors(query, [targetedRetailer], userId);
  return { query, sources: [targetedRetailer], country, resultCount: authProducts.length, products: authProducts.map(toProductResult) };
}

if (activeConnectors.length > 0) {
  // Run authenticated + public searches in parallel
  const selected = selectRelevantConnectors(activeConnectors, query, 3);
  const [authProducts, publicResult] = await Promise.all([
    searchWithConnectors(query, selected, userId),
    searchMultiSource(query, country),
  ]);

  // Merge and deduplicate
  const allProducts = [...authProducts, ...publicResult.products];
  // ... deduplicate and return
}
```

The exact integration depends on the current search tool structure. Read it first, then adapt the pattern above to fit.

- [ ] **Step 3: Verify build passes**

```bash
npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/tools/search.ts
git commit -m "feat(search): integrate authenticated connectors into search pipeline (#60)"
```

---

## Spec Coverage Checklist

| Spec Section | Task |
|---|---|
| 1. Supabase Schema | Task 1 |
| 2. Pre-defined Retailers | Task 2 |
| 3. Credentials Page | Task 4 |
| 4. API Endpoints | Task 3 |
| 5. Chat Connectors UI | Task 5 |
| 6. Search Pipeline Changes | Task 6 + 7 |
| 7. Encryption | Task 2 |
| 8. Security Considerations | Tasks 3, 6 (never log/expose) |
| 9. File Structure | All tasks |
| 10. Implementation Order | Tasks 1-7 in order |
| Persona `activeConnectors` | Task 2 |
