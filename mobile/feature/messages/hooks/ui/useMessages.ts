import { useState, useCallback } from "react";
import { useFocusEffect, router } from "expo-router";
import { messageApi } from "@/feature/messages/services/message.services";
import { useAuthStore } from "@/store/auth.store";
import { Conversation } from "../../types";

export function useMessages() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { userType } = useAuthStore();

  const isCustomer = userType === "customer";

  const fetchConversations = useCallback(async () => {
    try {
      const response = await messageApi.getConversations();
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
      fetchConversations();
    }, [fetchConversations])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchConversations();
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
    handleRefresh,
    navigateToChat,
  };
}
