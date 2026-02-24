import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { createServiceClient } from "@/lib/db/supabase";

export async function DELETE() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const serviceClient = createServiceClient();
  const userId = user.id;

  try {
    // Delete user data from leaf tables first to respect FK constraints
    await serviceClient.from("price_alerts").delete().eq("user_id", userId);
    await serviceClient
      .from("user_interactions")
      .delete()
      .eq("user_id", userId);
    await serviceClient.from("user_personas").delete().eq("user_id", userId);
    await serviceClient.from("users").delete().eq("id", userId);

    // Delete the auth user last
    const { error } = await serviceClient.auth.admin.deleteUser(userId);
    if (error) throw error;

    return Response.json({ success: true });
  } catch (err) {
    console.error("Account deletion failed:", err);
    return Response.json(
      { error: "Failed to delete account. Please try again." },
      { status: 500 }
    );
  }
}
