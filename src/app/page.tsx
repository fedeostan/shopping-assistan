"use client";

import { useEffect, useMemo, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import {
  AssistantRuntimeProvider,
  unstable_useRemoteThreadListRuntime,
  useAuiState,
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
  SidebarTrigger,
} from "@/components/ui/sidebar";
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
      new Proxy(transportRef.current, {
        get(_, prop) {
          const res = (transportRef.current as unknown as Record<string, unknown>)[
            prop as string
          ];
          return typeof res === "function"
            ? (res as Function).bind(transportRef.current)
            : res;
        },
      }),
    [],
  );

  // Each thread gets its own useChat keyed by the thread list item id
  const id = useAuiState((s) => s.threadListItem.id);
  const chat = useChat({ id, transport });
  const runtime = useAISDKRuntime(chat);

  if (transport instanceof AssistantChatTransport) {
    transport.setRuntime(runtime);
  }

  return runtime;
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
              <SidebarTrigger />
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
