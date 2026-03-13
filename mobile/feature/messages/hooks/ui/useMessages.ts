import { useState, useCallback, useEffect, useRef } from "react";
import { useFocusEffect, router } from "expo-router";
import { messageApi } from "@/feature/messages/services/message.services";
import { useAuthStore } from "@/shared/store/auth.store";
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
  const isFirstMount = useRef(true);

  const isCustomer = userType === "customer";

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

  // Fetch on focus (initial load)
  useFocusEffect(
    useCallback(() => {
      if (isFirstMount.current) {
        isFirstMount.current = false;
        fetchConversations(filter, debouncedSearch);
      }
    }, [fetchConversations, filter, debouncedSearch])
  );

  // Fetch when filter or search changes
  useEffect(() => {
    if (!isFirstMount.current) {
      setIsLoading(true);
      fetchConversations(filter, debouncedSearch);
    }
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
