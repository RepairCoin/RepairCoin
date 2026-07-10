import { useState, useCallback, useRef, useEffect } from "react";
import { FlatList } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useFocusEffect } from "expo-router";
import { messageApi } from "@/feature/messages/services/message.services";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { realtimeEvents } from "@/shared/utilities/realtimeEvents";
import { dismissConversationNotifications } from "@/feature/notification/utils/dismissConversationNotifications";
import { useNotificationUiStore } from "@/shared/store/notification-ui.store";
import { Message, Conversation, MessageAttachment } from "../../types";
import { MESSAGE_POLL_INTERVAL } from "@/shared/constants/messaging";
import { AttachmentFile } from "../../components/MessageInput";
import { encryptMessage } from "@/shared/utilities/encryption";

// Messages render in an INVERTED FlatList (newest at the bottom), so we keep
// them in descending order — index 0 = newest. The inverted list shows the
// bottom by default, so there's no manual scroll-to-end. A thread can be
// hundreds of messages, so we page: newest page on open, older pages when the
// user scrolls up (onEndReached fires at the top of an inverted list).
const MESSAGES_PER_PAGE = 30;

export function useChat() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [messageText, setMessageText] = useState("");
  const flatListRef = useRef<FlatList>(null);
  const { userType } = useAuthStore();
  const setActiveConversationId = useNotificationUiStore(
    (state) => state.setActiveConversationId
  );

  const isCustomer = userType === "customer";

  const hasMarkedRead = useRef(false);
  // Highest (oldest) page loaded so far — load-more fetches pageRef + 1.
  const pageRef = useRef(1);
  // Guards against overlapping load-more requests (onEndReached fires rapidly).
  const loadingMoreRef = useRef(false);
  // Mirror of `messages` for computing new arrivals without stale closures.
  const messagesRef = useRef<Message[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Fetch a page newest-first (descending) — the order the inverted list wants.
  const fetchPage = useCallback(
    async (page: number) => {
      const response = await messageApi.getMessages(
        conversationId,
        page,
        MESSAGES_PER_PAGE,
        "desc"
      );
      return {
        desc: response.data || [],
        hasMore: response.pagination?.hasMore ?? false,
      };
    },
    [conversationId]
  );

  // Initial load (open / focus): newest page, mark read. The inverted list
  // already sits at the bottom (newest), so no scrolling is required.
  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;

    try {
      const { desc, hasMore: more } = await fetchPage(1);
      pageRef.current = 1;
      setMessages(desc);
      setHasMore(more);

      if (!hasMarkedRead.current) {
        hasMarkedRead.current = true;
        await messageApi.markConversationAsRead(conversationId);
        // Tray notifications are swept by the effect below once the sender name
        // is known (foreign FCM notifications carry no conversationId — only the
        // title — so we can't match them here yet).
      }
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, fetchPage]);

  // Load-more: fetch the next older page and append it to the end (the oldest
  // edge / top of the inverted list). Adding below the viewport doesn't shift
  // what the user is reading.
  const loadMore = useCallback(async () => {
    if (!conversationId || loadingMoreRef.current || !hasMore) return;

    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    try {
      const nextPage = pageRef.current + 1;
      const { desc, hasMore: more } = await fetchPage(nextPage);
      if (desc.length > 0) {
        setMessages((prev) => {
          const ids = new Set(prev.map((m) => m.messageId));
          const older = desc.filter((m) => !ids.has(m.messageId));
          return [...prev, ...older];
        });
        pageRef.current = nextPage;
      }
      setHasMore(more);
    } catch (error) {
      console.error("Failed to load older messages:", error);
    } finally {
      loadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [conversationId, hasMore, fetchPage]);

  // Realtime / poll: pull the newest page and prepend only messages we don't
  // already have (newest at index 0), preserving loaded older pages.
  const refetchLatest = useCallback(async () => {
    if (!conversationId) return;

    try {
      const { desc } = await fetchPage(1);
      const existingIds = new Set(messagesRef.current.map((m) => m.messageId));
      const fresh = desc.filter((m) => !existingIds.has(m.messageId));
      if (fresh.length === 0) return;

      setMessages((prev) => {
        const ids = new Set(prev.map((m) => m.messageId));
        return [...fresh.filter((m) => !ids.has(m.messageId)), ...prev];
      });
      // We're viewing the thread, so clear the unread state and any tray
      // notification that slipped through for this sender.
      messageApi.markConversationAsRead(conversationId).catch(() => {});
      dismissConversationNotifications(conversationId);
    } catch (error) {
      console.error("Failed to refetch messages:", error);
    }
  }, [conversationId, fetchPage]);

  // Jump to the newest message. On an inverted list the bottom is offset 0.
  const scrollToBottom = useCallback((animated = true) => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated });
  }, []);

  const fetchConversation = useCallback(async () => {
    if (!conversationId) return;

    try {
      const conv = await messageApi.getConversation(conversationId);
      if (conv) {
        setConversation(conv);
      }
    } catch (error) {
      console.error("Failed to fetch conversation:", error);
    }
  }, [conversationId]);

  useFocusEffect(
    useCallback(() => {
      hasMarkedRead.current = false;
      fetchConversation();
      fetchMessages();

      // Mark this conversation as on-screen so the push handler suppresses the
      // redundant OS banner for messages we're already viewing. Cleared on blur
      // (navigate away / back / app backgrounded).
      if (conversationId) {
        setActiveConversationId(conversationId);
      }
      return () => setActiveConversationId(null);
    }, [conversationId, fetchConversation, fetchMessages, setActiveConversationId])
  );

  // Realtime: append new messages the instant they land in this thread. The
  // shared socket broadcasts `message:new` with the target conversationId;
  // ignore events for other conversations. The poll below stays as a fallback
  // for when the socket is down.
  useEffect(() => {
    if (!conversationId) return;
    return realtimeEvents.on("message:new", (payload) => {
      if (payload?.conversationId === conversationId) {
        refetchLatest();
      }
    });
  }, [conversationId, refetchLatest]);

  // Poll for new messages (fallback when the socket is unavailable).
  useEffect(() => {
    if (!conversationId) return;

    const interval = setInterval(() => {
      refetchLatest();
    }, MESSAGE_POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [conversationId, refetchLatest]);

  const handleSend = async (attachmentFiles?: AttachmentFile[], isLocked?: boolean, password?: string, hint?: string) => {
    const hasText = messageText.trim().length > 0;
    const hasAttachments = attachmentFiles && attachmentFiles.length > 0;

    if ((!hasText && !hasAttachments) || !conversationId || isSending) return;

    const text = messageText.trim();
    setMessageText("");
    setIsSending(true);

    try {
      let uploadedAttachments: MessageAttachment[] = [];

      // Upload attachments first if any
      if (hasAttachments) {
        const uploadResponse = await messageApi.uploadAttachments(attachmentFiles);
        if (uploadResponse.success && uploadResponse.data) {
          uploadedAttachments = uploadResponse.data.map((att) => ({
            type: att.type,
            url: att.url,
            name: att.name,
            mimeType: att.mimetype,
            size: att.size,
          }));
        }
      }

      // Encrypt if locked
      let finalText = text || "";
      let finalAttachments = uploadedAttachments;
      let metadata: Record<string, any> = {};

      if (isLocked && password) {
        // Encrypt message text
        if (finalText) {
          const encrypted = encryptMessage(finalText, password);
          finalText = encrypted.ciphertext;
          metadata.encryption = {
            algorithm: encrypted.algorithm,
            ...(hint && { hint }),
          };
        }

        // Encrypt attachment URLs
        if (uploadedAttachments.length > 0) {
          finalAttachments = uploadedAttachments.map((att) => {
            const encUrl = encryptMessage(att.url, password);
            return { ...att, url: encUrl.ciphertext };
          });
          metadata.encryption = {
            ...metadata.encryption,
            encryptedAttachments: true,
          };
        }
      }

      // Send message
      const response = await messageApi.sendMessage({
        conversationId,
        messageText: finalText,
        messageType: isLocked ? "encrypted" : "text",
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        attachments: finalAttachments.length > 0 ? finalAttachments : undefined,
        isEncrypted: isLocked || false,
      });

      if (response.data) {
        const sent = response.data;
        // Newest message goes to index 0 (the bottom of the inverted list).
        setMessages((prev) =>
          prev.some((m) => m.messageId === sent.messageId)
            ? prev
            : [sent, ...prev]
        );
        scrollToBottom();
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

  const otherPartyName = isCustomer ? conversation?.shopName : conversation?.customerName;

  // Sweep this conversation's delivered tray notifications once we know the
  // sender name. Notifications delivered while the app was backgrounded are
  // "foreign" FCM entries that expose no conversationId — only the title (the
  // sender's name) — so the name is what lets us clear the siblings the user
  // didn't tap. Re-runs if the name resolves late or the conversation changes.
  useEffect(() => {
    if (!conversationId || !otherPartyName) return;
    dismissConversationNotifications(conversationId, { titleMatch: otherPartyName });
  }, [conversationId, otherPartyName]);

  const removeMessage = useCallback((messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.messageId !== messageId));
  }, []);

  return {
    conversationId,
    messages,
    conversation,
    isLoading,
    isLoadingMore,
    hasMore,
    isSending,
    messageText,
    setMessageText,
    flatListRef,
    isCustomer,
    otherPartyName,
    handleSend,
    handleGoBack,
    loadMore,
    scrollToBottom,
    refetchConversation: fetchConversation,
    removeMessage,
  };
}
