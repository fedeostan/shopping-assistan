import type { ChatMiddleware } from "../types";
import { authMiddleware } from "./auth";
import { languageDetectionMiddleware } from "./language-detection";
import { systemPromptMiddleware } from "./system-prompt";
import { skillInjectionMiddleware } from "./skill-injection";
import { signalExtractionMiddleware } from "./signal-extraction";
import { memoryExtractionMiddleware } from "./memory-extraction";
import { truncationMiddleware } from "./truncation";

export { authMiddleware } from "./auth";
export { languageDetectionMiddleware } from "./language-detection";
export { systemPromptMiddleware } from "./system-prompt";
export { skillInjectionMiddleware } from "./skill-injection";
export { signalExtractionMiddleware } from "./signal-extraction";
export { memoryExtractionMiddleware } from "./memory-extraction";
export { truncationMiddleware } from "./truncation";

export const defaultPipeline: ChatMiddleware[] = [
  authMiddleware,
  systemPromptMiddleware,     // fetches persona, builds base prompt
  languageDetectionMiddleware, // uses cached persona, sets detectedLocale, appends locale block
  skillInjectionMiddleware,    // appends skill workflow
  signalExtractionMiddleware,
  memoryExtractionMiddleware,
  truncationMiddleware,
];
