import { HttpError, isRetryableError } from "@/lib/utils/http-error";
import { withRetry } from "@/lib/utils/retry";
import { getBreaker } from "@/lib/utils/circuit-breaker";

const TINYFISH_API_URL = "https://agent.tinyfish.ai/v1/automation/run-sse";

export interface TinyFishRequest {
  /** The URL to navigate to */
  url: string;
  /** Natural language description of what the agent should do */
  goal: string;
  /** Browser profile: "lite" for normal sites, "stealth" for anti-bot protection */
  browser_profile?: "lite" | "stealth";
  /** Proxy configuration for geo-restricted sites */
  proxy_config?: { enabled: boolean; country: string };
  /** Feature flags for the TinyFish agent */
  feature_flags?: Record<string, boolean>;
}

export interface AutomationOptions {
  /** Timeout in milliseconds. Default 300_000 (5 min). */
  timeoutMs?: number;
  /** Max PROGRESS events before aborting. Default 40. */
  maxSteps?: number;
  /** Number of identical consecutive messages that triggers loop abort. Default 3. */
  loopThreshold?: number;
}

export interface TinyFishProgressEvent {
  type: "PROGRESS";
  purpose?: string;
  status?: string;
}

export interface TinyFishStreamingUrlEvent {
  type: "STREAMING_URL";
  streamingUrl: string;
}

export interface TinyFishStartedEvent {
  type: "STARTED";
}

export interface TinyFishHeartbeatEvent {
  type: "HEARTBEAT";
}

export interface TinyFishCompleteEvent {
  type: "COMPLETE";
  status: "COMPLETED" | "FAILED";
  resultJson?: Record<string, unknown>;
  error?: string;
}

export type TinyFishEvent =
  | TinyFishProgressEvent
  | TinyFishStreamingUrlEvent
  | TinyFishStartedEvent
  | TinyFishHeartbeatEvent
  | TinyFishCompleteEvent;

export interface TinyFishResult {
  success: boolean;
  data?: Record<string, unknown>;
  statusMessages: string[];
  streamingUrl?: string;
  error?: string;
  /** Set when the automation was aborted by a safety limit */
  abortReason?: "timeout" | "step_limit" | "loop_detected";
}

/**
 * Execute a browser automation task via TinyFish Web Agent.
 * Consumes the SSE stream and returns the final result.
 */
export async function runAutomation(
  request: TinyFishRequest,
  opts: AutomationOptions = {}
): Promise<TinyFishResult> {
  const apiKey = process.env.TINYFISH_API_KEY;
  if (!apiKey) {
    throw new Error("TINYFISH_API_KEY is not set in environment variables");
  }

  const timeoutMs = opts.timeoutMs ?? 300_000;
  const maxSteps = opts.maxSteps ?? 40;
  const loopThreshold = opts.loopThreshold ?? 3;

  console.log(`[TinyFish] runAutomation START url=${request.url} goal="${request.goal.slice(0, 80)}..." profile=${request.browser_profile ?? "stealth"} timeout=${timeoutMs}ms maxSteps=${maxSteps}`);

  return getBreaker("tinyfish", {
    threshold: 2,
    cooldownMs: 120_000,
  }).execute(() =>
    withRetry(
      async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const response = await fetch(TINYFISH_API_URL, {
            method: "POST",
            headers: {
              "X-API-Key": apiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              url: request.url,
              goal: request.goal,
              browser_profile: request.browser_profile ?? "stealth",
              ...(request.proxy_config && { proxy_config: request.proxy_config }),
              feature_flags: {
                enable_agent_memory: true,
                ...request.feature_flags,
              },
            }),
            signal: controller.signal,
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new HttpError(
              `TinyFish API error: ${response.status} ${response.statusText} — ${errorText}`,
              response.status
            );
          }

          if (!response.body) {
            throw new Error("TinyFish API returned no response body");
          }

          return consumeSSEStream(response.body, {
            maxSteps,
            loopThreshold,
            abortController: controller,
          });
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            return {
              success: false,
              statusMessages: [],
              error: `Automation timed out after ${timeoutMs / 1000}s`,
              abortReason: "timeout" as const,
            };
          }
          throw error;
        } finally {
          clearTimeout(timeout);
        }
      },
      {
        maxRetries: 2,
        shouldRetry: isRetryableError,
        onRetry: (error, attempt) => {
          console.warn(
            `[TinyFish] Retry ${attempt}/2 after error:`,
            error instanceof Error ? error.message : error
          );
        },
      }
    )
  );
}

