"use client";

import { useEffect, useMemo, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import {
  AssistantRuntimeProvider,
  unstable_useRemoteThreadListRuntime,
  useAuiState,
  WebSpeechDictationAdapter,
} from "@assistant-ui/react";
import {
  useAISDKRuntime,
  AssistantChatTransport,
} from "@assistant-ui/react-ai-sdk";
import { Thread } from "@/components/assistant-ui/thread";
import { ChatErrorBoundary } from "@/components/chat/chat-error-boundary";
import {
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThreadListSidebar } from "@/components/assistant-ui/threadlist-sidebar";
import { useSupabaseThreadListAdapter } from "@/lib/chat/use-supabase-thread-list-adapter";

const baseTransport = new AssistantChatTransport({ api: "/api/chat" });

/**
 * Per-thread runtime hook — mirrors useChatRuntime internals but uses
 * our Supabase adapter instead of the cloud adapter.
 */
function useChatThreadRuntime() {
  // Stable proxy so transport identity never changes across renders
  const transportRef = useRef(baseTransport);
  useEffect(() => {
    transportRef.current = baseTransport;
  });
  const transport = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs -- get trap is lazy, not called during render
      new Proxy({} as typeof baseTransport, {
        get(_, prop) {
          const res = (transportRef.current as unknown as Record<string, unknown>)[
            prop as string
          ];
          return typeof res === "function"
            ? (res as (...args: unknown[]) => unknown).bind(transportRef.current)
            : res;
        },
      }),
    [],
  );

  const dictationAdapter = useMemo(
    () =>
      typeof window !== "undefined" && WebSpeechDictationAdapter.isSupported()
        ? new WebSpeechDictationAdapter()
        : undefined,
    [],
  );

  // Each thread gets its own useChat keyed by the thread list item id
  const id = useAuiState((s) => s.threadListItem.id);
  const chat = useChat({ id, transport });
  const runtime = useAISDKRuntime(chat, {
    adapters: {
      ...(dictationAdapter && { dictation: dictationAdapter }),
    },
  });

  // transport is a Proxy so instanceof fails — call setRuntime on the
  // underlying transport directly so it can resolve the conversation remoteId.
  baseTransport.setRuntime(runtime);

  return runtime;
}

function MainSidebarTrigger() {
  const { state, isMobile, toggleSidebar } = useSidebar();
  if (!isMobile && state === "expanded") return null;
  return (
    <Button variant="ghost" size="icon" className="size-7" onClick={toggleSidebar}>
      <PanelLeftOpen className="size-4" />
      <span className="sr-only">Open sidebar</span>
    </Button>
  );
}

export default function Home() {
  const adapter = useSupabaseThreadListAdapter();
  const runtime = unstable_useRemoteThreadListRuntime({
    runtimeHook: useChatThreadRuntime,
    adapter,
  });

  return (
    <ChatErrorBoundary>
      <AssistantRuntimeProvider runtime={runtime}>
        <SidebarProvider>
          <ThreadListSidebar />
          <SidebarInset>
            <header className="flex h-10 shrink-0 items-center px-2">
              <MainSidebarTrigger />
            </header>
            <div className="flex-1 overflow-hidden">
              <Thread />
            </div>
          </SidebarInset>
        </SidebarProvider>
      </AssistantRuntimeProvider>
    </ChatErrorBoundary>
  );
}
