import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.client";
import type { ConversationSummary } from "../lib/api.types";

// Sidebar shows the most recent conversations; older ones load on demand.
export const SIDEBAR_PAGE_SIZE = 50;

/** Sidebar conversation list with refresh, delete and "load more". */
export function useConversations() {
  const [items, setItems] = useState<ConversationSummary[]>([]);
  const [hasMore, setHasMore] = useState(false);

  const refresh = useCallback(async () => {
    const page = await api<{ items: ConversationSummary[] }>(`/conversations?limit=${SIDEBAR_PAGE_SIZE}`);
    setItems(page.items);
    setHasMore(page.items.length === SIDEBAR_PAGE_SIZE);
  }, []);

  const loadMore = useCallback(async () => {
    const page = await api<{ items: ConversationSummary[] }>(
      `/conversations?limit=${SIDEBAR_PAGE_SIZE}&offset=${items.length}`);
    setItems((prev) => [...prev, ...page.items]);
    setHasMore(page.items.length === SIDEBAR_PAGE_SIZE);
  }, [items.length]);

  const remove = useCallback(async (id: string) => {
    await api(`/conversations/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((c) => c.id !== id));
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  return { items, hasMore, refresh, loadMore, remove };
}

export type ConversationsApi = ReturnType<typeof useConversations>;
