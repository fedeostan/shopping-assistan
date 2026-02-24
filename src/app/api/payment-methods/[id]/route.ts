import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { createServiceClient } from "@/lib/db/supabase";
import { z } from "zod";

const SAFE_FIELDS =
  "id, label, brand, last4, exp_month, exp_year, is_active, is_default, created_at, updated_at";

const patchSchema = z.object({
  label: z.string().max(50).optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

async function authorize(id: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" as const, status: 401 };

  const service = createServiceClient();
  const { data: card } = await service
    .from("payment_methods")
    .select("id, user_id")
    .eq("id", id)
    .single();

  if (!card || card.user_id !== user.id) {
    return { error: "Not found" as const, status: 404 };
  }

  return { user, service };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await authorize(id);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  const { user, service } = auth;

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.label !== undefined) updates.label = parsed.data.label;
  if (parsed.data.isActive !== undefined) updates.is_active = parsed.data.isActive;

  // Handle setting default — clear previous default first
  if (parsed.data.isDefault === true) {
    await service
      .from("payment_methods")
      .update({ is_default: false })
      .eq("user_id", user.id)
      .eq("is_default", true)
      .eq("is_active", true);
    updates.is_default = true;
  } else if (parsed.data.isDefault === false) {
    updates.is_default = false;
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await service
    .from("payment_methods")
    .update(updates)
    .eq("id", id)
    .select(SAFE_FIELDS)
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true, data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await authorize(id);
  if ("error" in auth) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  const { service } = auth;

  const { error } = await service
    .from("payment_methods")
    .delete()
    .eq("id", id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
