import type { ChatContext, ChatMiddleware } from "./types";

/** Execute middleware functions sequentially, enriching the shared context. */
export async function runPipeline(
  ctx: ChatContext,
  middleware: ChatMiddleware[]
): Promise<ChatContext> {
  console.log(`[Pipeline] START middlewareCount=${middleware.length}`);
  const t0 = Date.now();
  for (const mw of middleware) {
    const name = mw.name || "anonymous";
    const mt0 = Date.now();
    await mw(ctx);
    console.log(`[Pipeline] ${name} done elapsed=${Date.now() - mt0}ms`);
  }
  console.log(`[Pipeline] DONE totalElapsed=${Date.now() - t0}ms`);
  return ctx;
}
