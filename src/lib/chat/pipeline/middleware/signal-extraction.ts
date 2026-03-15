import { extractChatSignals, extractChatSignalsWithLLM } from "@/lib/persona/signals";
import { inferColdStartSignals } from "@/lib/persona/cold-start";
import { logInteraction } from "@/lib/persona/engine";
import type { ChatContext } from "../types";

/** Fire-and-forget: extract persona signals from the latest user message. */
export async function signalExtractionMiddleware(ctx: ChatContext): Promise<void> {
  const lastMessage = ctx.messages[ctx.messages.length - 1];
  if (!ctx.userId || lastMessage?.role !== "user") return;

  const textContent = lastMessage.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join(" ");

  let signals = await extractChatSignalsWithLLM(textContent).catch((err) => {
    console.warn(`[Middleware:signals] LLM extraction failed, falling back to regex:`, err instanceof Error ? err.message : err);
    return extractChatSignals(textContent);
  });
  console.log(`[Middleware:signals] Extracted ${signals.length} signals from "${textContent.slice(0, 50)}..."`);

  // For cold-start users, also run aggressive signal extraction
  const confidence = ctx.personaRow?.confidence_score ?? 0;
  if (confidence < 0.2) {
    const coldStartSignals = inferColdStartSignals(textContent);
    const existingKeys = new Set(signals.map((s) => `${s.type}:${s.key}`));
    const newSignals = coldStartSignals.filter(
      (s) => !existingKeys.has(`${s.type}:${s.key}`)
    );
    if (newSignals.length > 0) {
      console.log(`[Middleware:signals] Cold-start: added ${newSignals.length} extra signals (confidence=${confidence})`);
    }
    signals = [...signals, ...newSignals];
  }

  if (signals.length > 0) {
    console.log(`[Middleware:signals] Queuing ${signals.length} signals for background logging: ${signals.map(s => `${s.type}:${s.key}`).join(", ")}`);
    ctx.backgroundTasks.push(
      logInteraction({
        userId: ctx.userId,
        type: "chat_statement",
        payload: { message: textContent },
        personaSignals: signals,
      }).catch((err) => console.error(`[Middleware:signals] Background log failed:`, err))
    );
  }
}
