import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import type { UserMemory, ExtractedMemory } from "./types";

const memorySchema = z.object({
  memories: z.array(
    z.object({
      type: z.enum(["fact", "preference", "goal", "context"]),
      content: z.string().max(200),
      confidence: z.number(),
      expiresAt: z.string().optional(),
    })
  ),
});

/**
 * Extract discrete, memorable facts from a user message using Haiku.
 * Existing memories are provided for deduplication — the LLM only returns new facts.
 * Returns [] on error (never blocks or throws).
 */
export async function extractMemories(
  message: string,
  existingMemories: UserMemory[]
): Promise<ExtractedMemory[]> {
  try {
    const existingList =
      existingMemories.length > 0
        ? existingMemories
            .map((m, i) => `${i + 1}. [${m.type}] ${m.content}`)
            .join("\n")
        : "None yet.";

    const { object } = await generateObject({
      model: anthropic("claude-haiku-4-5-20251001"),
      schema: memorySchema,
      maxOutputTokens: 400,
      prompt: `Extract discrete personal facts from this shopping chat message that would be useful to remember in future sessions.

Memory types:
- fact: Objective facts about the user ("has a daughter starting college", "lives in Brooklyn")
- preference: Specific shopping preferences too granular for general profiling ("prefers silver electronics", "allergic to latex")
- goal: Active shopping goals ("looking for a birthday gift for wife", "furnishing a new apartment")
- context: Situational context ("recently moved to NYC", "starting a new job in September")

Already known about this user:
${existingList}

Rules:
- Only extract clearly stated facts useful for future shopping sessions
- Return empty array if nothing new or noteworthy
- Better to miss a fact than hallucinate one
- Do not duplicate or rephrase existing memories
- If a fact updates an existing memory, return the updated version with the same type
- Keep content concise (under 200 chars)
- Set confidence 0.5-1.0 based on how explicitly stated the fact is
- Set expiresAt (ISO date) only for time-bound goals/context; omit for permanent facts

User message: "${message}"`,
    });

    return object.memories;
  } catch (error) {
    console.error("Memory extraction failed:", error);
    return [];
  }
}
