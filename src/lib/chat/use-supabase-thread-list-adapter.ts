"use client";

import { jsx as _jsx } from "react/jsx-runtime";
import { useCallback, useMemo, useState } from "react";
import { createAssistantStream } from "assistant-stream";
import { RuntimeAdapterProvider } from "@assistant-ui/react";
import type { RemoteThreadListAdapter } from "@assistant-ui/core";
import { getSupabaseBrowserClient } from "@/lib/db/supabase-browser";
import { useSupabaseHistoryAdapter } from "./supabase-history-adapter";
import { ChatPaginationContext } from "./chat-pagination-context";

interface ConversationRow {
  id: string;
  title: string | null;
  archived_at: string | null;
  updated_at: string;
}

interface ConversationSingleRow {
  id: string;
  title: string | null;
  archived_at: string | null;
}

export function useSupabaseThreadListAdapter(): RemoteThreadListAdapter {
  const supabase = getSupabaseBrowserClient();

  const unstable_Provider = useCallback(
    function SupabaseProvider({ children }: { children: React.ReactNode }) {
      const history = useSupabaseHistoryAdapter();
      const adapters = useMemo(() => ({ history }), [history]);

      // Pagination state driven by the history adapter's lazy loading
      const [paginationTick, setPaginationTick] = useState(0);
      const pagination = useMemo(
        () => ({
          loadMore: async () => {
            await history.loadMore();
            setPaginationTick((t) => t + 1);
          },
          get hasMore() {
            return history.hasMore;
          },
          get isLoadingMore() {
            return history.isLoadingMore;
          },
        }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [history, paginationTick],
      );

      return _jsx(
        ChatPaginationContext.Provider,
        {
          value: pagination,
          children: _jsx(RuntimeAdapterProvider, { adapters, children }),
        },
      );
    },
    [],
  );

  return useMemo(
    (): RemoteThreadListAdapter => ({
      async list() {
        const { data: rawData, error } = await supabase
          .from("conversations")
          .select("id, title, archived_at, updated_at")
          .is("deleted_at", null)
          .order("updated_at", { ascending: false });

        if (error) throw error;
        const data = (rawData ?? []) as ConversationRow[];

        return {
          threads: data.map((c) => ({
            remoteId: c.id,
            title: c.title ?? undefined,
            status: c.archived_at ? ("archived" as const) : ("regular" as const),
            externalId: undefined,
          })),
        };
      },

      async initialize(threadId: string) {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) throw new Error("Not authenticated");

        const { data: rawData, error } = await supabase
          .from("conversations")
          .insert({ user_id: user.id })
          .select("id")
          .single();

        if (error) throw error;
        const data = rawData as { id: string };

        return { remoteId: data.id, externalId: undefined };
      },

      async rename(remoteId: string, newTitle: string) {
        const { error } = await supabase
          .from("conversations")
          .update({ title: newTitle })
          .eq("id", remoteId);

        if (error) throw error;
      },

      async archive(remoteId: string) {
        const { error } = await supabase
          .from("conversations")
          .update({ archived_at: new Date().toISOString() })
          .eq("id", remoteId);

        if (error) throw error;
      },

      async unarchive(remoteId: string) {
        const { error } = await supabase
          .from("conversations")
          .update({ archived_at: null })
          .eq("id", remoteId);

        if (error) throw error;
      },

      async delete(remoteId: string) {
        const { error } = await supabase
          .from("conversations")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", remoteId);

        if (error) throw error;
      },

      async generateTitle(remoteId, messages) {
        // Extract first user message text, truncate to ~50 chars
        let text = "";
        for (const msg of messages) {
          if (msg.role === "user") {
            for (const part of msg.content) {
              if (part.type === "text") {
                text = part.text;
                break;
              }
            }
            if (text) break;
          }
        }

        const title = text
          ? text.length <= 50
            ? text
            : text.slice(0, 50).replace(/\s+\S*$/, "") + "…"
          : "New conversation";

        // Save title to DB
        await supabase
          .from("conversations")
          .update({ title })
          .eq("id", remoteId);

        // Return an AssistantStream that emits the title as text
        return createAssistantStream((controller) => {
          controller.appendText(title);
          controller.close();
        });
      },

      async fetch(remoteId: string) {
        const { data: rawData, error } = await supabase
          .from("conversations")
          .select("id, title, archived_at")
          .eq("id", remoteId)
          .single();

        if (error) throw error;
        const data = rawData as ConversationSingleRow;

        return {
          remoteId: data.id,
          title: data.title ?? undefined,
          status: data.archived_at ? ("archived" as const) : ("regular" as const),
          externalId: undefined,
        };
      },

      unstable_Provider,
    }),
    [supabase, unstable_Provider],
  );
}