interface StreamOptions {
  maxSteps: number;
  loopThreshold: number;
  abortController: AbortController;
}

/**
 * Parse the SSE stream from TinyFish Web Agent.
 * Collects status messages, enforces step limits and loop detection.
 */
async function consumeSSEStream(
  body: ReadableStream<Uint8Array>,
  opts: StreamOptions
): Promise<TinyFishResult> {
  const reader = body.getReader();
  const decoder = new TextDecoder();

  const statusMessages: string[] = [];
  let streamingUrl: string | undefined;
  let buffer = "";
  let progressCount = 0;
  const recentMessages: string[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE lines
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // Keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;

        const jsonStr = trimmed.slice(6); // Remove "data: " prefix
        if (!jsonStr) continue;

        try {
          const event = JSON.parse(jsonStr) as TinyFishEvent;

          switch (event.type) {
            case "STREAMING_URL":
              streamingUrl = event.streamingUrl;
              console.log(`[TinyFish] Stream: ${streamingUrl}`);
              break;
            case "PROGRESS": {
              const msg = event.purpose ?? event.status;
              if (msg) {
                statusMessages.push(msg);
                console.log(`[TinyFish] [${progressCount + 1}/${opts.maxSteps}] ${msg}`);
              }
              progressCount++;

              // Step limit check
              if (progressCount > opts.maxSteps) {
                console.warn(
                  `[TinyFish] Step limit exceeded (${opts.maxSteps}). Aborting.`
                );
                opts.abortController.abort();
                return {
                  success: false,
                  statusMessages,
                  streamingUrl,
                  error: `Automation exceeded step limit of ${opts.maxSteps}`,
                  abortReason: "step_limit",
                };
              }

              // Loop detection: track last N messages
              if (msg) {
                recentMessages.push(msg);
                if (recentMessages.length > 5) recentMessages.shift();

                if (recentMessages.length >= opts.loopThreshold) {
                  const tail = recentMessages.slice(-opts.loopThreshold);
                  if (tail.every((m) => m === tail[0])) {
                    console.warn(
                      `[TinyFish] Loop detected: "${tail[0]}" repeated ${opts.loopThreshold} times. Aborting.`
                    );
                    opts.abortController.abort();
                    return {
                      success: false,
                      statusMessages,
                      streamingUrl,
                      error: `Automation stuck in loop: "${tail[0]}"`,
                      abortReason: "loop_detected",
                    };
                  }
                }
              }
              break;
            }
            case "STARTED":
              console.log("[TinyFish] Automation started");
              break;
            case "HEARTBEAT":
              // Keepalive — no action needed
              break;
            case "COMPLETE":
              console.log(
                `[TinyFish] ${event.status === "COMPLETED" ? "Done" : "Failed"} (${progressCount} steps)`,
                event.status === "FAILED" ? event.error : ""
              );
              return {
                success: event.status === "COMPLETED",
                data: event.resultJson,
                statusMessages,
                streamingUrl,
                error:
                  event.status === "FAILED"
                    ? event.error ?? "Automation failed"
                    : undefined,
              };
          }
        } catch {
          // Skip malformed JSON lines
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  // If we exit without a COMPLETE event
  return {
    success: false,
    statusMessages,
    streamingUrl,
    error: "SSE stream ended without a completion event",
  };
}
