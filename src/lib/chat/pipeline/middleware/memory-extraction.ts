import { getUserMemories, saveOrUpdateMemories } from "@/lib/memory/store";
import { extractMemories } from "@/lib/memory/extractor";
import type { ChatContext } from "../types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Fire-and-forget: extract and persist new memories from the latest user message. */
export function memoryExtractionMiddleware(ctx: ChatContext): void {
  const lastMessage = ctx.messages[ctx.messages.length - 1];
  if (!ctx.userId || lastMessage?.role !== "user") return;

  const textContent = lastMessage.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join(" ");

  const userId = ctx.userId;
  // Client may send local placeholder IDs (e.g. "__LOCALID_…") before Supabase sync;
  // the DB column is uuid, so only pass valid UUIDs.
  const conversationId =
    ctx.conversationId && UUID_RE.test(ctx.conversationId)
      ? ctx.conversationId
      : null;

  ctx.backgroundTasks.push(
    getUserMemories(userId, 20)
      .then(async (existingMemories) => {
        const newMemories = await extractMemories(textContent, existingMemories);
        if (newMemories.length > 0) {
          await saveOrUpdateMemories(userId, newMemories, existingMemories, conversationId);
        }
      })
      .catch(console.error)
  );
}
