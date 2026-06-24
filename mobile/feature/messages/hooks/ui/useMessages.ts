import { useState, useCallback, useEffect, useRef } from "react";
import { useFocusEffect, router } from "expo-router";
import { messageApi } from "@/feature/messages/services/message.services";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { realtimeEvents } from "@/shared/utilities/realtimeEvents";
import { dismissConversationNotifications } from "@/feature/notification/utils/dismissConversationNotifications";
import { Conversation } from "../../types";

export type MessageFilter = "active" | "resolved" | "archived";

export function useMessages() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<MessageFilter>("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const { userType } = useAuthStore();

  const isCustomer = userType === "customer";

  // Latest filter/search kept in refs so the focus effect can read current
  // values without re-subscribing (which would refetch on every keystroke).
  const filterRef = useRef(filter);
  const searchRef = useRef(debouncedSearch);
  useEffect(() => {
    filterRef.current = filter;
  }, [filter]);
  useEffect(() => {
    searchRef.current = debouncedSearch;
  }, [debouncedSearch]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchConversations = useCallback(async (currentFilter: MessageFilter, search?: string) => {
    try {
      const archived = currentFilter === "archived";
      const status = currentFilter === "resolved" ? "resolved" : currentFilter === "active" ? "open" : undefined;
      const response = await messageApi.getConversations(1, 20, archived, status, search || undefined);
      setConversations(response.data || []);
    } catch (error) {
      setConversations([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Refetch whenever the screen gains focus — initial open AND returning from a
  // chat — so unread badges reflect messages read while away. (The previous
  // first-mount-only guard left stale unread counts after reading a thread.)
  useFocusEffect(
    useCallback(() => {
      fetchConversations(filterRef.current, searchRef.current);
    }, [fetchConversations])
  );

  // Fetch when filter or search changes. Skipped on first render — the focus
  // effect above already does the initial load.
  const skipInitialFilterFetch = useRef(true);
  useEffect(() => {
    if (skipInitialFilterFetch.current) {
      skipInitialFilterFetch.current = false;
      return;
    }
    setIsLoading(true);
    fetchConversations(filter, debouncedSearch);
  }, [filter, debouncedSearch, fetchConversations]);

  // Realtime: a new message arrived over the shared socket (RealtimeProvider
  // re-broadcasts `message:new`). Silently refetch the current view so the list
  // reorders (newest activity first) and unread counts update live — no spinner.
  // Mirrors the web inbox refreshing on `new-message-received`.
  useEffect(() => {
    return realtimeEvents.on("message:new", () => {
      fetchConversations(filter, debouncedSearch);
    });
  }, [filter, debouncedSearch, fetchConversations]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchConversations(filter, debouncedSearch);
  };

  const handleFilterChange = (newFilter: MessageFilter) => {
    if (newFilter !== filter) {
      setFilter(newFilter);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
  };

  const navigateToChat = (conversationId: string) => {
    // Optimistically clear this conversation's unread badge so it resets
    // immediately on tap; the focus refetch on return reconciles real counts.
    setConversations((prev) =>
      prev.map((c) =>
        c.conversationId === conversationId
          ? { ...c, unreadCountCustomer: 0, unreadCountShop: 0 }
          : c
      )
    );
    // Clear any delivered OS notifications for this sender's messages.
    dismissConversationNotifications(conversationId);

    const basePath = isCustomer ? "/customer/messages" : "/shop/messages";
    router.push(`${basePath}/${conversationId}` as any);
  };

  return {
    conversations,
    isLoading,
    isRefreshing,
    isCustomer,
    filter,
    searchQuery,
    setSearchQuery,
    clearSearch,
    handleRefresh,
    handleFilterChange,
    navigateToChat,
  };
}
