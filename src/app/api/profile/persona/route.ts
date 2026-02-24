import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { createServiceClient } from "@/lib/db/supabase";
import { getPersona, getConfidenceLabel } from "@/lib/persona/engine";
import type { UserPersona } from "@/lib/persona/types";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const row = await getPersona(user.id);
  if (!row) return Response.json({ error: "No persona found" }, { status: 404 });

  return Response.json({
    persona: row.persona,
    confidenceScore: row.confidence_score,
    confidenceLabel: getConfidenceLabel(row.confidence_score),
    lastRefreshedAt: row.last_refreshed_at,
  });
}

export async function PATCH(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const row = await getPersona(user.id);
  if (!row) return Response.json({ error: "No persona found" }, { status: 404 });

  const updates = (await req.json()) as Partial<UserPersona>;
  const merged = mergePersona(row.persona, updates);

  const serviceClient = createServiceClient();
  const { error } = await serviceClient
    .from("user_personas")
    .update({
      persona: merged,
      last_refreshed_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (error) {
    return Response.json({ error: "Failed to update persona" }, { status: 500 });
  }

  return Response.json({
    persona: merged,
    confidenceScore: row.confidence_score,
    confidenceLabel: getConfidenceLabel(row.confidence_score),
    lastRefreshedAt: new Date().toISOString(),
  });
}

// Primitive fields on UserPersona that should be directly overwritten
const PRIMITIVE_KEYS: (keyof UserPersona)[] = [
  "locale",
  "currency",
  "country",
  "householdSize",
  "lifeStage",
  "priceQualitySpectrum",
  "averageOrderValue",
  "promotionResponsiveness",
];

// Record fields that should be shallow-merged (null values delete keys)
const RECORD_KEYS: (keyof UserPersona)[] = [
  "brandAffinities",
  "categoryInterests",
  "budgetRanges",
  "sizeData",
];

// Array fields that are fully replaced from the client
const ARRAY_KEYS: (keyof UserPersona)[] = [
  "preferredRetailers",
  "dietaryRestrictions",
  "hobbies",
  "upcomingNeeds",
  "searchPatterns",
];

/**
 * Merge user edits into an existing persona.
 *
 * Strategy:
 * - Primitives: direct overwrite
 * - Records: shallow merge; null values delete keys
 * - Arrays: full replacement from client
 *
 * TODO: This is where you can customize the merge behavior.
 *       See the contribution note below.
 */
function mergePersona(
  existing: UserPersona,
  updates: Partial<UserPersona>
): UserPersona {
  const result = { ...existing };

  for (const key of PRIMITIVE_KEYS) {
    if (key in updates) {
      (result as Record<string, unknown>)[key] = updates[key];
    }
  }

  for (const key of RECORD_KEYS) {
    if (key in updates) {
      const existingRecord =
        (existing[key] as Record<string, unknown> | undefined) ?? {};
      const updateRecord = updates[key] as Record<string, unknown> | undefined;

      if (!updateRecord) {
        (result as Record<string, unknown>)[key] = existingRecord;
        continue;
      }

      const merged = { ...existingRecord };
      for (const [k, v] of Object.entries(updateRecord)) {
        if (v === null) {
          delete merged[k];
        } else {
          merged[k] = v;
        }
      }
      (result as Record<string, unknown>)[key] = merged;
    }
  }

  for (const key of ARRAY_KEYS) {
    if (key in updates) {
      (result as Record<string, unknown>)[key] = updates[key];
    }
  }

  return result;
}
