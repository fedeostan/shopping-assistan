import fs from "fs";
import path from "path";

export interface Skill {
  name: string;
  trigger: RegExp;
  tools: string[];
  maxSteps: number;
  body: string;
}

let cachedSkills: Skill[] | null = null;

/**
 * Parse YAML-like frontmatter from a markdown file.
 * Uses simple regex extraction — no gray-matter dependency needed.
 */
function parseFrontmatter(content: string): { meta: Record<string, string>; body: string } {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };

  const meta: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const kv = line.match(/^(\w[\w_]*)\s*:\s*(.+)$/);
    if (kv) meta[kv[1]] = kv[2].trim();
  }

  return { meta, body: match[2].trim() };
}

/**
 * Load all skill definitions from .md files in the skills directory.
 * Cached at module level (loaded once per cold start).
 */
export function loadSkills(): Skill[] {
  if (cachedSkills) return cachedSkills;

  const skillsDir = path.join(process.cwd(), "src/lib/ai/skills");
  const files = fs.readdirSync(skillsDir).filter((f) => f.endsWith(".md"));

  cachedSkills = files.map((file) => {
    const raw = fs.readFileSync(path.join(skillsDir, file), "utf-8");
    const { meta, body } = parseFrontmatter(raw);

    return {
      name: meta.name || file.replace(".md", ""),
      trigger: new RegExp(meta.trigger || "(?!)", "i"),
      tools: meta.tools ? meta.tools.split(",").map((t) => t.trim()) : [],
      maxSteps: parseInt(meta.max_steps || "5", 10),
      body,
    };
  });

  // Sort by specificity: skills with longer trigger patterns match first
  cachedSkills.sort((a, b) => b.trigger.source.length - a.trigger.source.length);

  return cachedSkills;
}

/**
 * Match the first skill whose trigger regex matches the message.
 */
export function matchSkill(message: string, skills: Skill[]): Skill | null {
  for (const skill of skills) {
    if (skill.trigger.test(message)) return skill;
  }
  return null;
}
