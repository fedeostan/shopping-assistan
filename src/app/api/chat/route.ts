import { anthropic } from "@ai-sdk/anthropic";
import {
  streamText,
  UIMessage,
  convertToModelMessages,
  stepCountIs,
} from "ai";
import { shoppingTools, SYSTEM_PROMPT } from "@/lib/ai/orchestrator";
import { injectPersona } from "@/lib/persona/inject";
import { logInteraction } from "@/lib/persona/engine";
import { extractChatSignals } from "@/lib/persona/signals";

export const maxDuration = 120;

/**
 * Token-aware message truncation that strips tool-result parts from older
 * messages and caps total estimated tokens. This prevents accumulated tool
 * results (often 1,000-3,000 tokens each) from blowing the 30K/min budget.
 */
function truncateMessages(messages: UIMessage[], maxTokens = 3000): UIMessage[] {
  if (messages.length <= 3) return messages;

  const estimateTokens = (msg: UIMessage): number => {
    return msg.parts.reduce((sum, part) => {
      if (part.type === "text") return sum + part.text.length / 4;
      // Tool invocations and results are serialized as JSON — estimate their size
      return sum + JSON.stringify(part).length / 4;
    }, 0);
  };

  const stripToolParts = (msg: UIMessage): UIMessage => ({
    ...msg,
    parts: msg.parts.filter((p) => p.type === "text"),
  });

  // Always preserve first message (initial intent) + last 2 (current turn)
  const first = messages[0];
  const last2 = messages.slice(-2);
  const middle = messages.slice(1, -2);

  // Start with the cost of preserved messages
  let totalTokens = estimateTokens(first) + last2.reduce((s, m) => s + estimateTokens(m), 0);
  const kept: UIMessage[] = [];

  // Walk middle messages from most recent backward, stripping tool parts
  for (let i = middle.length - 1; i >= 0; i--) {
    const stripped = stripToolParts(middle[i]);
    // Skip messages that become empty after stripping tool parts
    if (stripped.parts.length === 0) continue;
    const cost = estimateTokens(stripped);
    if (totalTokens + cost > maxTokens) break;
    totalTokens += cost;
    kept.unshift(stripped);
  }

  return [first, ...kept, ...last2];
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  // TODO: Get actual userId from auth session
  const userId: string | null = null;

  // Build system prompt with persona context
  let systemPrompt = SYSTEM_PROMPT;
  if (userId) {
    const personaContext = await injectPersona(userId);
    if (personaContext) {
      systemPrompt += `\n\n---\n\n${personaContext}`;
    }
  }

  // Extract signals from the latest user message for persona learning
  const lastMessage = messages[messages.length - 1];
  if (userId && lastMessage?.role === "user") {
    const textContent = lastMessage.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join(" ");

    const signals = extractChatSignals(textContent);
    if (signals.length > 0) {
      // Fire and forget — don't block the response
      logInteraction({
        userId,
        type: "chat_statement",
        payload: { message: textContent },
        personaSignals: signals,
      }).catch(console.error);
    }
  }

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    maxRetries: 1,
    system: systemPrompt,
    messages: await convertToModelMessages(truncateMessages(messages)),
    tools: shoppingTools,
    stopWhen: stepCountIs(3),
  });

  return result.toUIMessageStreamResponse();
}
