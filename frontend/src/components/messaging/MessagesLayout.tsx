"use client";

import React from "react";
import { MessageCircle } from "lucide-react";
import { MessageInbox, type Conversation } from "./MessageInbox";
import { ConversationThread, type Message } from "./ConversationThread";

interface MessagesLayoutProps {
  userType: "customer" | "shop";
  currentUserId: string;
  conversations: Conversation[];
  filteredConversations: Conversation[];
  selectedConversation: Conversation | undefined;
  selectedConversationId: string | null;
  messages: Message[];
  isLoadingConversations: boolean;
  error: string | null;
  hasMore: boolean;
  isLoadingMore: boolean;
  showMobileThread: boolean;
  onSelectConversation: (id: string) => void;
  onBackToInbox: () => void;
  onSendMessage: (content: string, attachments?: File[]) => Promise<void>;
  onLoadMore: () => void;
  onRetryMessage: (messageId: string) => void;
  onDiscardMessage: (messageId: string) => void;
  onArchiveConversation?: (archived: boolean) => Promise<void>;
}

export const MessagesLayout: React.FC<MessagesLayoutProps> = ({
  userType,
  currentUserId,
  conversations,
  filteredConversations,
  selectedConversation,
  selectedConversationId,
  messages,
  isLoadingConversations,
  error,
  hasMore,
  isLoadingMore,
  showMobileThread,
  onSelectConversation,
  onBackToInbox,
  onSendMessage,
  onLoadMore,
  onRetryMessage,
  onDiscardMessage,
  onArchiveConversation,
}) => {
  const inbox = (
    <MessageInbox
      conversations={filteredConversations}
      selectedConversationId={selectedConversationId}
      onSelectConversation={onSelectConversation}
      userType={userType}
    />
  );

  const thread = selectedConversation ? (
    <ConversationThread
      conversationId={selectedConversation.id}
      messages={messages}
      participantName={selectedConversation.participantName}
      participantAvatar={selectedConversation.participantAvatar}
      serviceName={selectedConversation.serviceName}
      isOnline={selectedConversation.isOnline}
      isTyping={false}
      aiEnabled={selectedConversation.aiEnabled === true}
      aiPausedUntil={selectedConversation.aiPausedUntil}
      currentUserId={currentUserId}
      currentUserType={userType}
      onSendMessage={onSendMessage}
      onLoadMore={onLoadMore}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      conversationStatus={selectedConversation.status}
      onRetryMessage={onRetryMessage}
      onDiscardMessage={onDiscardMessage}
      onBack={onBackToInbox}
      {...(userType === "shop" && onArchiveConversation
        ? { onArchiveConversation }
        : {})}
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
  ) : null;

  const desktopMain = (() => {
    if (isLoadingConversations) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFCC00] mb-4"></div>
          <p className="text-gray-400">Loading conversations...</p>
        </div>
      );
    }
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-[#FFCC00] text-gray-900 rounded-lg hover:bg-yellow-500"
          >
            Retry
          </button>
        </div>
      );
    }
    if (thread) return thread;
    return (
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
              : `Choose a conversation from the list to start messaging with ${
                  userType === "customer" ? "shops" : "customers"
                }`}
        </p>
      </div>
    );
  })();

  // Breakpoint where side-by-side (inbox + thread) replaces single-pane
  // toggle (inbox OR thread). Differs by userType because the shop
  // dashboard wraps the chat in significantly more chrome (sub-tab
  // switcher, stats grid, filter/export bar, wider max-w-screen-2xl
  // container) that competes for horizontal space — at 1024-1279px the
  // shop thread is cramped to ~400-600px wide and reads as a narrow
  // strip next to the inbox. Bumping shop to xl: (1280px) gives single-
  // pane chat the full width on tablet-landscape devices. Customer
  // side has minimal chrome (just an info banner + header) so the
  // standard lg: (1024px) threshold remains comfortable.
  //
  // Classes are static string literals (not template-built) so Tailwind
  // purging picks them up correctly.
  const sideBySideClass =
    userType === "shop"
      ? "hidden xl:flex w-full h-full"
      : "hidden lg:flex w-full h-full";
  const singlePaneClass =
    userType === "shop" ? "xl:hidden w-full h-full" : "lg:hidden w-full h-full";

  return (
    <div className="h-full flex bg-[#0A0A0A]">
      {/* Side-by-side layout. Customer: 1024px+. Shop: 1280px+. */}
      <div className={sideBySideClass}>
        <div className="w-96 flex-shrink-0 min-h-0">{inbox}</div>
        <div className="flex-1 min-w-0 min-h-0 flex flex-col">{desktopMain}</div>
      </div>

      {/* Single-pane layout (toggle between inbox and thread). Customer:
          <1024px. Shop: <1280px. The back-to-inbox button is rendered
          inline inside ConversationThread's header (see its onBack prop)
          — no overlay needed here. */}
      <div className={`${singlePaneClass} min-h-0 flex flex-col`}>
        {showMobileThread && thread ? thread : inbox}
      </div>
    </div>
  );
};
