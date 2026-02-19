const AGENTQL_API_URL = "https://api.agentql.com/v1/query-data";

interface AgentQLResponse<T> {
  data: T;
  metadata: {
    request_id: string;
    screenshot?: string; // Base64 encoded
  };
}

/**
 * Query data from a URL using AgentQL's REST API.
 * Uses semantic queries to extract structured data from any web page.
 */
export async function queryData<T>(opts: {
  url: string;
  query: string;
  enableScreenshot?: boolean;
}): Promise<{ data: T; requestId: string }> {
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
      url: opts.url,
      query: opts.query,
      params: {
        is_screenshot_enabled: opts.enableScreenshot ?? false,
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
