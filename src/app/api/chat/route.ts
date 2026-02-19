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

export const maxDuration = 60;

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
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    tools: shoppingTools,
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
}
