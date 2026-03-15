import { loadSkills, matchSkill } from "@/lib/ai/skills/loader";
import type { ChatContext } from "../types";

/** Match a skill from the latest user message and inject it into the system prompt. */
export function skillInjectionMiddleware(ctx: ChatContext): void {
  const lastMessage = ctx.messages[ctx.messages.length - 1];
  if (lastMessage?.role !== "user") return;

  const textContent = lastMessage.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join(" ");

  const skills = loadSkills();
  const matched = matchSkill(textContent, skills);

  if (matched) {
    ctx.matchedSkill = matched.name;
    ctx.systemPrompt += `\n\n---\n\n## Active Skill: ${matched.name}\n${matched.body}`;
    console.log(`[Middleware:skill] Matched skill="${matched.name}" bodyLen=${matched.body.length}`);
  } else {
    console.log(`[Middleware:skill] No skill matched for "${textContent.slice(0, 50)}..."`);
  }
}
