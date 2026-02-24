"use client";

import { useState } from "react";
import { useAui } from "@assistant-ui/store";
import type {
  ThreadHistoryAdapter,
  GenericThreadHistoryAdapter,
  MessageFormatAdapter,
  MessageFormatItem,
  MessageFormatRepository,
} from "@assistant-ui/core";
import { getSupabaseBrowserClient } from "@/lib/db/supabase-browser";

const PAGE_SIZE = 50;

interface MessageRow {
  id: string;
  conversation_id: string;
  parent_id: string | null;
  format: string;
  content: Record<string, unknown>;
  created_at: string;
}

/**
 * Supabase-backed ThreadHistoryAdapter.
 *
 * The primary code path is `withFormat()` which the framework calls with
 * the aiSDKV6FormatAdapter. It returns `{ load, append }` backed by Supabase.
 */
class SupabaseThreadHistoryAdapter implements ThreadHistoryAdapter {
  private aui: ReturnType<typeof useAui>;
  private supabase = getSupabaseBrowserClient();

  // Pagination state for lazy loading
  private _cursor: string | null = null;
  private _hasMore = true;
  private _isLoadingMore = false;
  private _loadedMessages: MessageFormatItem<unknown>[] = [];
  private _formatAdapter: MessageFormatAdapter<unknown, Record<string, unknown>> | null =
    null;

  constructor(aui: ReturnType<typeof useAui>) {
    this.aui = aui;
  }

  get hasMore() {
    return this._hasMore;
  }

  get isLoadingMore() {
    return this._isLoadingMore;
  }

  private getRemoteId(): string | undefined {
    return this.aui.threadListItem().getState().remoteId;
  }

  withFormat<TMessage, TStorageFormat extends Record<string, unknown>>(
    formatAdapter: MessageFormatAdapter<TMessage, TStorageFormat>,
  ): GenericThreadHistoryAdapter<TMessage> {
    this._formatAdapter = formatAdapter as MessageFormatAdapter<
      unknown,
      Record<string, unknown>
    >;
    const adapter = this;

    return {
      async load(): Promise<MessageFormatRepository<TMessage>> {
        const remoteId = adapter.getRemoteId();
        if (!remoteId) return { messages: [] };

        // Reset pagination state on fresh load
        adapter._cursor = null;
        adapter._hasMore = true;
        adapter._loadedMessages = [];

        const { data: rawData, error } = await adapter.supabase
          .from("messages")
          .select("id, conversation_id, parent_id, format, content, created_at")
          .eq("conversation_id", remoteId)
          .order("created_at", { ascending: false })
          .limit(PAGE_SIZE);

        if (error) throw error;
        const data = rawData as MessageRow[] | null;

        if (!data || data.length === 0) {
          adapter._hasMore = false;
          return { messages: [] };
        }

        adapter._hasMore = data.length === PAGE_SIZE;
        adapter._cursor = data[data.length - 1].created_at;

        // Reverse to chronological order
        const rows = data.reverse();

        const messages = rows.map((row) =>
          formatAdapter.decode({
            id: row.id,
            parent_id: row.parent_id,
            format: row.format,
            content: row.content as TStorageFormat,
          }),
        );

        adapter._loadedMessages = messages as MessageFormatItem<unknown>[];

        return { messages };
      },

      async append(item: MessageFormatItem<TMessage>): Promise<void> {
        const { remoteId } = await adapter.aui.threadListItem().initialize();
        const encoded = formatAdapter.encode(item);
        const messageId = formatAdapter.getId(item.message);

        const { error } = await adapter.supabase.from("messages").upsert(
          {
            id: messageId,
            conversation_id: remoteId,
            parent_id: item.parentId,
            format: formatAdapter.format,
            content: encoded as unknown as Record<string, unknown>,
          },
          { onConflict: "conversation_id,id" },
        );

        if (error) throw error;

        // Auto-set title from first user message
        const content = encoded as Record<string, unknown>;
        if (content.role === "user") {
          await adapter.maybeSetTitle(remoteId, content);
        }
      },
    };
  }

  // Fallback load/append (non-withFormat path, rarely used)
  async load() {
    return { messages: [] };
  }

  async append() {
    // no-op for direct path — withFormat is the primary code path
  }

  /**
   * Load older messages for lazy loading / scroll-up pagination.
   * Returns the newly loaded messages (prepended to the existing set).
   */
  async loadMore<TMessage>(): Promise<MessageFormatItem<TMessage>[]> {
    if (!this._hasMore || this._isLoadingMore || !this._formatAdapter) return [];

    const remoteId = this.getRemoteId();
    if (!remoteId) return [];

    this._isLoadingMore = true;

    try {
      let query = this.supabase
        .from("messages")
        .select("id, conversation_id, parent_id, format, content, created_at")
        .eq("conversation_id", remoteId)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (this._cursor) {
        query = query.lt("created_at", this._cursor);
      }

      const { data: rawData, error } = await query;
      const data = rawData as MessageRow[] | null;
      if (error) throw error;

      if (!data || data.length === 0) {
        this._hasMore = false;
        return [];
      }

      this._hasMore = data.length === PAGE_SIZE;
      this._cursor = data[data.length - 1].created_at;

      // Reverse to chronological order
      const rows = data.reverse();

      const formatAdapter = this._formatAdapter as MessageFormatAdapter<
        TMessage,
        Record<string, unknown>
      >;

      const newMessages = rows.map((row: MessageRow) =>
        formatAdapter.decode({
          id: row.id,
          parent_id: row.parent_id,
          format: row.format,
          content: row.content as Record<string, unknown>,
        }),
      );

      // Prepend to existing loaded messages
      this._loadedMessages = [
        ...(newMessages as MessageFormatItem<unknown>[]),
        ...this._loadedMessages,
      ];

      return newMessages;
    } finally {
      this._isLoadingMore = false;
    }
  }

  private async maybeSetTitle(
    conversationId: string,
    content: Record<string, unknown>,
  ) {
    // Check if conversation already has a title
    const { data: conv } = await this.supabase
      .from("conversations")
      .select("title")
      .eq("id", conversationId)
      .single();

    if (conv?.title) return;

    // Extract text from user message
    let text = "";
    if (typeof content.content === "string") {
      text = content.content;
    } else if (Array.isArray(content.parts)) {
      const textPart = (content.parts as Array<{ type: string; text?: string }>).find(
        (p) => p.type === "text",
      );
      text = textPart?.text ?? "";
    }

    if (!text) return;

    // Truncate to ~50 chars at word boundary
    const title =
      text.length <= 50 ? text : text.slice(0, 50).replace(/\s+\S*$/, "") + "…";

    await this.supabase
      .from("conversations")
      .update({ title })
      .eq("id", conversationId);
  }
}

export function useSupabaseHistoryAdapter() {
  const aui = useAui();
  const [adapter] = useState(() => new SupabaseThreadHistoryAdapter(aui));
  return adapter;
}

export type { SupabaseThreadHistoryAdapter };
