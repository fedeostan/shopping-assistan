import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { createServiceClient } from "@/lib/db/supabase";
import { encryptCredential } from "@/lib/crypto/credential-encryption";
import { getRetailerById, PREDEFINED_RETAILERS } from "@/lib/connectors/retailers";
import { z } from "zod";

const SAFE_FIELDS =
  "id, retailer_id, retailer_name, retailer_url, retailer_icon, username, status, verified_at, created_at, updated_at";

const addCredentialSchema = z.object({
  retailerId: z.string().min(1).max(100),
  retailerName: z.string().min(1).max(100).optional(),
  retailerUrl: z.string().url().optional(),
  username: z.string().min(1).max(200),
  password: z.string().min(1).max(200),
});

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { data, error } = await service
    .from("store_credentials")
    .select(SAFE_FIELDS)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true, data });
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = addCredentialSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { retailerId, retailerName, retailerUrl, username, password } = parsed.data;

  // Check if this is a predefined retailer
  const predefined = getRetailerById(retailerId);
  const isCustom = !predefined;

  // Custom stores require retailerName and retailerUrl
  if (isCustom) {
    if (!retailerName) {
      return Response.json(
        { error: "retailerName is required for custom stores" },
        { status: 400 }
      );
    }
    if (!retailerUrl) {
      return Response.json(
        { error: "retailerUrl is required for custom stores" },
        { status: 400 }
      );
    }
  }

  const service = createServiceClient();

  // Rate limit: max 10 credentials per user
  const { count } = await service
    .from("store_credentials")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if ((count ?? 0) >= 10) {
    return Response.json(
      { error: "Maximum of 10 credentials allowed. Please remove one first." },
      { status: 400 }
    );
  }

  // Encrypt password
  let encrypted: string;
  try {
    encrypted = encryptCredential({ password });
  } catch {
    console.error("Credential encryption failed — check CARD_ENCRYPTION_KEY env var");
    return Response.json(
      { error: "Unable to securely store credentials. Please try again later." },
      { status: 500 }
    );
  }

  // Build row data — use predefined retailer info when available
  const rowData = {
    user_id: user.id,
    retailer_id: retailerId,
    retailer_name: predefined ? predefined.name : retailerName!,
    retailer_url: predefined ? predefined.url : retailerUrl!,
    retailer_icon: predefined ? predefined.icon : null,
    username,
    encrypted_data: encrypted,
    status: "pending" as const,
  };

  const { data, error } = await service
    .from("store_credentials")
    .insert(rowData)
    .select(SAFE_FIELDS)
    .single();

  if (error) {
    // Handle duplicate retailer_id per user (unique constraint violation)
    if (error.code === "23505") {
      return Response.json(
        { error: "You already have credentials saved for this retailer." },
        { status: 409 }
      );
    }
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true, data }, { status: 201 });
}
