import { createServiceClient } from "@/lib/db/supabase";
import { decryptCredential } from "@/lib/crypto/credential-encryption";
import { getRetailerById, RETAILER_CATEGORIES } from "@/lib/connectors/retailers";
import {
  submitBatch,
  pollBatchResults,
  type BatchRunConfig,
} from "@/lib/tinyfish/client";
import type { Product } from "@/lib/ai/types";

// ---------------------------------------------------------------------------
// Part 1 — Login + Search Goal Builders
// ---------------------------------------------------------------------------

type GoalBuilder = (username: string, password: string, query: string) => string;

const PRODUCT_JSON_SCHEMA = `{"products": [{"name": "string", "price": 0, "url": "string", "image_url": "string", "rating": 0}]}`;

const GOAL_BUILDERS: Record<string, GoalBuilder> = {
  amazon: (u, p, q) =>
    `1. Navigate to the login page.
2. Enter the email "${u}" and click Continue.
3. Enter the password "${p}" and click Sign-In.
4. If a 2FA / OTP prompt appears, STOP and return JSON: {"error": "2fa_required", "message": "Amazon requires two-factor authentication"}.
5. After login, use the search bar to search for "${q}".
6. Collect up to 10 product results from the search page.
Return JSON: {"products": [{"name": "string", "price": 0, "url": "string", "image_url": "string", "rating": 0, "prime": true}]}`,

  mercadolibre: (u, p, q) =>
    `1. Navigate to the login page.
2. Enter the email or username "${u}" and click Continue.
3. Enter the password "${p}" and click Sign-In.
4. If a 2FA / OTP prompt appears, STOP and return JSON: {"error": "2fa_required", "message": "MercadoLibre requires two-factor authentication"}.
5. After login, use the search bar to search for "${q}".
6. Collect up to 10 product results from the search page.
Return JSON: {"products": [{"name": "string", "price": 0, "currency": "string", "url": "string", "image_url": "string", "rating": 0, "free_shipping": false}]}`,

  ebay: (u, p, q) =>
    `1. Navigate to the login page.
2. Enter the username or email "${u}" and click Continue.
3. Enter the password "${p}" and click Sign In.
4. If a 2FA / OTP prompt appears, STOP and return JSON: {"error": "2fa_required", "message": "eBay requires two-factor authentication"}.
5. After login, use the search bar to search for "${q}".
6. Collect up to 10 product results from the search page.
Return JSON: ${PRODUCT_JSON_SCHEMA}`,

  walmart: (u, p, q) =>
    `1. Navigate to the login page.
2. Enter the email "${u}" and click Continue.
3. Enter the password "${p}" and click Sign In.
4. If a 2FA / OTP prompt appears, STOP and return JSON: {"error": "2fa_required", "message": "Walmart requires two-factor authentication"}.
5. After login, use the search bar to search for "${q}".
6. Collect up to 10 product results from the search page.
Return JSON: ${PRODUCT_JSON_SCHEMA}`,

  bestbuy: (u, p, q) =>
    `1. Navigate to the login page.
2. Enter the email "${u}" and click Continue.
3. Enter the password "${p}" and click Sign In.
4. If a 2FA / OTP prompt appears, STOP and return JSON: {"error": "2fa_required", "message": "Best Buy requires two-factor authentication"}.
5. After login, use the search bar to search for "${q}".
6. Collect up to 10 product results from the search page.
Return JSON: ${PRODUCT_JSON_SCHEMA}`,

  target: (u, p, q) =>
    `1. Navigate to the login page.
2. Enter the email "${u}" and the password "${p}" and click Sign In.
3. If a 2FA / OTP prompt appears, STOP and return JSON: {"error": "2fa_required", "message": "Target requires two-factor authentication"}.
4. After login, use the search bar to search for "${q}".
5. Collect up to 10 product results from the search page.
Return JSON: ${PRODUCT_JSON_SCHEMA}`,

  alibaba: (u, p, q) =>
    `1. Navigate to the login page.
2. Enter the email "${u}" and the password "${p}" and click Sign In.
3. If a 2FA / OTP prompt appears, STOP and return JSON: {"error": "2fa_required", "message": "Alibaba requires two-factor authentication"}.
4. After login, use the search bar to search for "${q}".
5. Collect up to 10 product results from the search page.
Return JSON: ${PRODUCT_JSON_SCHEMA}`,

  shein: (u, p, q) =>
    `1. Navigate to the login page.
2. Enter the email "${u}" and the password "${p}" and click Log In.
3. If a 2FA / OTP prompt appears, STOP and return JSON: {"error": "2fa_required", "message": "Shein requires two-factor authentication"}.
4. After login, use the search bar to search for "${q}".
5. Collect up to 10 product results from the search page.
Return JSON: ${PRODUCT_JSON_SCHEMA}`,

  temu: (u, p, q) =>
    `1. Navigate to the login page.
2. Enter the email "${u}" and the password "${p}" and click Log In.
3. If a 2FA / OTP prompt appears, STOP and return JSON: {"error": "2fa_required", "message": "Temu requires two-factor authentication"}.
4. After login, use the search bar to search for "${q}".
5. Collect up to 10 product results from the search page.
Return JSON: ${PRODUCT_JSON_SCHEMA}`,

  _custom: (u, p, q) =>
    `1. Navigate to the login page.
2. Find the login form. Enter the username or email "${u}" and the password "${p}" and submit the form.
3. If a 2FA / OTP prompt appears, STOP and return JSON: {"error": "2fa_required", "message": "This site requires two-factor authentication"}.
4. After login, find a search bar or search input and search for "${q}".
5. Collect up to 10 product results from the search/results page.
Return JSON: ${PRODUCT_JSON_SCHEMA}`,
};

