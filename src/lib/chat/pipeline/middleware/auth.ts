import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import type { ChatContext } from "../types";

/** Extract userId from the Supabase auth cookie. */
export async function authMiddleware(ctx: ChatContext): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  ctx.userId = user?.id ?? null;
  console.log(`[Middleware:auth] userId=${ctx.userId ?? "anonymous"}`);
}
