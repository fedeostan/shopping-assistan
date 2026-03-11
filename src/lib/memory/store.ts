import { createServiceClient } from "@/lib/db/supabase";
import type { UserMemory, ExtractedMemory } from "./types";

/**
 * Fetch a user's non-expired memories, most recent first.
 */
export async function getUserMemories(
  userId: string,
  limit = 20
): Promise<UserMemory[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("user_memory")
    .select("*")
    .eq("user_id", userId)
    .or("expires_at.is.null,expires_at.gt.now()")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching user memories:", error);
    return [];
  }

  return (data ?? []).map(mapRow);
}

/**
 * Save new memory rows.
 */
export async function saveMemories(
  userId: string,
  memories: ExtractedMemory[],
  conversationId: string | null
): Promise<void> {
  if (memories.length === 0) return;

  const supabase = createServiceClient();

  const rows = memories.map((m) => ({
    user_id: userId,
    type: m.type,
    content: m.content,
    confidence: m.confidence,
    source_conversation_id: conversationId,
    expires_at: m.expiresAt ?? null,
  }));

  const { error } = await supabase.from("user_memory").insert(rows);

  if (error) {
    console.error("Error saving memories:", error);
  }
}

/**
 * Update an existing memory's content and metadata.
 */
export async function updateMemory(
  existingId: string,
  memory: ExtractedMemory,
  conversationId: string | null
): Promise<void> {
  const supabase = createServiceClient();

  const { error } = await supabase
    .from("user_memory")
    .update({
      content: memory.content,
      confidence: memory.confidence,
      source_conversation_id: conversationId,
      expires_at: memory.expiresAt ?? null,
    })
    .eq("id", existingId);

  if (error) {
    console.error("Error updating memory:", error);
  }
}

/**
 * Decide whether each extracted memory is new or updates an existing one,
 * then save/update accordingly.
 */
export async function saveOrUpdateMemories(
  userId: string,
  newMemories: ExtractedMemory[],
  existingMemories: UserMemory[],
  conversationId: string | null
): Promise<void> {
  const toInsert: ExtractedMemory[] = [];

  for (const mem of newMemories) {
    // Check if this updates an existing memory (same type + content overlap)
    const match = existingMemories.find(
      (existing) =>
        existing.type === mem.type &&
        (existing.content.toLowerCase().includes(mem.content.toLowerCase().slice(0, 30)) ||
          mem.content.toLowerCase().includes(existing.content.toLowerCase().slice(0, 30)))
    );

    if (match) {
      await updateMemory(match.id, mem, conversationId);
    } else {
      toInsert.push(mem);
    }
  }

  if (toInsert.length > 0) {
    await saveMemories(userId, toInsert, conversationId);
  }
}

/** Map a DB row to our camelCase interface. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any): UserMemory {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    content: row.content,
    sourceConversationId: row.source_conversation_id,
    confidence: row.confidence,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
  };
}
