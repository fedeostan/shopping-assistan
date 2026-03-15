import { HttpError } from "@/lib/utils/http-error";

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
  /** Request timeout in milliseconds. Default 15000. */
  timeout?: number;
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

  const timeoutMs = opts.timeout ?? 15_000;
  console.log(`[AgentQL] queryData START url=${opts.url} mode=${opts.mode ?? "fast"} profile=${opts.browserProfile ?? "light"} timeout=${timeoutMs}ms`);
  const t0 = Date.now();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

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
      console.error(`[AgentQL] queryData FAILED url=${opts.url} status=${response.status} elapsed=${Date.now() - t0}ms body=${errorText.slice(0, 200)}`);
      throw new HttpError(
        `AgentQL API error: ${response.status} ${response.statusText} — ${errorText}`,
        response.status
      );
    }

    const result: AgentQLResponse<T> = await response.json();
    console.log(`[AgentQL] queryData OK url=${opts.url} requestId=${result.metadata.request_id} elapsed=${Date.now() - t0}ms dataKeys=${Object.keys(result.data as object)}`);

    return {
      data: result.data,
      requestId: result.metadata.request_id,
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      console.error(`[AgentQL] queryData TIMEOUT url=${opts.url} after ${timeoutMs}ms`);
    }
    throw err;
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

  console.log(`[AgentQL] queryHtml START htmlLen=${opts.html.length}`);
  const t0 = Date.now();

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
    console.error(`[AgentQL] queryHtml FAILED status=${response.status} elapsed=${Date.now() - t0}ms`);
    throw new HttpError(
      `AgentQL API error: ${response.status} ${response.statusText} — ${errorText}`,
      response.status
    );
  }

  const result: AgentQLResponse<T> = await response.json();
  console.log(`[AgentQL] queryHtml OK elapsed=${Date.now() - t0}ms`);
  return result.data;
}
