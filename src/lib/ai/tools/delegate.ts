import { tool, generateText, stepCountIs, type ToolSet } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { WORKER_CONFIGS } from "../workers";
import { getShoppingTools } from "../orchestrator";
import { getPersona } from "@/lib/persona/engine";
import { getPersonaSlice } from "@/lib/persona/inject";

export function createDelegateTask(userId: string | null) {
  return tool({
    description:
      "Delegate a specialized task to a focused sub-agent. Use 'research' for deep product analysis, 'compare' for side-by-side comparisons of 2+ products, 'recommend' for personalized suggestions. The sub-agent has its own tools and returns a complete result.",
    inputSchema: z.object({
      worker: z.enum(["research", "compare", "recommend"]),
      task: z
        .string()
        .describe("Clear description of what the worker should do"),
      context: z
        .string()
        .optional()
        .describe("Additional context from the conversation"),
    }),
    execute: async ({ worker, task, context }) => {
      console.log(`[Tool:delegate] START worker=${worker} task="${task.slice(0, 100)}" hasContext=${!!context}`);
      const t0 = Date.now();

      const config = WORKER_CONFIGS[worker];
      if (!config) {
        console.error(`[Tool:delegate] Unknown worker: ${worker}`);
        return { worker, task, error: `Unknown worker: ${worker}` };
      }

      // Build constrained tool subset
      const allTools = getShoppingTools(userId);
      const toolSubset: ToolSet = {};
      for (const toolName of config.tools) {
        const t = allTools[toolName as keyof typeof allTools];
        if (t) toolSubset[toolName] = t;
      }
      console.log(`[Tool:delegate] Worker "${worker}" tools: [${config.tools.join(", ")}] maxSteps=${config.maxSteps}`);

      // Get persona slice for this worker
      let personaContext = "";
      if (userId) {
        const row = await getPersona(userId);
        if (row) {
          const slice = getPersonaSlice(
            row.persona,
            config.personaSlice
          );
          personaContext = `\n\nUser preferences: ${JSON.stringify(slice)}`;
          console.log(`[Tool:delegate] Persona loaded for worker "${worker}": sliceKeys=${Object.keys(slice)}`);
        } else {
          console.log(`[Tool:delegate] No persona found for userId=${userId}`);
        }
      }

      const systemPrompt = config.systemPrompt + personaContext;

      const userPrompt = context
        ? `${task}\n\nAdditional context: ${context}`
        : task;

      try {
        console.log(`[Tool:delegate] Launching worker "${worker}" with generateText...`);
        const result = await generateText({
          model: anthropic("claude-haiku-4-5-20251001"),
          system: systemPrompt,
          prompt: userPrompt,
          tools: toolSubset,
          stopWhen: stepCountIs(config.maxSteps),
        });

        console.log(`[Tool:delegate] Worker "${worker}" DONE resultLen=${result.text.length} elapsed=${Date.now() - t0}ms`);
        return {
          worker,
          task,
          result: result.text,
        };
      } catch (error) {
        console.error(`[Tool:delegate] Worker "${worker}" FAILED elapsed=${Date.now() - t0}ms:`, error instanceof Error ? error.message : error);
        return {
          worker,
          task,
          error: `Worker failed: ${error instanceof Error ? error.message : "unknown error"}`,
        };
      }
    },
  });
}