// ---------------------------------------------------------------------------
// Part 2 — searchWithConnectors
// ---------------------------------------------------------------------------

interface StoredCredential {
  id: string;
  retailer_id: string;
  username: string;
  encrypted_password: string;
  login_url: string | null;
}

export async function searchWithConnectors(
  query: string,
  connectorIds: string[],
  userId: string
): Promise<Product[]> {
  if (connectorIds.length === 0) return [];

  // 1. Fetch verified credentials from store_credentials
  const supabase = createServiceClient();
  const { data: credentials, error } = await supabase
    .from("store_credentials")
    .select("id, retailer_id, username, encrypted_password, login_url")
    .eq("user_id", userId)
    .eq("status", "verified")
    .in("id", connectorIds);

  if (error) {
    console.error("[AuthSearch] Failed to fetch credentials:", error.message);
    return [];
  }

  if (!credentials || credentials.length === 0) {
    console.log("[AuthSearch] No verified credentials found for given connectors");
    return [];
  }

  console.log(
    `[AuthSearch] Found ${credentials.length} verified credential(s) for retailers: ${credentials.map((c: StoredCredential) => c.retailer_id).join(", ")}`
  );

  // 2. Build batch runs — decrypt passwords, resolve login URLs, build goals
  const runMeta: { retailerId: string; connectorId: string }[] = [];
  const batchRuns: BatchRunConfig[] = [];

  for (const cred of credentials as StoredCredential[]) {
    try {
      const { password } = decryptCredential(cred.encrypted_password);
      const retailer = getRetailerById(cred.retailer_id);
      const loginUrl = cred.login_url ?? retailer?.loginUrl;

      if (!loginUrl) {
        console.log(`[AuthSearch] Skipping ${cred.retailer_id}: no login URL`);
        continue;
      }

      const goalBuilder = GOAL_BUILDERS[cred.retailer_id] ?? GOAL_BUILDERS._custom;
      const goal = goalBuilder(cred.username, password, query);

      batchRuns.push({
        url: loginUrl,
        goal,
        browser_profile: "stealth",
      });

      runMeta.push({
        retailerId: cred.retailer_id,
        connectorId: cred.id,
      });
    } catch (err) {
      console.error(
        `[AuthSearch] Failed to prepare run for retailer ${cred.retailer_id}:`,
        err instanceof Error ? err.message : "unknown error"
      );
    }
  }

  if (batchRuns.length === 0) {
    console.log("[AuthSearch] No valid runs to submit");
    return [];
  }

  // 3. Submit batch
  console.log(`[AuthSearch] Submitting ${batchRuns.length} authenticated search run(s)`);
  let runIds: string[];
  try {
    runIds = await submitBatch(batchRuns);
  } catch (err) {
    console.error(
      "[AuthSearch] Batch submission failed:",
      err instanceof Error ? err.message : "unknown error"
    );
    return [];
  }

  // 4. Poll for results
  const results = await pollBatchResults(runIds, {
    pollIntervalMs: 8_000,
    timeoutMs: 90_000,
  });

  // 5. Normalize results into Product[]
  const products: Product[] = [];
  const now = Date.now();

  for (let idx = 0; idx < runIds.length; idx++) {
    const runId = runIds[idx];
    const meta = runMeta[idx];
    const result = results.get(runId);

    if (!result) {
      console.log(`[AuthSearch] No result for run ${runId} (${meta.retailerId})`);
      continue;
    }

    if (result.status !== "COMPLETED" || !result.result) {
      console.log(
        `[AuthSearch] Run ${meta.retailerId} status=${result.status}${result.error ? ` error=${result.error.code}` : ""}`
      );
      continue;
    }

    // Check for 2FA error in result
    if (result.result.error === "2fa_required") {
      console.log(`[AuthSearch] ${meta.retailerId} requires 2FA — skipping`);
      continue;
    }

    const rawProducts = result.result.products;
    if (!Array.isArray(rawProducts)) {
      console.log(`[AuthSearch] ${meta.retailerId} returned no products array`);
      continue;
    }

    const limited = rawProducts.slice(0, 10);
    console.log(`[AuthSearch] ${meta.retailerId} returned ${limited.length} product(s)`);

    for (let i = 0; i < limited.length; i++) {
      const item = limited[i] as Record<string, unknown>;
      const price = typeof item.price === "number" ? item.price : parseFloat(String(item.price ?? "0"));

      products.push({
        id: `auth-${meta.retailerId}-${now}-${i}`,
        source: meta.retailerId,
        title: String(item.name ?? "Unknown Product"),
        currentPrice: isNaN(price) ? 0 : price,
        currency: typeof item.currency === "string" ? item.currency : "USD",
        productUrl: typeof item.url === "string" ? item.url : undefined,
        imageUrl: typeof item.image_url === "string" ? item.image_url : undefined,
        rating: typeof item.rating === "number" ? item.rating : undefined,
        urlReliability: "direct",
        metadata: {
          authenticated: true,
          connectorId: meta.connectorId,
          ...(typeof item.prime === "boolean" && { prime: item.prime }),
          ...(typeof item.free_shipping === "boolean" && { free_shipping: item.free_shipping }),
        },
      });
    }
  }

  console.log(`[AuthSearch] Total: ${products.length} product(s) from ${batchRuns.length} retailer(s)`);
  return products;
}

// ---------------------------------------------------------------------------
// Part 3 — selectRelevantConnectors
// ---------------------------------------------------------------------------

export function selectRelevantConnectors(
  activeConnectors: string[],
  query: string,
  max: number
): string[] {
  if (activeConnectors.length <= max) return activeConnectors;

  const queryWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 1);

  const scored = activeConnectors.map((id) => {
    const categories = RETAILER_CATEGORIES[id] ?? [];
    let score = 0;

    // Base score for general retailers
    if (categories.includes("general")) {
      score += 0.5;
    }

    // Match query words against categories
    for (const word of queryWords) {
      for (const cat of categories) {
        if (cat === word) {
          score += 2;
        } else if (cat.includes(word) || word.includes(cat)) {
          score += 1;
        }
      }
    }

    return { id, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, max).map((s) => s.id);
}
