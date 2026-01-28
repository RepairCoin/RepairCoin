import { useState, useCallback, useRef, useEffect } from "react";
import { FlatList } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useFocusEffect } from "expo-router";
import { messageApi } from "@/feature/messages/services/message.services";
import { useAuthStore } from "@/shared/store/auth.store";
import { Message, Conversation } from "../../types";
import { MESSAGE_POLL_INTERVAL } from "../../constants";

export function useChat() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [messageText, setMessageText] = useState("");
  const flatListRef = useRef<FlatList>(null);
  const { userType } = useAuthStore();

  const isCustomer = userType === "customer";

  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;

    try {
      const response = await messageApi.getMessages(conversationId);
      setMessages(response.data || []);
      await messageApi.markConversationAsRead(conversationId);
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  const fetchConversation = useCallback(async () => {
    if (!conversationId) return;

    try {
      const response = await messageApi.getConversations();
      const conv = response.data?.find((c) => c.conversationId === conversationId);
      if (conv) {
        setConversation(conv);
      }
    } catch (error) {
      console.error("Failed to fetch conversation:", error);
    }
  }, [conversationId]);

  useFocusEffect(
    useCallback(() => {
      fetchConversation();
      fetchMessages();
    }, [fetchConversation, fetchMessages])
  );

  // Poll for new messages
  useEffect(() => {
    if (!conversationId) return;

    const interval = setInterval(() => {
      fetchMessages();
    }, MESSAGE_POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [conversationId, fetchMessages]);

  const handleSend = async () => {
    if (!messageText.trim() || !conversationId || isSending) return;

    const text = messageText.trim();
    setMessageText("");
    setIsSending(true);

    try {
      const response = await messageApi.sendMessage({
        conversationId,
        messageText: text,
        messageType: "text",
      });

      if (response.data) {
        setMessages((prev) => [...prev, response.data]);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      setMessageText(text);
    } finally {
      setIsSending(false);
    }
  };

  const handleGoBack = () => {
    router.back();
  };

  const scrollToEnd = () => {
    flatListRef.current?.scrollToEnd({ animated: false });
  };

  const otherPartyName = isCustomer ? conversation?.shopName : conversation?.customerName;

  return {
    messages,
    conversation,
    isLoading,
    isSending,
    messageText,
    setMessageText,
    flatListRef,
    isCustomer,
    otherPartyName,
    handleSend,
    handleGoBack,
    scrollToEnd,
  };
}
