"use client";

import { createContext, useContext } from "react";

export interface ChatPaginationState {
  loadMore: () => Promise<void>;
  hasMore: boolean;
  isLoadingMore: boolean;
}

export const ChatPaginationContext = createContext<ChatPaginationState>({
  loadMore: async () => {},
  hasMore: false,
  isLoadingMore: false,
});

export function useChatPagination() {
  return useContext(ChatPaginationContext);
}
