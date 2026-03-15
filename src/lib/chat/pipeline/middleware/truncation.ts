import { truncateMessages } from "../utils";
import type { ChatContext } from "../types";

/** Apply token-aware message truncation to the context. */
export function truncationMiddleware(ctx: ChatContext): void {
  const before = ctx.messages.length;
  ctx.truncatedMessages = truncateMessages(ctx.messages);
  console.log(`[Middleware:truncation] Messages: ${before} → ${ctx.truncatedMessages.length} (dropped ${before - ctx.truncatedMessages.length})`);
}
