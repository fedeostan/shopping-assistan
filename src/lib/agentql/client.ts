const AGENTQL_API_URL = "https://api.agentql.com/v1/query-data";

interface AgentQLResponse<T> {
  data: T;
  metadata: {
    request_id: string;
    screenshot?: string; // Base64 encoded
  };
}

interface QueryDataOptions {
  url: string;
  query: string;
  /** Seconds to wait for JS-heavy pages to render. Default 0. */
  waitFor?: number;
  /** Use "stealth" for anti-bot protected sites (Amazon, MercadoLibre). Default "light". */
  browserProfile?: "light" | "stealth";
  /** Scroll to bottom to load lazy-loaded products. Default false. */
  scrollToBottom?: boolean;
  /** Enable screenshot capture for debugging. Default false. */
  enableScreenshot?: boolean;
  /** Analysis mode: "standard" for deep analysis, "fast" for speed. Default "fast". */
  mode?: "standard" | "fast";
}

/**
 * Query data from a URL using AgentQL's REST API.
 * Uses semantic queries to extract structured data from any web page.
 */
export async function queryData<T>(
  opts: QueryDataOptions
): Promise<{ data: T; requestId: string }> {
  const apiKey = process.env.AGENTQL_API_KEY;
  if (!apiKey) {
    throw new Error("AGENTQL_API_KEY is not set in environment variables");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(AGENTQL_API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: opts.url,
        query: opts.query,
        params: {
          wait_for: opts.waitFor ?? 0,
          browser_profile: opts.browserProfile ?? "light",
          is_scroll_to_bottom_enabled: opts.scrollToBottom ?? false,
          is_screenshot_enabled: opts.enableScreenshot ?? false,
          mode: opts.mode ?? "fast",
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `AgentQL API error: ${response.status} ${response.statusText} — ${errorText}`
      );
    }

    const result: AgentQLResponse<T> = await response.json();

    return {
      data: result.data,
      requestId: result.metadata.request_id,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Query data from raw HTML using AgentQL's REST API.
 * Useful when you already have the HTML content.
 */
export async function queryHtml<T>(opts: {
  html: string;
  query: string;
}): Promise<T> {
  const apiKey = process.env.AGENTQL_API_KEY;
  if (!apiKey) {
    throw new Error("AGENTQL_API_KEY is not set in environment variables");
  }

  const response = await fetch(AGENTQL_API_URL, {
    method: "POST",
    headers: {
      "X-API-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      html: opts.html,
      query: opts.query,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `AgentQL API error: ${response.status} ${response.statusText} — ${errorText}`
    );
  }

  const result: AgentQLResponse<T> = await response.json();
  return result.data;
}
