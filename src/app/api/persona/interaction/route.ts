import { createSupabaseServerClient } from "@/lib/db/supabase-server";
import { logInteraction } from "@/lib/persona/engine";
import type { InteractionRecord, PersonaSignal } from "@/lib/persona/types";

const VALID_TYPES: InteractionRecord["type"][] = [
  "search", "click", "purchase", "dismiss", "feedback",
  "chat_statement", "recommendation_click",
];

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { type, payload, personaSignals } = body as {
    type: string;
    payload: Record<string, unknown>;
    personaSignals?: PersonaSignal[];
  };

  if (!type || !VALID_TYPES.includes(type as InteractionRecord["type"])) {
    return Response.json({ error: "Invalid interaction type" }, { status: 400 });
  }

  await logInteraction({
    userId: user.id,
    type: type as InteractionRecord["type"],
    payload: payload ?? {},
    personaSignals,
  });

  return Response.json({ success: true });
}
