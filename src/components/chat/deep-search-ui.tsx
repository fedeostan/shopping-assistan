"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import {
  SearchIcon,
  PackageIcon,
  MonitorPlayIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ZapIcon,
  LoaderIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductCardV2 } from "@/components/products/product-card-v2";
import { useSearchLive } from "@/hooks/use-search-live";
import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { useThreadRuntime } from "@assistant-ui/react";
import type { DeepSearchArgs, DeepSearchResult } from "./tool-ui-types";

function computeSearchId(
  query: string,
  retailers: string[],
): string {
  const raw = `${query}|${[...retailers].sort().join(",")}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const chr = raw.charCodeAt(i);
    hash = ((hash << 5) - hash + chr) | 0;
  }
  return `ds-${Math.abs(hash).toString(36)}`;
}

const INITIAL_SHOW = 6;

export const DeepSearchUI: ToolCallMessagePartComponent<
  DeepSearchArgs,
  DeepSearchResult
> = ({ args, result, status }) => {
  const [showAll, setShowAll] = useState(false);
  const [showReplays, setShowReplays] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState<Record<number, boolean>>({});
  const [liveIframeLoaded, setLiveIframeLoaded] = useState<Record<number, boolean>>({});
  const threadRuntime = useThreadRuntime();
  const pendingRef = useRef(false);

  // Compute searchId from args so we can poll for live streaming URLs
  const searchId = useMemo(
    () => args.retailers?.length ? computeSearchId(args.query, args.retailers) : null,
    [args.query, args.retailers],
  );
  const isRunning = status.type === "running";
  const liveState = useSearchLive(searchId, isRunning);

  // Elapsed time counter for running state
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!isRunning) return;
    setElapsed(0);
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [isRunning]);

  const safeAppend = useCallback(
    (message: Parameters<typeof threadRuntime.append>[0]) => {
      if (pendingRef.current) return;
      pendingRef.current = true;
      threadRuntime.append(message);
      setTimeout(() => {
        pendingRef.current = false;
      }, 2000);
    },
    [threadRuntime],
  );

  const handleDoItFast = () => {
    safeAppend({
      role: "user",
      content: [
        {
          type: "text",
          text: `Do it fast! Quick search for: ${args.query}`,
        },
      ],
    });
  };

  // ---------- Running State ----------
  if (status.type === "running") {
    const retailerCount = args.retailers?.length ?? 0;
    // Map retailer name → live streaming URL (from polling)
    const liveUrlMap = new Map(
      liveState.streamingUrls.map((s) => [s.retailer, s.url]),
    );
    const liveCount = liveUrlMap.size;
    const hasAnyLive = liveCount > 0;

    return (
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <div className="flex size-6 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
            <SearchIcon className="size-3.5 animate-pulse text-purple-600 dark:text-purple-400" />
          </div>
          <div className="flex flex-col">
            <span>
              {hasAnyLive
                ? `Watching ${liveCount}/${retailerCount} agents browse live`
                : `Launching ${retailerCount} shopping agent${retailerCount !== 1 ? "s" : ""}...`}
            </span>
            {!hasAnyLive && (
              <span className="text-xs text-muted-foreground font-normal">
                Initializing browser sessions — usually takes 15-30s
              </span>
            )}
          </div>
        </div>

        {/* Retailer browser windows */}
        {args.retailers && args.retailers.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {args.retailers.map((retailerName, i) => {
              const liveUrl = liveUrlMap.get(retailerName);
              const retailerDomain = `https://www.${retailerName.toLowerCase().replace(/\s+/g, "")}.com`;

              return (
                <div
                  key={retailerName ?? i}
                  className="animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both overflow-hidden rounded-xl border bg-card shadow-sm"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  {/* Browser chrome bar */}
                  <div className="flex items-center gap-2 border-b bg-muted/50 px-3 py-2">
                    <div className="flex gap-1">
                      <span className="size-2 rounded-full bg-red-400/60" />
                      <span className="size-2 rounded-full bg-yellow-400/60" />
                      <span className="size-2 rounded-full bg-green-400/60" />
                    </div>
                    <div className="flex-1 rounded-md bg-muted px-2 py-0.5 text-[10px] text-muted-foreground font-mono truncate">
                      {retailerDomain}
                    </div>
                  </div>

                  {/* Browser content — live iframe OR animated placeholder */}
                  {liveUrl ? (
                    <div className="relative bg-black">
                      {!liveIframeLoaded[i] && (
                        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                          <LoaderIcon className="size-5 animate-spin text-purple-400" />
                        </div>
                      )}
                      <iframe
                        src={liveUrl}
                        title={`Live browser – ${retailerName}`}
                        className="aspect-video w-full"
                        allow="autoplay"
                        sandbox="allow-scripts allow-same-origin"
                        onLoad={() =>
                          setLiveIframeLoaded((prev) => ({ ...prev, [i]: true }))
                        }
                      />
                    </div>
                  ) : (
                    <div className="relative aspect-video overflow-hidden bg-zinc-950">
                      <div
                        className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-purple-500/60 to-transparent"
                        style={{
                          animation: `scanLine 2s ease-in-out infinite`,
                          animationDelay: `${i * 400}ms`,
                        }}
                      />
                      <div className="flex h-full flex-col gap-2 p-3 opacity-20">
                        <div className="h-3 w-24 rounded bg-white/30" />
                        <div className="h-2 w-full rounded bg-white/15" />
                        <div className="mt-1 grid grid-cols-3 gap-2 flex-1">
                          {Array.from({ length: 6 }).map((_, j) => (
                            <div
                              key={j}
                              className="rounded bg-white/10 animate-pulse"
                              style={{ animationDelay: `${j * 200}ms` }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Status bar */}
                  <div className="flex items-center gap-2 border-t bg-muted/30 px-3 py-1.5">
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-75" />
                      <span className="relative inline-flex size-2 rounded-full bg-purple-500" />
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {liveUrl ? (
                        <>Watching <span className="font-medium text-foreground">{retailerName}</span> live</>
                      ) : (
                        <>Connecting to <span className="font-medium text-foreground">{retailerName}</span>...</>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer: elapsed timer + fast mode */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground tabular-nums">
            {Math.floor(elapsed / 60)}:{(elapsed % 60).toString().padStart(2, "0")} elapsed
          </span>
          {elapsed >= 30 ? (
            <Button
              variant="default"
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleDoItFast}
            >
              <ZapIcon className="size-3.5 mr-1.5" />
              Switch to fast search
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground border border-dashed hover:border-solid"
              onClick={handleDoItFast}
            >
              <ZapIcon className="size-3.5 mr-1.5" />
              Do it fast!
            </Button>
          )}
        </div>

        {/* Scanning line keyframe */}
        <style>{`
          @keyframes scanLine {
            0%, 100% { top: 0%; }
            50% { top: 100%; }
          }
        `}</style>
      </div>
    );
  }

  // ---------- No result ----------
  if (!result) return null;

  // ---------- Empty / Error State ----------
  if (result.resultCount === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border bg-card p-6 text-center">
        <PackageIcon className="size-8 text-muted-foreground" />
        <p className="font-medium text-foreground">No products found</p>
        {result.errors && result.errors.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {result.errors.map((e) => `${e.retailer}: ${e.error}`).join(", ")}
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          Try the fast search for quicker results
        </p>
      </div>
    );
  }

  // ---------- Complete State ----------
  const products = result.products ?? [];
  const visible = showAll ? products : products.slice(0, INITIAL_SHOW);
  const hasMore = products.length > INITIAL_SHOW;
  const streamingUrls = result.streamingUrls ?? [];
  const retailerCount = result.retailers?.length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Result header */}
      <p className="text-sm text-muted-foreground">
        Found {result.resultCount} product{result.resultCount !== 1 ? "s" : ""}{" "}
        across {retailerCount} retailer{retailerCount !== 1 ? "s" : ""}
      </p>

      {/* Browser replay section */}
      {streamingUrls.length > 0 && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowReplays(!showReplays)}
            className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <MonitorPlayIcon className="size-3.5" />
            Watch the agents shop ({streamingUrls.length})
            {showReplays ? (
              <ChevronUpIcon className="ml-auto size-3.5" />
            ) : (
              <ChevronDownIcon className="ml-auto size-3.5" />
            )}
          </button>

          {showReplays && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {streamingUrls.map((entry, i) => (
                <div
                  key={entry.url ?? i}
                  className="overflow-hidden rounded-lg border"
                >
                  {/* Label bar */}
                  <div className="bg-muted/50 px-2 py-1 text-xs font-medium">
                    {entry.retailer}
                  </div>
                  {/* Iframe with loading spinner */}
                  <div className="relative bg-black">
                    {!iframeLoaded[i] && (
                      <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                        <LoaderIcon className="size-5 animate-spin text-purple-400" />
                      </div>
                    )}
                    <iframe
                      src={entry.url}
                      title={`Browser replay – ${entry.retailer}`}
                      className="aspect-video w-full"
                      allow="autoplay"
                      sandbox="allow-scripts allow-same-origin"
                      onLoad={() =>
                        setIframeLoaded((prev) => ({ ...prev, [i]: true }))
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Product grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((product, i) => (
          <ProductCardV2 key={product.id ?? i} product={product} index={i} />
        ))}
      </div>

      {/* Show all button */}
      {hasMore && !showAll && (
        <Button
          variant="ghost"
          size="sm"
          className="self-center"
          onClick={() => setShowAll(true)}
        >
          Show all {products.length} results
        </Button>
      )}

      {/* Errors section */}
      {result.errors && result.errors.length > 0 && (
        <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {result.errors.map((e, i) => (
            <p key={i}>
              {e.retailer}: {e.error}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};
