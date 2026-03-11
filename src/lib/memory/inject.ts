import { getUserMemories } from "./store";
import type { UserMemory, MemoryType } from "./types";

const TYPE_LABELS: Record<MemoryType, string> = {
  fact: "Facts",
  preference: "Preferences",
  goal: "Active Goals",
  context: "Context",
};

/**
 * Generate a memory context block to inject into the system prompt.
 * Returns null if the user has no memories yet.
 */
export async function injectMemory(userId: string): Promise<string | null> {
  const memories = await getUserMemories(userId, 20);
  if (memories.length === 0) return null;

  // Group by type
  const grouped = new Map<MemoryType, UserMemory[]>();
  for (const mem of memories) {
    const list = grouped.get(mem.type) ?? [];
    list.push(mem);
    grouped.set(mem.type, list);
  }

  const sections: string[] = ["## What I Remember About You"];

  for (const type of ["fact", "preference", "goal", "context"] as MemoryType[]) {
    const items = grouped.get(type);
    if (!items || items.length === 0) continue;

    sections.push(`\n**${TYPE_LABELS[type]}:**`);
    for (const item of items) {
      sections.push(`- ${item.content}`);
    }
  }

  return sections.join("\n");
}
