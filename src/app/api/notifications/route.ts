import { createSupabaseServerClient } from "@/lib/db/supabase-server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: notifications, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("is_read", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ notifications });
}

export async function PATCH(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  if (body.all) {
    // Mark all as read
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
  } else if (body.ids && Array.isArray(body.ids)) {
    // Mark specific notifications as read
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .in("id", body.ids);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
  } else {
    return Response.json({ error: "Provide { ids: [...] } or { all: true }" }, { status: 400 });
  }

  return Response.json({ ok: true });
}
