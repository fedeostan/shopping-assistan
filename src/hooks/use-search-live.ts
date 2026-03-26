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
  const prevCountRef = useRef(0);

  useEffect(() => {
    if (!searchId || !enabled) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/search/live/${searchId}`);
        if (!res.ok) return;
        const data = (await res.json()) as SearchLiveState;

        if (!cancelled && data.streamingUrls.length > prevCountRef.current) {
          prevCountRef.current = data.streamingUrls.length;
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
