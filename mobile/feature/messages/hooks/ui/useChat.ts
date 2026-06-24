import { useState, useCallback, useRef, useEffect } from "react";
import { FlatList } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useFocusEffect } from "expo-router";
import { messageApi } from "@/feature/messages/services/message.services";
import { useAuthStore } from "@/feature/auth/store/auth.store";
import { realtimeEvents } from "@/shared/utilities/realtimeEvents";
import { useNotificationUiStore } from "@/shared/store/notification-ui.store";
import { Message, Conversation, MessageAttachment } from "../../types";
import { MESSAGE_POLL_INTERVAL } from "@/shared/constants/messaging";
import { AttachmentFile } from "../../components/MessageInput";
import { encryptMessage } from "@/shared/utilities/encryption";

// Messages load newest-first from the API and are reversed to ascending
// (oldest → newest, top → bottom) for display. A full thread can be hundreds of
// messages, so we page: newest page on open, older pages on scroll-up.
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
  // Guards against overlapping load-more requests (scroll fires rapidly).
  const loadingMoreRef = useRef(false);
  // Mirror of `messages` for computing new arrivals without stale closures.
  const messagesRef = useRef<Message[]>([]);
  // When true, the next content-size change scrolls to the bottom. Set on
  // initial load / send / incoming message; left false when prepending older
  // pages so the viewport stays put.
  const shouldScrollToEndRef = useRef(true);
  // Becomes true once the initial load has scrolled to the bottom. Guards
  // load-more: on first render the list sits at offset 0 (the top) before the
  // scroll-to-end runs, which would otherwise trigger an immediate older-page
  // fetch on open.
  const initialScrolledRef = useRef(false);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Fetch a page newest-first, return it reversed to ascending for display.
  const fetchPageAsc = useCallback(
    async (page: number) => {
      const response = await messageApi.getMessages(
        conversationId,
        page,
        MESSAGES_PER_PAGE,
        "desc"
      );
      const asc = [...(response.data || [])].reverse();
      return { asc, hasMore: response.pagination?.hasMore ?? false };
    },
    [conversationId]
  );

  // Initial load (open / focus): newest page, pinned to bottom, mark read.
  const fetchMessages = useCallback(async () => {
    if (!conversationId) return;

    try {
      const { asc, hasMore: more } = await fetchPageAsc(1);
      pageRef.current = 1;
      shouldScrollToEndRef.current = true;
      initialScrolledRef.current = false;
      setMessages(asc);
      setHasMore(more);

      if (!hasMarkedRead.current) {
        hasMarkedRead.current = true;
        await messageApi.markConversationAsRead(conversationId);
      }
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, fetchPageAsc]);

  // Load-more: fetch the next older page and prepend it. maintainVisible-
  // ContentPosition on the list keeps the current messages from jumping.
  const loadMore = useCallback(async () => {
    if (
      !conversationId ||
      loadingMoreRef.current ||
      !hasMore ||
      !initialScrolledRef.current
    )
      return;

    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    try {
      const nextPage = pageRef.current + 1;
      const { asc, hasMore: more } = await fetchPageAsc(nextPage);
      if (asc.length > 0) {
        shouldScrollToEndRef.current = false;
        setMessages((prev) => {
          const ids = new Set(prev.map((m) => m.messageId));
          const older = asc.filter((m) => !ids.has(m.messageId));
          return [...older, ...prev];
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
  }, [conversationId, hasMore, fetchPageAsc]);

  // Realtime / poll: pull the newest page and append only messages we don't
  // already have, so loaded older pages are preserved and nothing reorders.
  const refetchLatest = useCallback(async () => {
    if (!conversationId) return;

    try {
      const { asc } = await fetchPageAsc(1);
      const existingIds = new Set(messagesRef.current.map((m) => m.messageId));
      const fresh = asc.filter((m) => !existingIds.has(m.messageId));
      if (fresh.length === 0) return;

      shouldScrollToEndRef.current = true;
      setMessages((prev) => {
        const ids = new Set(prev.map((m) => m.messageId));
        return [...prev, ...fresh.filter((m) => !ids.has(m.messageId))];
      });
      // We're viewing the thread, so clear the unread state for these.
      messageApi.markConversationAsRead(conversationId).catch(() => {});
    } catch (error) {
      console.error("Failed to refetch messages:", error);
    }
  }, [conversationId, fetchPageAsc]);

  // Scroll to the bottom when flagged (initial load / send / incoming). Wired to
  // the list's onContentSizeChange so it runs after new rows are laid out.
  const handleContentSizeChange = useCallback(() => {
    if (shouldScrollToEndRef.current) {
      flatListRef.current?.scrollToEnd({ animated: false });
      shouldScrollToEndRef.current = false;
      // First scroll-to-bottom done — load-more is now safe to arm.
      initialScrolledRef.current = true;
    }
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
        shouldScrollToEndRef.current = true;
        setMessages((prev) =>
          prev.some((m) => m.messageId === sent.messageId)
            ? prev
            : [...prev, sent]
        );
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
    scrollToEnd,
    handleContentSizeChange,
    refetchConversation: fetchConversation,
  };
}
