import type { UIMessage } from "ai";
import type { UserPersona } from "@/lib/persona/types";
import type { Locale } from "@/lib/i18n/detect";

/** Accumulated state passed through the middleware pipeline. */
export interface ChatContext {
  req: Request;
  messages: UIMessage[];
  conversationId: string | null;
  userId: string | null;
  systemPrompt: string;
  truncatedMessages: UIMessage[];
  backgroundTasks: Promise<unknown>[];
  /** Cached persona row — fetched once, shared across middleware. */
  personaRow?: { persona: UserPersona; confidence_score: number } | null;
  /** Detected language from the latest user message. */
  detectedLocale?: Locale;
  /** Matched skill name (for logging). */
  matchedSkill?: string;
}

/** A middleware function that enriches the ChatContext in place. */
export type ChatMiddleware = (ctx: ChatContext) => Promise<void> | void;
