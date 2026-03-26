"use client";

import { useState, useEffect, useRef } from "react";

interface SearchLiveState {
  streamingUrls: { retailer: string; url: string }[];
  progress: { retailer: string; message: string }[];
}

/**
 * Poll /api/search/live/[searchId] for streaming URLs during deep search.
 * Returns live TinyFish browser preview URLs as they become available.
 */
export function useSearchLive(searchId: string | null, enabled: boolean) {
  const [state, setState] = useState<SearchLiveState>({
    streamingUrls: [],
    progress: [],
  });
  const prevHashRef = useRef("");

  useEffect(() => {
    if (!searchId || !enabled) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/search/live/${searchId}`);
        if (!res.ok) return;
        const data = (await res.json()) as SearchLiveState;

        // Update whenever streaming URLs OR progress messages change
        const hash = `${data.streamingUrls.length}:${data.progress.length}`;
        if (!cancelled && hash !== prevHashRef.current) {
          prevHashRef.current = hash;
          setState(data);
        }
      } catch {
        // Silently ignore poll errors
      }
    };

    // Poll every 2 seconds
    poll();
    const interval = setInterval(poll, 2000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [searchId, enabled]);

  return state;
}
