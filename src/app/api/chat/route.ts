import { anthropic } from "@ai-sdk/anthropic";
import { streamText, UIMessage, convertToModelMessages, stepCountIs } from "ai";
import { getShoppingTools } from "@/lib/ai/orchestrator";
import { runPipeline } from "@/lib/chat/pipeline/run";
import { defaultPipeline } from "@/lib/chat/pipeline/middleware";
import type { ChatContext } from "@/lib/chat/pipeline/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const t0 = Date.now();
  const { messages, id: conversationId }: { messages: UIMessage[]; id?: string } = await req.json();

  console.log(`[Chat] POST START conversationId=${conversationId ?? "new"} messageCount=${messages.length} lastRole=${messages[messages.length - 1]?.role}`);

  const ctx: ChatContext = {
    req,
    messages,
    conversationId: conversationId ?? null,
    userId: null,
    systemPrompt: "",
    truncatedMessages: messages,
    backgroundTasks: [],
  };

  await runPipeline(ctx, defaultPipeline);

  console.log(`[Chat] Pipeline done userId=${ctx.userId ?? "anon"} locale=${ctx.detectedLocale ?? "en"} skill=${ctx.matchedSkill ?? "none"} truncated=${ctx.truncatedMessages.length}/${messages.length} promptLen=${ctx.systemPrompt.length} bgTasks=${ctx.backgroundTasks.length} elapsed=${Date.now() - t0}ms`);

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    maxRetries: 1,
    system: ctx.systemPrompt,
    messages: await convertToModelMessages(ctx.truncatedMessages),
    tools: getShoppingTools(ctx.userId),
    stopWhen: stepCountIs(5),
  });

  console.log(`[Chat] Streaming response to client`);
  return result.toUIMessageStreamResponse();
}
