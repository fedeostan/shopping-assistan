import { anthropic } from "@ai-sdk/anthropic";
import {
  streamText,
  UIMessage,
  convertToModelMessages,
  stepCountIs,
} from "ai";
import { getShoppingTools, SYSTEM_PROMPT } from "@/lib/ai/orchestrator";
import { injectPersona } from "@/lib/persona/inject";
import { logInteraction } from "@/lib/persona/engine";
import { extractChatSignals } from "@/lib/persona/signals";
import { createSupabaseServerClient } from "@/lib/db/supabase-server";

export const maxDuration = 120;

/**
 * Find where the "tail" (preserved messages) should start. We keep the
 * previous full user turn onward so that the model always has the last
 * turn's tool results (product URLs, prices, etc.) for follow-ups.
 */
function findTailStart(messages: UIMessage[]): number {
  // Find the last user message (current prompt)
  let lastUser = messages.length - 1;
  while (lastUser >= 0 && messages[lastUser].role !== "user") lastUser--;

  // Find the user message before that (previous turn start)
  let prevUser = lastUser - 1;
  while (prevUser >= 0 && messages[prevUser].role !== "user") prevUser--;

  // Preserve from previous turn start onward
  return prevUser >= 0 ? prevUser : Math.max(lastUser, 0);
}

/**
 * Summarize a tool-invocation + tool-result pair into a compact text string
 * so the model retains context without the full JSON payload.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function summarizeToolResult(toolName: string, args: Record<string, unknown>, result: any): string | null {
  try {
    switch (toolName) {
      case "search_products": {
        const query = args.query ?? "unknown";
        const products = result?.products ?? result?.results ?? [];
        if (!Array.isArray(products) || products.length === 0) {
          return `[Previous search for "${query}" returned no results]`;
        }
        const items = products
          .slice(0, 5)
          .map((p: { title?: string; price?: string | number; retailerUrl?: string }) => {
            const parts = [p.title ?? "Unknown"];
            if (p.price) parts.push(`$${p.price}`);
            if (p.retailerUrl) parts.push(p.retailerUrl);
            return parts.join(" — ");
          })
          .join("; ");
        return `[Previous search for "${query}" found: ${items}]`;
      }
      case "get_product_details": {
        const product = result?.product;
        if (!product) return `[Product details lookup failed for ${args.url}]`;
        const parts = [product.title ?? "Unknown product"];
        if (product.price) parts.push(`$${product.price}`);
        if (product.url) parts.push(product.url);
        return `[Product details: ${parts.join(" — ")}]`;
      }
      case "get_recommendations": {
        const recs = result?.recommendations ?? result?.products ?? [];
        if (!Array.isArray(recs) || recs.length === 0) return null;
        const items = recs
          .slice(0, 5)
          .map((p: { title?: string; price?: string | number }) => {
            return p.title ? `${p.title}${p.price ? ` ($${p.price})` : ""}` : "item";
          })
          .join(", ");
        return `[Recommendations: ${items}]`;
      }
      // track_price, purchase — no useful follow-up context
      default:
        return null;
    }
  } catch {
    return null;
  }
}

/** Check if a message part is a tool part (static "tool-<name>" or "dynamic-tool") */
function isToolPart(
  part: UIMessage["parts"][number]
): part is UIMessage["parts"][number] & {
  toolCallId: string;
  state: string;
  input?: unknown;
  output?: unknown;
  toolName?: string;
} {
  return part.type === "dynamic-tool" || (part.type.startsWith("tool-") && part.type !== "text");
}

/** Extract the tool name from a part (encoded in type for static, or .toolName for dynamic) */
function getToolName(part: { type: string; toolName?: string }): string {
  if (part.type === "dynamic-tool") return (part as { toolName: string }).toolName;
  // Static tool parts have type "tool-<name>"
  return part.type.slice("tool-".length);
}

/**
 * Replace tool parts in a message with compact text summaries so the model
 * retains key context (product URLs, names, prices) without the full JSON.
 */
function summarizeToolParts(msg: UIMessage): UIMessage {
  const newParts: UIMessage["parts"] = [];

  for (const part of msg.parts) {
    if (!isToolPart(part)) {
      // Keep text, reasoning, step-start, etc. as-is
      newParts.push(part);
      continue;
    }

    // Only summarize completed tool calls (output-available state)
    if (part.state !== "output-available") continue;

    const toolName = getToolName(part);
    const args = (part.input ?? {}) as Record<string, unknown>;
    const summary = summarizeToolResult(toolName, args, part.output);
    if (summary) {
      newParts.push({ type: "text" as const, text: summary });
    }
  }

  return { ...msg, parts: newParts };
}

/**
 * Token-aware message truncation that summarizes tool results in older
 * messages and caps total estimated tokens. Preserves the previous full
 * turn so the model has product URLs for follow-up questions.
 */
function truncateMessages(messages: UIMessage[], maxTokens = 6000): UIMessage[] {
  if (messages.length <= 3) return messages;

  const estimateTokens = (msg: UIMessage): number => {
    return msg.parts.reduce((sum, part) => {
      if (part.type === "text") return sum + part.text.length / 4;
      return sum + JSON.stringify(part).length / 4;
    }, 0);
  };

  const tailStart = findTailStart(messages);

  // Always preserve first message (initial intent) + tail (previous turn onward)
  const first = messages[0];
  const tail = messages.slice(tailStart);
  const middleStart = first === messages[tailStart] ? 0 : 1;
  const middle = messages.slice(middleStart || 1, tailStart);

  // Start with the cost of preserved messages
  let totalTokens =
    estimateTokens(first) + tail.reduce((s, m) => s + estimateTokens(m), 0);
  const kept: UIMessage[] = [];

  // Walk middle messages from most recent backward, summarizing tool parts
  for (let i = middle.length - 1; i >= 0; i--) {
    const summarized = summarizeToolParts(middle[i]);
    // Skip messages that become empty after summarization
    if (summarized.parts.length === 0) continue;
    const cost = estimateTokens(summarized);
    if (totalTokens + cost > maxTokens) break;
    totalTokens += cost;
    kept.unshift(summarized);
  }

  return [first, ...kept, ...tail];
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId: string | null = user?.id ?? null;

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
    tools: getShoppingTools(userId),
    stopWhen: stepCountIs(3),
  });

  return result.toUIMessageStreamResponse();
}
