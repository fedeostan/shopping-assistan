/**
 * Module-level store for streaming URLs during deep search.
 * The deep-search tool writes URLs here as TinyFish returns them.
 * The /api/search/live/[searchId] route reads them for the frontend.
 *
 * Works in dev (same Node process) and on Vercel Fluid Compute
 * (shared instances across concurrent requests).
 */

interface SearchState {
  streamingUrls: { retailer: string; url: string }[];
  progress: { retailer: string; message: string }[];
  createdAt: number;
}

const store = new Map<string, SearchState>();

// Cleanup entries older than 10 minutes
const TTL_MS = 10 * 60 * 1000;

function cleanup() {
  const now = Date.now();
  for (const [key, val] of store) {
    if (now - val.createdAt > TTL_MS) store.delete(key);
  }
}

export function initSearch(searchId: string) {
  cleanup();
  store.set(searchId, {
    streamingUrls: [],
    progress: [],
    createdAt: Date.now(),
  });
}

export function addStreamingUrl(
  searchId: string,
  retailer: string,
  url: string,
) {
  const state = store.get(searchId);
  if (state) {
    state.streamingUrls.push({ retailer, url });
  }
}

export function addProgress(
  searchId: string,
  retailer: string,
  message: string,
) {
  const state = store.get(searchId);
  if (state) {
    state.progress.push({ retailer, message });
    // Keep only last 20 progress messages
    if (state.progress.length > 20) {
      state.progress = state.progress.slice(-20);
    }
  }
}

export function getSearchState(searchId: string): SearchState | undefined {
  return store.get(searchId);
}

/**
 * Compute a deterministic searchId from tool args.
 * Both the tool and the UI can derive the same ID.
 * Uses retailer names (not URLs) so both sides match.
 */
export function computeSearchId(
  query: string,
  retailers: string[] | { name: string }[],
): string {
  const names = retailers.map((r) =>
    typeof r === "string" ? r : r.name
  );
  const raw = `${query}|${names.sort().join(",")}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const chr = raw.charCodeAt(i);
    hash = ((hash << 5) - hash + chr) | 0;
  }
  return `ds-${Math.abs(hash).toString(36)}`;
}
