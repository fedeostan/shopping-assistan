import { anthropic } from "@ai-sdk/anthropic";
import { streamText, UIMessage, convertToModelMessages } from "ai";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: `You are a helpful AI shopping assistant. You help users find products, compare prices, and make smart purchasing decisions across multiple retailers including MercadoLibre and Amazon.

Be concise, friendly, and proactive about suggesting deals. When users ask about products, provide structured comparisons when possible.`,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
