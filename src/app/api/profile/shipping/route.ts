import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { createServiceClient } from "@/lib/db/supabase";
import { z } from "zod";

const SHIPPING_COLUMNS =
  "shipping_full_name, shipping_email, shipping_phone, shipping_address1, shipping_address2, shipping_city, shipping_state, shipping_zip, shipping_country";

// Helper: treat empty string or null as undefined so .default() applies
const emptyToUndefined = z
  .union([z.string(), z.null()])
  .transform(v => (v === null || v.trim() === "") ? undefined : v);

const shippingUpdateSchema = z.object({
  fullName: z.string().min(1).max(200),
  email: z.string().email(),
  phone: emptyToUndefined.pipe(z.string().max(30).optional().default("")),
  address1: z.string().min(1).max(300),
  address2: emptyToUndefined.pipe(z.string().max(300).optional().default("")),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  zip: z.string().min(1).max(20),
  country: emptyToUndefined.pipe(z.string().min(2).max(3).optional().default("US")),
});

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { data, error } = await service
    .from("users")
    .select(SHIPPING_COLUMNS)
    .eq("id", user.id)
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    success: true,
    data: data
      ? {
          fullName: data.shipping_full_name ?? "",
          email: data.shipping_email ?? "",
          phone: data.shipping_phone ?? "",
          address1: data.shipping_address1 ?? "",
          address2: data.shipping_address2 ?? "",
          city: data.shipping_city ?? "",
          state: data.shipping_state ?? "",
          zip: data.shipping_zip ?? "",
          country: data.shipping_country ?? "US",
        }
      : null,
  });
}

export async function PUT(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = shippingUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { fullName, email, phone, address1, address2, city, state, zip, country } =
    parsed.data;

  const service = createServiceClient();
  const { error } = await service
    .from("users")
    .update({
      shipping_full_name: fullName,
      shipping_email: email,
      shipping_phone: phone || null,
      shipping_address1: address1,
      shipping_address2: address2 || null,
      shipping_city: city,
      shipping_state: state,
      shipping_zip: zip,
      shipping_country: country,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({
    success: true,
    data: { fullName, email, phone, address1, address2, city, state, zip, country },
  });
}
