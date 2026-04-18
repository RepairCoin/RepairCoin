"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { MessageInbox, type Conversation } from "./MessageInbox";
import { ConversationThread, type Message } from "./ConversationThread";
import { MessageCircle, ArrowLeft } from "lucide-react";
import * as messagingApi from "@/services/api/messaging";
import { useAuthStore } from "@/stores/authStore";
import { useConversationPresence } from "@/hooks/useConversationPresence";
import { messageOutbox } from "@/services/messageOutbox";

interface MessagesContainerProps {
  userType: "customer" | "shop";
  currentUserId: string;
  initialConversationId?: string | null;
  filterUnread?: boolean;
  filterDateRange?: 'all' | '7d' | '30d' | '90d';
}

export const MessagesContainer: React.FC<MessagesContainerProps> = ({
  userType,
  currentUserId,
  initialConversationId,
  filterUnread,
  filterDateRange,
}) => {
  const appliedInitialId = useRef<string | null>(null);

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [showMobileThread, setShowMobileThread] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const currentPageRef = useRef(1);
  const [error, setError] = useState<string | null>(null);
  const { switchingAccount } = useAuthStore();

  useConversationPresence(selectedConversationId);

  // Fetch conversations from API
  useEffect(() => {
    if (switchingAccount) return;

    const fetchConversations = async (isInitialLoad = true) => {
      try {
        if (isInitialLoad) {
          setIsLoadingConversations(true);
          setError(null);
        }
        const response = await messagingApi.getConversations({ page: 1, limit: 50 });

        // Transform API response to match Conversation type
        const transformedConversations: Conversation[] = (response.data || []).map((conv: any) => ({
          id: conv.conversationId,
          serviceId: "", // Will need to fetch from service orders if needed
          serviceName: "", // Will need to fetch from service orders if needed
          shopId: userType === "customer" ? conv.shopId : undefined,
          shopName: userType === "customer" ? conv.shopName : undefined,
          customerId: userType === "shop" ? conv.customerAddress : undefined,
          customerName: userType === "shop" ? conv.customerName : undefined,
          participantName: userType === "customer" ? (conv.shopName || "Shop") : (conv.customerName || "Customer"),
          participantAvatar: userType === "customer" ? conv.shopImageUrl : undefined, // Shop logo for customers
          lastMessage: conv.lastMessagePreview || "",
          lastMessageTime: conv.lastMessageAt || conv.createdAt,
          unreadCount: userType === "customer" ? conv.unreadCountCustomer : conv.unreadCountShop,
          status: conv.isArchivedCustomer || conv.isArchivedShop ? "resolved" : "active",
          hasAttachment: false,
          isOnline: false,
        }));

        setConversations(transformedConversations);
      } catch (err: any) {
        console.error("Error fetching conversations:", err);

        // Only show error on initial load
        if (isInitialLoad) {
          // Handle specific error cases
          if (err?.status === 401 || err?.message?.includes('Authentication required')) {
            setError("Please log in to view your messages");
          } else if (err?.message?.includes('Network')) {
            setError("Network error. Please check your connection");
          } else {
            setError(err?.message || "Failed to load conversations");
          }
        }
      } finally {
        if (isInitialLoad) {
          setIsLoadingConversations(false);
        }
      }
    };

    fetchConversations(true);

    const handleNewMessage = () => fetchConversations(false);
    window.addEventListener('new-message-received', handleNewMessage);

    return () => window.removeEventListener('new-message-received', handleNewMessage);
  }, [userType, switchingAccount]);

  // Auto-select conversation from prop (passed from URL query param)
  useEffect(() => {
    if (
      initialConversationId &&
      conversations.length > 0 &&
      appliedInitialId.current !== initialConversationId
    ) {
      const exists = conversations.find((c) => c.id === initialConversationId);
      if (exists) {
        setSelectedConversationId(initialConversationId);
        setShowMobileThread(true);
        appliedInitialId.current = initialConversationId;
      }
    }
  }, [initialConversationId, conversations]);

  const transformMsg = useCallback((msg: any): Message => ({
    id: msg.messageId,
    conversationId: msg.conversationId,
    senderId: msg.senderAddress,
    senderName: msg.senderName || (msg.senderAddress === currentUserId ? "You" : "User"),
    senderType: msg.senderType,
    content: msg.messageText,
    timestamp: msg.createdAt,
    status: msg.isRead ? "read" : "delivered",
    isSystemMessage: msg.messageType === "system",
    messageType: msg.messageType,
    metadata: msg.metadata,
    attachments: msg.attachments?.length > 0
      ? msg.attachments.map((a: any) => ({ type: a.type || 'file', url: a.url, name: a.name || 'attachment' }))
      : undefined,
  }), [currentUserId]);

  // Fetch messages when conversation is selected
  useEffect(() => {
    const fetchMessages = async (isInitialLoad = true) => {
      if (!selectedConversationId) {
        setMessages([]);
        setHasMore(false);
        currentPageRef.current = 1;
        return;
      }

      try {
        if (isInitialLoad) {
          setIsLoadingMessages(true);
          currentPageRef.current = 1;
        }
        const response = await messagingApi.getMessages(selectedConversationId, {
          page: 1,
          limit: 10,
          sort: 'desc',
        });

        // Transform and reverse (newest-first from API -> oldest-first for chat display)
        const latestMessages: Message[] = (response.data || []).reverse().map(transformMsg);

        if (isInitialLoad) {
          setMessages(latestMessages);
          setHasMore(response.pagination.hasMore);
        } else {
          // Polling: merge new messages with any older loaded messages
          setMessages(prev => {
            const olderMessages = prev.filter(
              m => !latestMessages.some(lm => lm.id === m.id)
            );
            return [...olderMessages, ...latestMessages];
          });
        }

        // Mark conversation as read
        await messagingApi.markConversationAsRead(selectedConversationId);
        window.dispatchEvent(new CustomEvent('conversation-marked-read', {
          detail: { conversationId: selectedConversationId }
        }));
      } catch (err) {
        console.error("Error fetching messages:", err);
      } finally {
        if (isInitialLoad) {
          setIsLoadingMessages(false);
        }
      }
    };

    fetchMessages(true);

    const handleNewMessage = (e: Event) => {
      const ce = e as CustomEvent<{ conversationId?: string }>;
      if (!selectedConversationId || ce.detail?.conversationId !== selectedConversationId) return;
      fetchMessages(false);
    };
    window.addEventListener('new-message-received', handleNewMessage);

    return () => window.removeEventListener('new-message-received', handleNewMessage);
  }, [selectedConversationId, currentUserId, transformMsg]);

  // Subscribe to outbox updates: reconcile optimistic messages with server state.
  useEffect(() => {
    messageOutbox.hydrateOnce();
    const unsub = messageOutbox.subscribe(update => {
      if (update.conversationId !== selectedConversationId) {
        // Update conversation preview/unread for other threads if any
        setConversations(prev =>
          prev.map(c => {
            if (c.id !== update.conversationId) return c;
            if (update.status === 'sent' && update.message) {
              return {
                ...c,
                lastMessage: update.message.messageText,
                lastMessageTime: update.message.createdAt,
              };
            }
            return c;
          })
        );
        return;
      }

      setMessages(prev => {
        if (update.status === 'sent' && update.message) {
          return prev.map(m =>
            m.id === update.clientMessageId
              ? {
                  ...m,
                  id: update.message!.messageId,
                  status: 'delivered',
                  timestamp: update.message!.createdAt,
                }
              : m
          );
        }
        if (update.status === 'failed') {
          return prev.map(m =>
            m.id === update.clientMessageId ? { ...m, status: 'failed' } : m
          );
        }
        if (update.status === 'sending') {
          return prev.map(m =>
            m.id === update.clientMessageId ? { ...m, status: 'sending' } : m
          );
        }
        return prev;
      });

      if (update.status === 'sent' && update.message) {
        setConversations(prev =>
          prev.map(c =>
            c.id === update.conversationId
              ? {
                  ...c,
                  lastMessage: update.message!.messageText,
                  lastMessageTime: update.message!.createdAt,
                }
              : c
          )
        );
      }
    });
    return unsub;
  }, [selectedConversationId]);

  // Load older messages
  const handleLoadMore = useCallback(async () => {
    if (!selectedConversationId || isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      const nextPage = currentPageRef.current + 1;
      const response = await messagingApi.getMessages(selectedConversationId, {
        page: nextPage,
        limit: 5,
        sort: 'desc',
      });

      const olderMessages: Message[] = (response.data || []).reverse().map(transformMsg);

      setMessages(prev => [...olderMessages, ...prev]);
      setHasMore(response.pagination.hasMore);
      currentPageRef.current = nextPage;
    } catch (err) {
      console.error("Error loading more messages:", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [selectedConversationId, isLoadingMore, hasMore, transformMsg]);

  const filteredConversations = useMemo(() => {
    let filtered = conversations;
    if (filterUnread) {
      filtered = filtered.filter(c => c.unreadCount > 0);
    }
    if (filterDateRange && filterDateRange !== 'all') {
      const days = filterDateRange === '7d' ? 7 : filterDateRange === '30d' ? 30 : 90;
      const cutoff = new Date(Date.now() - days * 86400000);
      filtered = filtered.filter(c => new Date(c.lastMessageTime) >= cutoff);
    }
    return filtered;
  }, [conversations, filterUnread, filterDateRange]);

  const selectedConversation = conversations.find((c) => c.id === selectedConversationId);

  const handleSelectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    setShowMobileThread(true);
  };

  const handleBackToInbox = () => {
    setShowMobileThread(false);
    setSelectedConversationId(null);
  };

  const handleArchiveConversation = async (archived: boolean): Promise<void> => {
    if (!selectedConversationId) return;
    await messagingApi.archiveConversation(selectedConversationId, archived);
    // Update local state
    setConversations(prev =>
      prev.map(c =>
        c.id === selectedConversationId
          ? { ...c, status: archived ? 'resolved' as const : 'active' as const }
          : c
      )
    );
  };

  const handleSendMessage = async (content: string, attachments?: File[]): Promise<void> => {
    if (!selectedConversationId || (!content.trim() && (!attachments || attachments.length === 0))) return;

    // Upload attachments first (still blocking — attachments must exist server-side
    // before the message row references them).
    let uploadedAttachments: messagingApi.MessageAttachment[] = [];
    if (attachments && attachments.length > 0) {
      uploadedAttachments = await messagingApi.uploadAttachments(attachments);
    }

    // Enqueue via outbox: returns the optimistic placeholder immediately.
    // The UI appends it right away; the outbox handles the HTTP in the background
    // and emits 'sent' / 'failed' updates we reconcile in the subscribe effect above.
    const item = messageOutbox.enqueue({
      conversationId: selectedConversationId,
      messageText: content || '',
      messageType: 'text',
      ...(uploadedAttachments.length > 0 && { attachments: uploadedAttachments }),
    });

    const optimistic: Message = {
      id: item.clientMessageId,
      conversationId: selectedConversationId,
      senderId: currentUserId,
      senderName: 'You',
      senderType: userType,
      content: content || '',
      timestamp: new Date(item.createdAt).toISOString(),
      status: 'sending',
      isSystemMessage: false,
      attachments: uploadedAttachments.map(a => ({
        type: (a.type as 'image' | 'file') || 'file',
        url: a.url,
        name: a.name || 'attachment',
      })),
    };

    setMessages(prev => [...prev, optimistic]);

    // Update the inbox preview locally rather than refetching every send.
    setConversations(prev =>
      prev.map(c =>
        c.id === selectedConversationId
          ? {
              ...c,
              lastMessage: content || c.lastMessage,
              lastMessageTime: optimistic.timestamp,
            }
          : c
      )
    );
  };

  const handleRetryMessage = useCallback((messageId: string) => {
    messageOutbox.retry(messageId);
  }, []);

  const handleDiscardMessage = useCallback((messageId: string) => {
    messageOutbox.discard(messageId);
    setMessages(prev => prev.filter(m => m.id !== messageId));
  }, []);

  return (
    <div className="h-full flex bg-[#0A0A0A]">
      {/* Desktop Layout: Split View */}
      <div className="hidden md:flex w-full h-full">
        {/* Inbox Sidebar */}
        <div className="w-96 flex-shrink-0">
          <MessageInbox
            conversations={filteredConversations}
            selectedConversationId={selectedConversationId}
            onSelectConversation={handleSelectConversation}
            userType={userType}
          />
        </div>

        {/* Conversation Thread */}
        <div className="flex-1">
          {isLoadingConversations ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFCC00] mb-4"></div>
              <p className="text-gray-400">Loading conversations...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-[#FFCC00] text-gray-900 rounded-lg hover:bg-yellow-500"
              >
                Retry
              </button>
            </div>
          ) : selectedConversation ? (
            <ConversationThread
              conversationId={selectedConversation.id}
              messages={messages}
              participantName={selectedConversation.participantName}
              participantAvatar={selectedConversation.participantAvatar}
              serviceName={selectedConversation.serviceName}
              isOnline={selectedConversation.isOnline}
              isTyping={false}
              currentUserId={currentUserId}
              currentUserType={userType}
              onSendMessage={handleSendMessage}
              onLoadMore={handleLoadMore}
              hasMore={hasMore}
              isLoadingMore={isLoadingMore}
              conversationStatus={selectedConversation.status}
              onRetryMessage={handleRetryMessage}
              onDiscardMessage={handleDiscardMessage}
              {...(userType === "shop" && { onArchiveConversation: handleArchiveConversation })}
              conversationDetails={{
                id: selectedConversation.id,
                customerId: selectedConversation.customerId,
                customerName: selectedConversation.customerName,
                shopId: selectedConversation.shopId,
                shopName: selectedConversation.shopName,
                lastMessageTime: selectedConversation.lastMessageTime,
                unreadCount: selectedConversation.unreadCount,
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <MessageCircle className="w-24 h-24 text-gray-700 mb-6" />
              <h2 className="text-2xl font-bold text-white mb-2">
                Select a conversation
              </h2>
              <p className="text-gray-400 max-w-md">
                {conversations.length === 0
                  ? "No conversations yet. Book a service to start messaging with shops!"
                  : filteredConversations.length === 0
                  ? "No conversations match the current filters"
                  : `Choose a conversation from the list to start messaging with ${userType === "customer" ? "shops" : "customers"}`}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Layout: Single View */}
      <div className="md:hidden w-full h-full">
        {showMobileThread && selectedConversation ? (
          <div className="relative h-full">
            {/* Back Button */}
            <button
              onClick={handleBackToInbox}
              className="absolute top-4 left-4 z-10 p-2 bg-[#1A1A1A] rounded-full border border-gray-800 hover:bg-[#0A0A0A] transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>

            <ConversationThread
              conversationId={selectedConversation.id}
              messages={messages}
              participantName={selectedConversation.participantName}
              participantAvatar={selectedConversation.participantAvatar}
              serviceName={selectedConversation.serviceName}
              isOnline={selectedConversation.isOnline}
              isTyping={false}
              currentUserId={currentUserId}
              currentUserType={userType}
              onSendMessage={handleSendMessage}
              onLoadMore={handleLoadMore}
              hasMore={hasMore}
              isLoadingMore={isLoadingMore}
              conversationStatus={selectedConversation.status}
              onRetryMessage={handleRetryMessage}
              onDiscardMessage={handleDiscardMessage}
              {...(userType === "shop" && { onArchiveConversation: handleArchiveConversation })}
              conversationDetails={{
                id: selectedConversation.id,
                customerId: selectedConversation.customerId,
                customerName: selectedConversation.customerName,
                shopId: selectedConversation.shopId,
                shopName: selectedConversation.shopName,
                lastMessageTime: selectedConversation.lastMessageTime,
                unreadCount: selectedConversation.unreadCount,
              }}
            />
          </div>
        ) : (
          <MessageInbox
            conversations={filteredConversations}
            selectedConversationId={selectedConversationId}
            onSelectConversation={handleSelectConversation}
            userType={userType}
          />
        )}
      </div>
    </div>
  );
};
