import { detectLanguage, LOCALE_CONFIG } from "@/lib/i18n/detect";
import { updateLocale } from "@/lib/persona/engine";
import type { ChatContext } from "../types";

/** Detect language from last user message, set locale on context, and append locale prompt block. */
export function languageDetectionMiddleware(ctx: ChatContext): void {
  const lastMessage = ctx.messages[ctx.messages.length - 1];
  if (lastMessage?.role !== "user") return;

  const textContent = lastMessage.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join(" ");

  const locale = detectLanguage(textContent);
  ctx.detectedLocale = locale;
  console.log(`[Middleware:language] Detected locale=${locale} from "${textContent.slice(0, 50)}..."`);

  // Append locale instruction to system prompt for non-English
  if (locale !== "en") {
    const config = LOCALE_CONFIG[locale];
    ctx.systemPrompt += `\n\n---\n\n## Language & Locale\nThe user communicates in ${config.label}. ALWAYS respond in the same language.\nUse ${config.currency} for prices. Prioritize local retailers (MercadoLibre, etc.).`;
    console.log(`[Middleware:language] Appended locale block: ${config.label} / ${config.currency}`);

    // Update persona locale if it differs (uses cached personaRow from system-prompt middleware)
    if (ctx.userId) {
      const personaLocale = ctx.personaRow?.persona?.locale;
      if (personaLocale !== locale) {
        console.log(`[Middleware:language] Updating persona locale: ${personaLocale} → ${locale}`);
        ctx.backgroundTasks.push(
          updateLocale(ctx.userId, locale, config.country, config.currency).catch(
            console.error
          )
        );
      }
    }
  }
}
