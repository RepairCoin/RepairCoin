import { useState, useCallback } from "react";
import { router } from "expo-router";
import { goBack } from "expo-router/build/global-state/routing";
import { messageApi } from "@/services/message.services";
import { useShopProfileQuery } from "../queries";
import { INITIAL_CHAT_MESSAGE } from "../../constants";

/**
 * Hook for shop profile screen (viewing a shop)
 */
export const useShopProfileScreen = (shopId: string) => {
  const { data: shopData, isLoading, error } = useShopProfileQuery(shopId);
  const [activeTab, setActiveTab] = useState("services");
  const [isStartingChat, setIsStartingChat] = useState(false);

  const handleStartChat = useCallback(async () => {
    if (!shopId || isStartingChat) return;

    setIsStartingChat(true);
    try {
      const response = await messageApi.getConversations();
      const existingConversation = response.data?.find(
        (conv) => conv.shopId === shopId
      );

      if (existingConversation) {
        router.push(`/customer/messages/${existingConversation.conversationId}` as any);
      } else {
        const newMessage = await messageApi.sendMessage({
          shopId,
          messageText: INITIAL_CHAT_MESSAGE,
          messageType: "text",
        });
        if (newMessage.data?.conversationId) {
          router.push(`/customer/messages/${newMessage.data.conversationId}` as any);
        }
      }
    } catch (error) {
      console.error("Failed to start chat:", error);
    } finally {
      setIsStartingChat(false);
    }
  }, [shopId, isStartingChat]);

  const handleServicePress = useCallback((serviceId: string) => {
    router.push(`/customer/service/${serviceId}`);
  }, []);

  return {
    shopData,
    isLoading,
    error,
    activeTab,
    setActiveTab,
    isStartingChat,
    handleStartChat,
    handleServicePress,
    goBack,
  };
};
