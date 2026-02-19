"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
  useChatRuntime,
  AssistantChatTransport,
} from "@assistant-ui/react-ai-sdk";
import { Thread } from "@/components/assistant-ui/thread";
import { ChatErrorBoundary } from "@/components/chat/chat-error-boundary";

const transport = new AssistantChatTransport({
  api: "/api/chat",
});

export default function Home() {
  const runtime = useChatRuntime({ transport });

  return (
    <ChatErrorBoundary>
      <AssistantRuntimeProvider runtime={runtime}>
        <div className="h-dvh">
          <Thread />
        </div>
      </AssistantRuntimeProvider>
    </ChatErrorBoundary>
  );
}
