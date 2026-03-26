import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { createServiceClient } from "@/lib/db/supabase";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();

  // Fetch credential and verify ownership
  const { data: credential, error: fetchError } = await service
    .from("store_credentials")
    .select("id, user_id, retailer_id")
    .eq("id", id)
    .single();

  if (fetchError || !credential || credential.user_id !== user.id) {
    return Response.json({ error: "Credential not found" }, { status: 404 });
  }

  // Remove retailer_id from activeConnectors in user_personas if present
  const { data: persona } = await service
    .from("user_personas")
    .select("id, persona")
    .eq("user_id", user.id)
    .single();

  if (persona?.persona?.activeConnectors) {
    const connectors = persona.persona.activeConnectors as string[];
    const filtered = connectors.filter((c: string) => c !== credential.retailer_id);
    if (filtered.length !== connectors.length) {
      await service
        .from("user_personas")
        .update({
          persona: { ...persona.persona, activeConnectors: filtered },
        })
        .eq("id", persona.id);
    }
  }

  // Hard delete the credential
  const { error: deleteError } = await service
    .from("store_credentials")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return Response.json({ error: deleteError.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
