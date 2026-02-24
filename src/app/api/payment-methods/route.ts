import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { createServiceClient } from "@/lib/db/supabase";
import { encryptCardData } from "@/lib/crypto/card-encryption";
import {
  luhnCheck,
  isExpiryValid,
  detectBrand,
  getLast4,
  cvvLength,
} from "@/lib/crypto/card-validation";
import { z } from "zod";

const SAFE_FIELDS =
  "id, label, brand, last4, exp_month, exp_year, is_active, is_default, created_at, updated_at";

const addCardSchema = z.object({
  cardNumber: z.string().min(13).max(19),
  cvv: z.string().min(3).max(4),
  cardholderName: z.string().min(1).max(100),
  expMonth: z.number().int().min(1).max(12),
  expYear: z.number().int().min(24).max(99),
  label: z.string().max(50).optional(),
  isDefault: z.boolean().optional().default(false),
});

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { data, error } = await service
    .from("payment_methods")
    .select(SAFE_FIELDS)
    .eq("user_id", user.id)
    .eq("is_active", true)
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
  const parsed = addCardSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { cardNumber, cvv, cardholderName, expMonth, expYear, label, isDefault } =
    parsed.data;

  // Validate card number
  if (!luhnCheck(cardNumber)) {
    return Response.json({ error: "Invalid card number" }, { status: 400 });
  }

  // Validate expiry
  if (!isExpiryValid(expMonth, expYear)) {
    return Response.json({ error: "Card is expired" }, { status: 400 });
  }

  const brand = detectBrand(cardNumber);

  // Validate CVV length for brand
  if (cvv.length !== cvvLength(brand)) {
    return Response.json(
      { error: `CVV must be ${cvvLength(brand)} digits for ${brand}` },
      { status: 400 }
    );
  }

  const service = createServiceClient();

  // Rate limit: max 5 active cards per user
  const { count } = await service
    .from("payment_methods")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_active", true);

  if ((count ?? 0) >= 5) {
    return Response.json(
      { error: "Maximum of 5 cards allowed. Please remove one first." },
      { status: 400 }
    );
  }

  // Clear previous default if this card is default
  if (isDefault) {
    await service
      .from("payment_methods")
      .update({ is_default: false })
      .eq("user_id", user.id)
      .eq("is_default", true)
      .eq("is_active", true);
  }

  const encrypted = encryptCardData({ cardNumber, cvv, cardholderName });
  const last4 = getLast4(cardNumber);

  const { data, error } = await service
    .from("payment_methods")
    .insert({
      user_id: user.id,
      label: label || null,
      brand,
      last4,
      exp_month: expMonth,
      exp_year: expYear,
      encrypted_card_data: encrypted,
      is_default: isDefault,
    })
    .select(SAFE_FIELDS)
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true, data }, { status: 201 });
}
