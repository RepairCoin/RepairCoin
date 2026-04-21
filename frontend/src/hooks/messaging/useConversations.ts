import { useCallback, useEffect, useRef, useState } from "react";
import * as messagingApi from "@/services/api/messaging";
import { useAuthStore } from "@/stores/authStore";
import type { Conversation } from "@/components/messaging/MessageInbox";

type UserType = "customer" | "shop";

function transformConversation(
  conv: messagingApi.Conversation,
  userType: UserType,
): Conversation {
  const isCustomer = userType === "customer";
  return {
    id: conv.conversationId,
    serviceId: "",
    serviceName: "",
    shopId: isCustomer ? conv.shopId : undefined,
    shopName: isCustomer ? conv.shopName : undefined,
    customerId: !isCustomer ? conv.customerAddress : undefined,
    customerName: !isCustomer ? conv.customerName : undefined,
    participantName: isCustomer
      ? conv.shopName || "Shop"
      : conv.customerName || "Customer",
    participantAvatar: isCustomer ? conv.shopImageUrl : undefined,
    lastMessage: conv.lastMessagePreview || "",
    lastMessageTime: conv.lastMessageAt || conv.createdAt,
    unreadCount: isCustomer ? conv.unreadCountCustomer : conv.unreadCountShop,
    status:
      conv.isArchivedCustomer || conv.isArchivedShop ? "resolved" : "active",
    hasAttachment: false,
    isOnline: false,
  };
}

function normalizeError(err: unknown): string {
  const e = err as { status?: number; message?: string } | null;
  if (e?.status === 401 || e?.message?.includes("Authentication required")) {
    return "Please log in to view your messages";
  }
  if (e?.message?.includes("Network")) {
    return "Network error. Please check your connection";
  }
  return e?.message || "Failed to load conversations";
}

export interface UseConversationsResult {
  conversations: Conversation[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  updateConversation: (id: string, patch: Partial<Conversation>) => void;
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
}

export function useConversations(userType: UserType): UseConversationsResult {
  const { switchingAccount } = useAuthStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userTypeRef = useRef(userType);
  userTypeRef.current = userType;

  const fetchConversations = useCallback(async (isInitialLoad: boolean) => {
    try {
      if (isInitialLoad) {
        setIsLoading(true);
        setError(null);
      }
      const response = await messagingApi.getConversations({
        page: 1,
        limit: 50,
      });
      const transformed = (response.data || []).map((c) =>
        transformConversation(c, userTypeRef.current),
      );
      setConversations(transformed);
    } catch (err: unknown) {
      console.error("Error fetching conversations:", err);
      if (isInitialLoad) setError(normalizeError(err));
    } finally {
      if (isInitialLoad) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (switchingAccount) return;

    fetchConversations(true);

    const onNewMessage = () => fetchConversations(false);
    window.addEventListener("new-message-received", onNewMessage);
    return () =>
      window.removeEventListener("new-message-received", onNewMessage);
  }, [userType, switchingAccount, fetchConversations]);

  const updateConversation = useCallback(
    (id: string, patch: Partial<Conversation>) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      );
    },
    [],
  );

  const refetch = useCallback(() => {
    fetchConversations(false);
  }, [fetchConversations]);

  return {
    conversations,
    isLoading,
    error,
    refetch,
    updateConversation,
    setConversations,
  };
}
