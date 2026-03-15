import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { createServiceClient } from "@/lib/db/supabase";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify the conversation belongs to this user
  const serviceClient = createServiceClient();
  const { data: conversation, error: fetchError } = await serviceClient
    .from("conversations")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();

  if (fetchError || !conversation) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }

  // Soft-delete using service client (bypasses RLS)
  const { error } = await serviceClient
    .from("conversations")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return Response.json(
      { error: "Failed to delete conversation" },
      { status: 500 },
    );
  }

  return new Response(null, { status: 204 });
}
