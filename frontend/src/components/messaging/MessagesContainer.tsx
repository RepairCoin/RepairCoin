"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Message } from "./ConversationThread";
import { MessagesLayout } from "./MessagesLayout";
import * as messagingApi from "@/services/api/messaging";
import { useConversationPresence } from "@/hooks/useConversationPresence";
import { useConversations } from "@/hooks/messaging/useConversations";
import { useConversationMessages } from "@/hooks/messaging/useConversationMessages";
import { messageOutbox } from "@/services/messageOutbox";

interface MessagesContainerProps {
  userType: "customer" | "shop";
  currentUserId: string;
  initialConversationId?: string | null;
  filterUnread?: boolean;
  filterDateRange?: "all" | "7d" | "30d" | "90d";
}

// Hydrate the outbox once per tab, not per container mount or conversation change.
let outboxHydrated = false;

export const MessagesContainer: React.FC<MessagesContainerProps> = ({
  userType,
  currentUserId,
  initialConversationId,
  filterUnread,
  filterDateRange,
}) => {
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [showMobileThread, setShowMobileThread] = useState(false);
  const appliedInitialId = useRef<string | null>(null);

  const {
    conversations,
    isLoading: isLoadingConversations,
    error,
    updateConversation,
    setConversations,
  } = useConversations(userType);

  const {
    messages,
    setMessages,
    isLoadingMore,
    hasMore,
    loadMore,
  } = useConversationMessages(selectedConversationId, currentUserId);

  useConversationPresence(selectedConversationId);

  // Auto-select conversation from URL query param once.
  useEffect(() => {
    if (
      initialConversationId &&
      conversations.length > 0 &&
      appliedInitialId.current !== initialConversationId
    ) {
      const exists = conversations.some((c) => c.id === initialConversationId);
      if (exists) {
        setSelectedConversationId(initialConversationId);
        setShowMobileThread(true);
        appliedInitialId.current = initialConversationId;
      }
    }
  }, [initialConversationId, conversations]);

  // Mark-as-read: runs once per conversation selection, not on every message poll.
  // Updates the conversation locally so the badge clears without a full list refetch.
  useEffect(() => {
    if (!selectedConversationId) return;
    let cancelled = false;
    (async () => {
      try {
        await messagingApi.markConversationAsRead(selectedConversationId);
        if (cancelled) return;
        updateConversation(selectedConversationId, { unreadCount: 0 });
        // Keep dispatching the event — MessageIcon listens for it to refresh the global badge.
        window.dispatchEvent(
          new CustomEvent("conversation-marked-read", {
            detail: { conversationId: selectedConversationId },
          }),
        );
      } catch (err) {
        console.error("Error marking conversation as read:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedConversationId, updateConversation]);

  // Hydrate outbox once per tab; subscribe to reconcile optimistic messages.
  useEffect(() => {
    if (!outboxHydrated) {
      messageOutbox.hydrateOnce();
      outboxHydrated = true;
    }
  }, []);

  useEffect(() => {
    const unsub = messageOutbox.subscribe((update) => {
      if (update.conversationId !== selectedConversationId) {
        if (update.status === "sent" && update.message) {
          setConversations((prev) =>
            prev.map((c) =>
              c.id === update.conversationId
                ? {
                    ...c,
                    lastMessage: update.message!.messageText,
                    lastMessageTime: update.message!.createdAt,
                  }
                : c,
            ),
          );
        }
        return;
      }

      setMessages((prev) => {
        if (update.status === "sent" && update.message) {
          return prev.map((m) =>
            m.id === update.clientMessageId
              ? {
                  ...m,
                  id: update.message!.messageId,
                  status: "delivered",
                  timestamp: update.message!.createdAt,
                }
              : m,
          );
        }
        if (update.status === "failed") {
          return prev.map((m) =>
            m.id === update.clientMessageId ? { ...m, status: "failed" } : m,
          );
        }
        if (update.status === "sending") {
          return prev.map((m) =>
            m.id === update.clientMessageId ? { ...m, status: "sending" } : m,
          );
        }
        return prev;
      });

      if (update.status === "sent" && update.message) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === update.conversationId
              ? {
                  ...c,
                  lastMessage: update.message!.messageText,
                  lastMessageTime: update.message!.createdAt,
                }
              : c,
          ),
        );
      }
    });
    return unsub;
  }, [selectedConversationId, setConversations, setMessages]);

  const filteredConversations = useMemo(() => {
    let filtered = conversations;
    if (filterUnread) {
      filtered = filtered.filter((c) => c.unreadCount > 0);
    }
    if (filterDateRange && filterDateRange !== "all") {
      const days =
        filterDateRange === "7d" ? 7 : filterDateRange === "30d" ? 30 : 90;
      const cutoff = new Date(Date.now() - days * 86400000);
      filtered = filtered.filter(
        (c) => new Date(c.lastMessageTime) >= cutoff,
      );
    }
    return filtered;
  }, [conversations, filterUnread, filterDateRange]);

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedConversationId),
    [conversations, selectedConversationId],
  );

  const handleSelectConversation = useCallback((conversationId: string) => {
    setSelectedConversationId(conversationId);
    setShowMobileThread(true);
  }, []);

  const handleBackToInbox = useCallback(() => {
    setShowMobileThread(false);
    setSelectedConversationId(null);
  }, []);

  const handleArchiveConversation = useCallback(
    async (archived: boolean): Promise<void> => {
      if (!selectedConversationId) return;
      await messagingApi.archiveConversation(selectedConversationId, archived);
      updateConversation(selectedConversationId, {
        status: archived ? "resolved" : "active",
      });
    },
    [selectedConversationId, updateConversation],
  );

  const handleSendMessage = useCallback(
    async (content: string, attachments?: File[]): Promise<void> => {
      if (
        !selectedConversationId ||
        (!content.trim() && (!attachments || attachments.length === 0))
      )
        return;

      let uploadedAttachments: messagingApi.MessageAttachment[] = [];
      if (attachments && attachments.length > 0) {
        uploadedAttachments = await messagingApi.uploadAttachments(attachments);
      }

      const item = messageOutbox.enqueue({
        conversationId: selectedConversationId,
        messageText: content || "",
        messageType: "text",
        ...(uploadedAttachments.length > 0 && {
          attachments: uploadedAttachments,
        }),
      });

      const optimistic: Message = {
        id: item.clientMessageId,
        conversationId: selectedConversationId,
        senderId: currentUserId,
        senderName: "You",
        senderType: userType,
        content: content || "",
        timestamp: new Date(item.createdAt).toISOString(),
        status: "sending",
        isSystemMessage: false,
        attachments: uploadedAttachments.map((a) => ({
          type: (a.type as "image" | "file") || "file",
          url: a.url,
          name: a.name || "attachment",
        })),
      };

      setMessages((prev) => [...prev, optimistic]);
      updateConversation(selectedConversationId, {
        ...(content && { lastMessage: content }),
        lastMessageTime: optimistic.timestamp,
      });

      // Post-send catchup: 5s after a customer sends, dispatch a fake
      // `new-message-received` for this conversation so useConversationMessages
      // refetches. If the AI reply's WS broadcast was received normally,
      // this is a redundant no-op fetch (~10ms, cheap). If the broadcast was
      // dropped (intermittent issue we've been chasing — see plan doc), the
      // delayed refetch picks up the AI reply within 5 seconds, so the
      // customer never sees "where's my reply?" silence.
      //
      // 5s is chosen because typical AI reply latency is 2-3s; 5s leaves a
      // 2s safety margin. Lower than the catchup-on-conversation-select
      // timer (2.5s) because by the time we get here, the conversation is
      // already settled — we're catching up to the imminent AI reply, not
      // to a stale-listener race.
      //
      // Only fires for customer sends; shop sends don't trigger AI replies.
      if (userType === "customer") {
        const convoIdAtSend = selectedConversationId;
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("new-message-received", {
              detail: { conversationId: convoIdAtSend },
            }),
          );
        }, 5000);
      }
    },
    [
      selectedConversationId,
      currentUserId,
      userType,
      setMessages,
      updateConversation,
    ],
  );

  const handleRetryMessage = useCallback((messageId: string) => {
    messageOutbox.retry(messageId);
  }, []);

  const handleDiscardMessage = useCallback(
    (messageId: string) => {
      messageOutbox.discard(messageId);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    },
    [setMessages],
  );

  return (
    <MessagesLayout
      userType={userType}
      currentUserId={currentUserId}
      conversations={conversations}
      filteredConversations={filteredConversations}
      selectedConversation={selectedConversation}
      selectedConversationId={selectedConversationId}
      messages={messages}
      isLoadingConversations={isLoadingConversations}
      error={error}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      showMobileThread={showMobileThread}
      onSelectConversation={handleSelectConversation}
      onBackToInbox={handleBackToInbox}
      onSendMessage={handleSendMessage}
      onLoadMore={loadMore}
      onRetryMessage={handleRetryMessage}
      onDiscardMessage={handleDiscardMessage}
      {...(userType === "shop" && {
        onArchiveConversation: handleArchiveConversation,
      })}
    />
  );
};
