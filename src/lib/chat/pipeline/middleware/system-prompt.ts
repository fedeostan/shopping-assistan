import { SYSTEM_PROMPT } from "@/lib/ai/orchestrator";
import { injectPersona } from "@/lib/persona/inject";
import { injectMemory } from "@/lib/memory/inject";
import { getPersona } from "@/lib/persona/engine";
import { buildColdStartPromptAddendum } from "@/lib/persona/cold-start";
import type { ChatContext } from "../types";

/** Build the system prompt with persona + memory context. */
export async function systemPromptMiddleware(ctx: ChatContext): Promise<void> {
  ctx.systemPrompt = SYSTEM_PROMPT;

  if (ctx.userId) {
    // Fetch persona once and cache on context for other middleware to reuse
    const personaRow = await getPersona(ctx.userId);
    ctx.personaRow = personaRow
      ? { persona: personaRow.persona, confidence_score: personaRow.confidence_score }
      : null;
    console.log(`[Middleware:system-prompt] Persona: ${personaRow ? `confidence=${personaRow.confidence_score}` : "none"}`);

    const [personaContext, memoryContext] = await Promise.all([
      injectPersona(ctx.userId),
      injectMemory(ctx.userId),
    ]);
    if (personaContext) {
      ctx.systemPrompt += `\n\n---\n\n${personaContext}`;
      console.log(`[Middleware:system-prompt] Injected persona context (${personaContext.length} chars)`);
    }
    if (memoryContext) {
      ctx.systemPrompt += `\n\n---\n\n${memoryContext}`;
      console.log(`[Middleware:system-prompt] Injected memory context (${memoryContext.length} chars)`);
    }

    // Cold-start addendum for new users
    const confidence = ctx.personaRow?.confidence_score ?? 0;
    const coldStartAddendum = buildColdStartPromptAddendum(confidence);
    if (coldStartAddendum) {
      ctx.systemPrompt += `\n\n---\n\n${coldStartAddendum}`;
      console.log(`[Middleware:system-prompt] Added cold-start addendum (confidence=${confidence})`);
    }
  }

  console.log(`[Middleware:system-prompt] Final prompt length: ${ctx.systemPrompt.length} chars`);
}
