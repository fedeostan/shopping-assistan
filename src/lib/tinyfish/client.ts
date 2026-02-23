const TINYFISH_API_URL = "https://agent.tinyfish.ai/v1/automation/run-sse";

export interface TinyFishRequest {
  /** The URL to navigate to */
  url: string;
  /** Natural language description of what the agent should do */
  goal: string;
  /** Browser profile: "lite" for normal sites, "stealth" for anti-bot protection */
  browser_profile?: "lite" | "stealth";
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
}

/**
 * Execute a browser automation task via TinyFish Web Agent.
 * Consumes the SSE stream and returns the final result.
 */
export async function runAutomation(
  request: TinyFishRequest
): Promise<TinyFishResult> {
  const apiKey = process.env.TINYFISH_API_KEY;
  if (!apiKey) {
    throw new Error("TINYFISH_API_KEY is not set in environment variables");
  }

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
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `TinyFish API error: ${response.status} ${response.statusText} — ${errorText}`
    );
  }

  if (!response.body) {
    throw new Error("TinyFish API returned no response body");
  }

  return consumeSSEStream(response.body);
}

/**
 * Parse the SSE stream from TinyFish Web Agent.
 * Collects status messages and returns the final COMPLETE event.
 */
async function consumeSSEStream(
  body: ReadableStream<Uint8Array>
): Promise<TinyFishResult> {
  const reader = body.getReader();
  const decoder = new TextDecoder();

  const statusMessages: string[] = [];
  let streamingUrl: string | undefined;
  let buffer = "";

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
              break;
            case "PROGRESS":
              if (event.purpose) {
                statusMessages.push(event.purpose);
              } else if (event.status) {
                statusMessages.push(event.status);
              }
              break;
            case "STARTED":
            case "HEARTBEAT":
              // Ignore — session lifecycle / keepalive events
              break;
            case "COMPLETE":
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
