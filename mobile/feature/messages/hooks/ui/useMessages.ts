import { useState, useCallback } from "react";
import { useFocusEffect, router } from "expo-router";
import { messageApi } from "@/feature/messages/services/message.services";
import { useAuthStore } from "@/shared/store/auth.store";
import { Conversation } from "../../types";

export type MessageFilter = "active" | "archived";

export function useMessages() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<MessageFilter>("active");
  const { userType } = useAuthStore();

  const isCustomer = userType === "customer";

  const fetchConversations = useCallback(async (archived: boolean = false) => {
    try {
      const response = await messageApi.getConversations(1, 20, archived);
      setConversations(response.data || []);
    } catch (error) {
      setConversations([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchConversations(filter === "archived");
    }, [fetchConversations, filter])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchConversations(filter === "archived");
  };

  const handleFilterChange = (newFilter: MessageFilter) => {
    if (newFilter !== filter) {
      setFilter(newFilter);
      setIsLoading(true);
      fetchConversations(newFilter === "archived");
    }
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
    handleRefresh,
    handleFilterChange,
    navigateToChat,
  };
}
