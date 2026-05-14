"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Send,
  Paperclip,
  Image as ImageIcon,
  X,
  MoreVertical,
  Info,
  Check,
  CheckCheck,
  Smile,
  CheckCircle,
  RotateCcw,
  Loader2,
  Tag,
  Bot,
  ArrowLeft,
} from "lucide-react";
import dynamic from "next/dynamic";
import type { EmojiClickData } from "emoji-picker-react";
import { SERVICE_CATEGORIES } from "@/services/api/services";
import { AIMessageLabel } from "@/components/messaging/AIMessageLabel";
import {
  BookingSuggestionCard,
  type BookingSuggestion,
} from "@/components/messaging/BookingSuggestionCard";

const CATEGORY_LABEL_MAP = new Map(SERVICE_CATEGORIES.map((c) => [c.value, c.label]));

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderType: "customer" | "shop";
  content: string;
  timestamp: string;
  status: "sending" | "sent" | "delivered" | "read" | "failed";
  attachments?: {
    type: "image" | "file";
    url: string;
    name: string;
  }[];
  isSystemMessage?: boolean;
  messageType?: "text" | "service_link" | "booking_link" | "system";
  metadata?: Record<string, any>;
}

interface ConversationThreadProps {
  conversationId: string;
  messages: Message[];
  participantName: string;
  participantAvatar?: string;
  serviceName: string;
  isOnline?: boolean;
  isTyping?: boolean;
  currentUserId: string;
  currentUserType: "customer" | "shop";
  onSendMessage: (content: string, attachments?: File[]) => Promise<void>;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  conversationStatus?: "active" | "resolved" | "archived";
  onArchiveConversation?: (archived: boolean) => Promise<void>;
  onRetryMessage?: (messageId: string) => void;
  onDiscardMessage?: (messageId: string) => void;
  /**
   * Mobile/tablet back-to-inbox callback. When provided, renders an inline
   * back-arrow button as the first item in the chat header (before the
   * avatar) — visible only below the lg breakpoint, where the layout uses
   * the single-pane toggle. Replaces the previous absolute-positioned
   * overlay that sat on top of the participant avatar at the same
   * coordinates and obscured it.
   */
  onBack?: () => void;
  /**
   * Server-stamped: whether the AI sales agent will actually reply on
   * this conversation (ai_shop_settings.ai_global_enabled AND the
   * service's ai_sales_enabled). Gates the "AI is typing" indicator so
   * it does NOT fire on conversations with shops that don't have AI
   * configured (where the previous unconditional indicator would mislead
   * the customer into expecting a reply that never comes — 30s timeout).
   * Defaults to false when undefined so behavior is conservative.
   */
  aiEnabled?: boolean;
  conversationDetails?: {
    id: string;
    customerId?: string;
    customerName?: string;
    shopId?: string;
    shopName?: string;
    lastMessageTime: string;
    unreadCount: number;
  };
}

export const ConversationThread: React.FC<ConversationThreadProps> = ({
  conversationId,
  messages,
  participantName,
  participantAvatar,
  serviceName,
  isOnline,
  isTyping,
  currentUserId,
  currentUserType,
  onSendMessage,
  onLoadMore,
  hasMore,
  isLoadingMore,
  conversationStatus,
  onArchiveConversation,
  onRetryMessage,
  onDiscardMessage,
  conversationDetails,
  onBack,
  aiEnabled = false,
}) => {
  const [messageInput, setMessageInput] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevMessagesLengthRef = useRef(0);
  const scrollHeightBeforeRef = useRef(0);

  // "Currently discussing" chip — follows in-conversation drift instead of
  // staying pinned to conversation.service_id (the original anchor). Reads
  // discussed_service_name off the most recent AI-generated message (the
  // orchestrator stamps it on every AI reply via resolveDiscussedServiceId).
  // Falls back to the serviceName prop when no AI message has stamped a
  // value yet — covers conversations from before this field was rolled out
  // and the very first turn of any conversation.
  const discussedServiceName = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const name = messages[i]?.metadata?.discussed_service_name;
      if (typeof name === "string" && name.length > 0) {
        return name;
      }
    }
    return serviceName;
  }, [messages, serviceName]);

  // "AI is typing" auto-indicator. Customer-side only — when the customer's
  // message is the latest in the thread, we assume an AI reply is in
  // flight (typical AI latency 2-7s per ai_agent_messages). Cleared
  // automatically when the next message of any kind arrives (covers both
  // the AI reply and any out-of-band shop staff reply). 30s safety timeout
  // catches the edge case where the AI errored so the indicator doesn't
  // spin indefinitely. Shop-side intentionally NOT included: the shop
  // staff don't need to see their own AI "typing".
  //
  // Gated on aiEnabled: previously this fired for ANY conversation where
  // the customer's message was last, including shops without AI configured
  // — those threads would show the indicator for the full 30s with no
  // reply ever arriving, falsely promising one. The aiEnabled signal is
  // server-stamped (ai_shop_settings.ai_global_enabled AND the conversation
  // service's ai_sales_enabled) so we KNOW a reply is on its way.
  const [isAwaitingAiReply, setIsAwaitingAiReply] = useState(false);
  useEffect(() => {
    if (currentUserType !== "customer") {
      setIsAwaitingAiReply(false);
      return;
    }
    if (!aiEnabled) {
      setIsAwaitingAiReply(false);
      return;
    }
    if (messages.length === 0) {
      setIsAwaitingAiReply(false);
      return;
    }
    const last = messages[messages.length - 1];
    // Skip failed sends — no reply is coming on a message that never
    // made it to the server.
    if (last.status === "failed") {
      setIsAwaitingAiReply(false);
      return;
    }
    if (last.senderType === "customer") {
      setIsAwaitingAiReply(true);
      const timer = setTimeout(() => setIsAwaitingAiReply(false), 30000);
      return () => clearTimeout(timer);
    }
    setIsAwaitingAiReply(false);
    // conversationId in deps: when the customer switches conversations,
    // the effect re-runs immediately and resets the indicator from any
    // prior pending state — even if the parent's messages-clear cycle
    // briefly lags (e.g., during loading), this guarantees no false
    // typing-dots flash on the new thread.
  }, [messages, currentUserType, aiEnabled, conversationId]);

  // Combine: prop-driven `isTyping` (currently unwired, reserved for a
  // future presence/WS signal) OR our locally-derived AI-waiting state.
  // Either source produces the same visual indicator.
  const showTypingIndicator = isTyping || isAwaitingAiReply;

  // Keep the typing bubble in view when it first appears. Without this the
  // customer's just-sent message is the last scrolled-to element and the
  // typing bubble (rendered below it) may sit just under the viewport.
  useEffect(() => {
    if (!showTypingIndicator) return;
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [showTypingIndicator]);

  // Reset the message-length tracker when the conversation changes, so
  // the next non-empty render is classified as a fresh "initial load"
  // by the auto-scroll effect below (prevLength === 0 branch → scroll
  // to bottom). Without this, switching from a 20-message conv to
  // another 20-message conv lands the scroll at the TOP: prevLength
  // and newLength are both ~20, so `added` is ~0, no auto-scroll branch
  // fires, and the scroll position stays at 0 (top of the freshly-
  // cleared container).
  useEffect(() => {
    prevMessagesLengthRef.current = 0;
  }, [conversationId]);

  // Capture scroll height before DOM updates (for load-more scroll preservation)
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      scrollHeightBeforeRef.current = container.scrollHeight;
    }
  });

  // Auto-scroll to bottom on initial load / new message, preserve position on load-more
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || messages.length === 0) return;

    const prevLength = prevMessagesLengthRef.current;
    const newLength = messages.length;
    const added = newLength - prevLength;
    prevMessagesLengthRef.current = newLength;

    if (prevLength === 0) {
      // Initial load — scroll to bottom
      container.scrollTop = container.scrollHeight;
    } else if (added > 0 && added <= 2) {
      // New message sent/received — scroll to bottom
      container.scrollTop = container.scrollHeight;
    } else if (added > 2) {
      // Load-more: older messages prepended — keep scroll position stable
      const heightDiff = container.scrollHeight - scrollHeightBeforeRef.current;
      container.scrollTop += heightDiff;
    }
  }, [messages]);

  // Close emoji picker on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmojiPicker]);

  // Close more menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    if (showMoreMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMoreMenu]);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setMessageInput((prev) => prev + emojiData.emoji);
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  };

  // Reset avatar error when participant changes
  useEffect(() => {
    setAvatarError(false);
  }, [participantAvatar]);

  const handleSend = async () => {
    if (!messageInput.trim() && selectedFiles.length === 0) return;
    if (isSending) return; // Prevent double-sending

    try {
      setIsSending(true);
      if (selectedFiles.length > 0) setIsUploading(true);
      setSendError(null);
      await onSendMessage(messageInput.trim(), selectedFiles);
      // Only clear on success
      setMessageInput("");
      setSelectedFiles([]);
    } catch (error: any) {
      console.error("Error sending message:", error);
      setSendError(error?.message || "Failed to send message. Please try again.");
      // Keep the message in the input box for retry
    } finally {
      setIsUploading(false);
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const MAX_FILES = 5;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);

    // Limit to 5 files
    if (files.length > MAX_FILES) {
      setSendError(`Maximum ${MAX_FILES} files allowed.`);
      return;
    }

    // Validate file sizes
    const oversized = files.filter(f => f.size > MAX_FILE_SIZE);
    if (oversized.length > 0) {
      setSendError(`${oversized.map(f => f.name).join(', ')} exceed${oversized.length === 1 ? 's' : ''} 5MB limit.`);
      return;
    }

    setSendError(null);
    setSelectedFiles(files);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
      });
    }
  };

  const groupMessagesByDate = () => {
    const groups: { date: string; messages: Message[] }[] = [];
    let currentDate = "";

    messages.forEach((message) => {
      const messageDate = formatDate(message.timestamp);
      if (messageDate !== currentDate) {
        currentDate = messageDate;
        groups.push({ date: messageDate, messages: [message] });
      } else {
        groups[groups.length - 1].messages.push(message);
      }
    });

    return groups;
  };

  const messageGroups = groupMessagesByDate();

  return (
    <div className="flex flex-col h-full bg-[#0A0A0A] relative">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between p-4 border-b border-gray-800 bg-[#1A1A1A]">
        <div className="flex items-center gap-3">
          {/* Mobile/tablet back button. Inline (NOT overlaid on the avatar
              like the previous absolute-positioned version was), visible
              only below lg where the single-pane layout needs a way back
              to the inbox. */}
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to conversations"
              className="lg:hidden flex-shrink-0 p-2 -ml-2 rounded-full hover:bg-[#0A0A0A] transition-colors text-gray-300 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          {/* Avatar - Show shop logo if available, otherwise show initial */}
          <div className="relative">
            {participantAvatar && !avatarError ? (
              <img
                src={participantAvatar}
                alt={participantName}
                className="w-10 h-10 rounded-full object-cover bg-[#0A0A0A]"
                onError={() => setAvatarError(true)}
              />
            ) : (
              <div className="w-10 h-10 bg-gradient-to-br from-[#FFCC00] to-[#FFD700] rounded-full flex items-center justify-center">
                <span className="text-black font-bold">
                  {participantName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            {isOnline && (
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#1A1A1A]"></div>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-col gap-1">
            <div>
              <h3 className="text-sm font-semibold text-white">{participantName}</h3>
              {/* Subtitle is reserved for transient indicators (typing/online).
                  The service-anchor chip below shows the persistent
                  "what service this chat is about" context. */}
              {(showTypingIndicator || isOnline) && (
                <p className="text-xs text-gray-400">
                  {showTypingIndicator ? (
                    <span className="text-[#FFCC00]">typing...</span>
                  ) : (
                    "Online"
                  )}
                </p>
              )}
            </div>
            {/* "Currently discussing: X" chip. Dynamic-update follow-up:
                reads the latest AI message's metadata.discussed_service_name
                so the chip follows in-conversation drift (e.g., chat is
                anchored to AQua Tech but the customer pivots to I Robot →
                chip flips to I Robot). Falls back to the serviceName prop
                (= conversation.service_id's name) for the first AI reply,
                legacy data, and conversations with no AI messages yet. */}
            {discussedServiceName && (
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-violet-500/10 border border-violet-400/30 rounded-full self-start max-w-full">
                <Tag className="w-3 h-3 text-violet-300 flex-shrink-0" aria-hidden="true" />
                <span className="text-[11px] font-medium text-violet-200 truncate">
                  <span className="text-violet-300/70">Currently discussing: </span>
                  {discussedServiceName}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {conversationStatus === "resolved" && (
            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-medium rounded-full">
              Resolved
            </span>
          )}
          <button
            onClick={() => setShowInfoPanel(!showInfoPanel)}
            className={`p-2 hover:bg-[#0A0A0A] rounded-lg transition-colors ${showInfoPanel ? 'bg-[#0A0A0A]' : ''}`}
          >
            <Info className={`w-5 h-5 ${showInfoPanel ? 'text-[#FFCC00]' : 'text-gray-400'}`} />
          </button>
          {onArchiveConversation && (
            <div className="relative" ref={moreMenuRef}>
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="p-2 hover:bg-[#0A0A0A] rounded-lg transition-colors"
              >
                <MoreVertical className="w-5 h-5 text-gray-400" />
              </button>
              {showMoreMenu && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-[#1A1A1A] border border-gray-700 rounded-lg shadow-xl z-50 py-1">
                  {conversationStatus === "resolved" ? (
                    <button
                      onClick={() => { onArchiveConversation(false); setShowMoreMenu(false); }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-[#0A0A0A] hover:text-white flex items-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reopen Conversation
                    </button>
                  ) : (
                    <button
                      onClick={() => { onArchiveConversation(true); setShowMoreMenu(false); }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-[#0A0A0A] hover:text-white flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Resolve Conversation
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Info Panel */}
      {showInfoPanel && (
        <div className="border-b border-gray-800 bg-[#111111] p-4 animate-in slide-in-from-top">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">Participant</p>
              <p className="text-sm text-white font-medium">{participantName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Status</p>
              <p className={`text-sm font-medium ${conversationStatus === 'resolved' ? 'text-green-400' : 'text-[#FFCC00]'}`}>
                {conversationStatus === 'resolved' ? 'Resolved' : 'Active'}
              </p>
            </div>
            {conversationDetails?.customerId && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Customer Address</p>
                <p className="text-sm text-gray-300 font-mono truncate">{conversationDetails.customerId}</p>
              </div>
            )}
            {conversationDetails?.shopName && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Shop</p>
                <p className="text-sm text-gray-300">{conversationDetails.shopName}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500 mb-1">Messages</p>
              <p className="text-sm text-white">{messages.length}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Unread</p>
              <p className="text-sm text-white">{conversationDetails?.unreadCount ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Last Activity</p>
              <p className="text-sm text-gray-300">
                {conversationDetails?.lastMessageTime
                  ? new Date(conversationDetails.lastMessageTime).toLocaleString()
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Conversation ID</p>
              <p className="text-sm text-gray-500 font-mono truncate">{conversationId}</p>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Load older messages button */}
        {hasMore && (
          <div className="flex justify-center">
            <button
              onClick={onLoadMore}
              disabled={isLoadingMore}
              className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-gray-400 bg-[#1A1A1A] hover:bg-[#252525] border border-gray-800 rounded-full transition-colors disabled:opacity-50"
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Loading...
                </>
              ) : (
                "Load older messages"
              )}
            </button>
          </div>
        )}
        {messageGroups.map((group, groupIndex) => (
          <div key={groupIndex}>
            {/* Date Divider */}
            <div className="flex items-center justify-center mb-4">
              <div className="bg-[#1A1A1A] px-3 py-1 rounded-full">
                <span className="text-xs text-gray-400 font-medium">{group.date}</span>
              </div>
            </div>

            {/* Messages for this date */}
            <div className="space-y-4">
              {group.messages.map((message) => {
                const isOwnMessage = message.senderType === currentUserType;

                if (message.isSystemMessage) {
                  return (
                    <div key={message.id} className="flex justify-center">
                      <div className="bg-[#1A1A1A] px-4 py-2 rounded-lg max-w-md">
                        <p className="text-xs text-gray-400 text-center">{message.content}</p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={message.id}
                    className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`flex gap-2 max-w-[70%] ${isOwnMessage ? "flex-row-reverse" : "flex-row"}`}>
                      {/* Avatar (only for received messages) - Show shop logo if available */}
                      {!isOwnMessage && (
                        participantAvatar && !avatarError ? (
                          <img
                            src={participantAvatar}
                            alt={message.senderName}
                            className="w-8 h-8 rounded-full object-cover bg-[#0A0A0A] flex-shrink-0"
                            onError={() => setAvatarError(true)}
                          />
                        ) : (
                          <div className="w-8 h-8 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-xs font-bold">
                              {message.senderName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )
                      )}

                      {/* Message Bubble */}
                      <div>
                        {/* AI assistant disclosure — shown above bubble when
                            this message was generated by the AI Sales Agent
                            (Phase 3 Task 9). Universal rule: customers must
                            be able to tell at a glance that a reply is AI. */}
                        {!isOwnMessage && message.metadata?.generated_by === "ai_agent" && (
                          <AIMessageLabel />
                        )}
                        <div
                          className={`rounded-2xl p-3 ${
                            isOwnMessage
                              ? "bg-gradient-to-br from-[#FFCC00] to-[#FFD700] text-black"
                              : message.metadata?.generated_by === "ai_agent"
                                ? "bg-[#1A1A1A] text-white border border-violet-500/30"
                                : "bg-[#1A1A1A] text-white border border-gray-800"
                          }`}
                        >
                          {/* Service Link Card */}
                          {message.messageType === "service_link" && message.metadata && (
                            <div className="mb-2">
                              <div className={`rounded-lg overflow-hidden border ${
                                isOwnMessage
                                  ? "border-black/20 bg-black/10"
                                  : "border-gray-700 bg-[#0A0A0A]"
                              }`}>
                                {/* Service Image */}
                                {message.metadata.serviceImage && (
                                  <div className="w-full aspect-[4/3] overflow-hidden bg-gray-800">
                                    <img
                                      src={message.metadata.serviceImage}
                                      alt={message.metadata.serviceName}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                )}
                                {/* Service Details */}
                                <div className="p-3">
                                  <h4 className={`font-semibold text-sm mb-1 ${
                                    isOwnMessage ? "text-black" : "text-white"
                                  }`}>
                                    {message.metadata.serviceName}
                                  </h4>
                                  <div className="flex items-center justify-between">
                                    <span className={`text-xs ${
                                      isOwnMessage ? "text-black/70" : "text-gray-400"
                                    }`}>
                                      {CATEGORY_LABEL_MAP.get(message.metadata.serviceCategory) ?? message.metadata.serviceCategory}
                                    </span>
                                    <span className={`text-sm font-bold ${
                                      isOwnMessage ? "text-black" : "text-[#FFCC00]"
                                    }`}>
                                      ${message.metadata.servicePrice}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Booking Link Card */}
                          {message.messageType === "booking_link" && message.metadata && (
                            <div className="mb-2">
                              <div className={`rounded-lg overflow-hidden border ${
                                isOwnMessage
                                  ? "border-black/20 bg-black/10"
                                  : "border-gray-700 bg-[#0A0A0A]"
                              }`}>
                                {message.metadata.serviceImage && (
                                  <div className="w-full aspect-[4/3] overflow-hidden bg-gray-800">
                                    <img
                                      src={message.metadata.serviceImage}
                                      alt={message.metadata.serviceName}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                )}
                                <div className="p-3">
                                  <h4 className={`font-semibold text-sm mb-1 ${
                                    isOwnMessage ? "text-black" : "text-white"
                                  }`}>
                                    {message.metadata.shopName || message.metadata.serviceName}
                                  </h4>
                                  <div className={`space-y-1 text-xs ${
                                    isOwnMessage ? "text-black/70" : "text-gray-400"
                                  }`}>
                                    <p>Service: {message.metadata.serviceName}</p>
                                    <p>Price: ${message.metadata.servicePrice}</p>
                                    {message.metadata.serviceCategory && (
                                      <p>Category: {CATEGORY_LABEL_MAP.get(message.metadata.serviceCategory) ?? message.metadata.serviceCategory}</p>
                                    )}
                                    {message.metadata.bookingDate && (
                                      <p className={`font-medium ${
                                        isOwnMessage ? "text-black" : "text-[#FFCC00]"
                                      }`}>
                                        {message.metadata.bookingDate}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Attachments */}
                          {message.attachments && message.attachments.length > 0 && (
                            <div className="mb-2 space-y-2">
                              {message.attachments.map((attachment, index) => (
                                <div key={index}>
                                  {attachment.type === "image" ? (
                                    <a
                                      href={attachment.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="block cursor-pointer"
                                    >
                                      <img
                                        src={attachment.url}
                                        alt={attachment.name}
                                        className="rounded-lg max-w-full max-h-64 object-cover hover:opacity-90 transition-opacity"
                                      />
                                    </a>
                                  ) : (
                                    <a
                                      href={attachment.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      download={attachment.name}
                                      className={`flex items-center gap-2 p-2 rounded-lg hover:opacity-80 transition-opacity ${
                                        isOwnMessage ? "bg-black/10" : "bg-white/5"
                                      }`}
                                    >
                                      <Paperclip className="w-4 h-4 flex-shrink-0" />
                                      <span className="text-sm truncate">{attachment.name}</span>
                                      <span className={`text-xs ml-auto flex-shrink-0 ${
                                        isOwnMessage ? "text-black/50" : "text-gray-500"
                                      }`}>Download</span>
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Message Content */}
                          {message.content && (
                            <p className="text-sm whitespace-pre-wrap break-words">
                              {message.content}
                            </p>
                          )}
                        </div>

                        {/* Booking Suggestion Cards (Phase 3 Task 10) — AI
                            recommended one or more bookable slots and the
                            backend validated them against real availability.
                            Tap → existing service-checkout flow with the
                            slot pre-filled. */}
                        {!isOwnMessage &&
                          Array.isArray(message.metadata?.booking_suggestions) &&
                          message.metadata.booking_suggestions.length > 0 && (
                            <div className="space-y-1">
                              {(message.metadata.booking_suggestions as BookingSuggestion[]).map(
                                (s, i) => (
                                  <BookingSuggestionCard
                                    key={`${s.serviceId}-${s.slotIso}-${i}`}
                                    suggestion={s}
                                    serviceName={message.metadata?.serviceName as string | undefined}
                                    servicePriceUsd={
                                      message.metadata?.servicePrice as number | undefined
                                    }
                                  />
                                )
                              )}
                            </div>
                          )}

                        {/* Timestamp and Status */}
                        <div
                          className={`flex items-center gap-1 mt-1 ${
                            isOwnMessage ? "justify-end" : "justify-start"
                          }`}
                        >
                          <span className="text-xs text-gray-500">
                            {formatTime(message.timestamp)}
                          </span>
                          {isOwnMessage && (
                            <span className="flex items-center gap-1">
                              {message.status === "read" ? (
                                <CheckCheck className="w-3 h-3 text-blue-500" />
                              ) : message.status === "delivered" ? (
                                <CheckCheck className="w-3 h-3 text-gray-500" />
                              ) : message.status === "sent" ? (
                                <Check className="w-3 h-3 text-gray-500" />
                              ) : message.status === "failed" ? (
                                <>
                                  <span className="text-[11px] text-red-400">Failed</span>
                                  {onRetryMessage && (
                                    <button
                                      onClick={() => onRetryMessage(message.id)}
                                      className="text-[11px] text-red-400 hover:text-red-300 underline"
                                    >
                                      Retry
                                    </button>
                                  )}
                                  {onDiscardMessage && (
                                    <button
                                      onClick={() => onDiscardMessage(message.id)}
                                      className="text-[11px] text-gray-500 hover:text-gray-400 underline"
                                    >
                                      Discard
                                    </button>
                                  )}
                                </>
                              ) : (
                                <div className="w-3 h-3 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Typing Indicator. Appears below the latest message, left-aligned.
            When isAwaitingAiReply is the source (customer just sent a message),
            we use a bot avatar + the "AI is typing" label so the customer
            knows an AI agent is composing — distinct from the general
            participant-typing case driven by the isTyping prop. */}
        {showTypingIndicator && (
          <div className="flex justify-start" aria-live="polite" aria-atomic="true">
            <div className="flex gap-2">
              {isAwaitingAiReply ? (
                <div
                  className="w-8 h-8 bg-gradient-to-br from-violet-500 to-violet-700 rounded-full flex items-center justify-center"
                  aria-hidden="true"
                >
                  <Bot className="w-4 h-4 text-white" />
                </div>
              ) : participantAvatar && !avatarError ? (
                <img
                  src={participantAvatar}
                  alt={participantName}
                  className="w-8 h-8 rounded-full object-cover bg-[#0A0A0A]"
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <div className="w-8 h-8 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">
                    {participantName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl px-3 py-2 flex items-center gap-2">
                {isAwaitingAiReply && (
                  <span className="text-[11px] font-medium text-violet-300/90">
                    AI is typing
                  </span>
                )}
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce"></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Selected Files Preview */}
      {selectedFiles.length > 0 && (
        <div className="shrink-0 px-4 py-2 border-t border-gray-800 bg-[#1A1A1A]">
          {isUploading && (
            <div className="flex items-center gap-2 mb-2">
              <div className="w-4 h-4 border-2 border-[#FFCC00] border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-[#FFCC00]">Uploading {selectedFiles.length} file(s)...</span>
            </div>
          )}
          <div className="flex gap-2 overflow-x-auto">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="relative flex-shrink-0 w-20 h-20 bg-[#0A0A0A] rounded-lg border border-gray-700"
              >
                {file.type.startsWith("image/") ? (
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className={`w-full h-full object-cover rounded-lg ${isUploading ? 'opacity-50' : ''}`}
                  />
                ) : (
                  <div className={`w-full h-full flex flex-col items-center justify-center gap-1 ${isUploading ? 'opacity-50' : ''}`}>
                    <Paperclip className="w-5 h-5 text-gray-500" />
                    <span className="text-[10px] text-gray-500 truncate w-full text-center px-1">{file.name.split('.').pop()?.toUpperCase()}</span>
                  </div>
                )}
                {isUploading && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-lg">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {!isUploading && (
                  <button
                    onClick={() => removeFile(index)}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <div ref={emojiPickerRef} className="absolute bottom-20 right-4 z-50">
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            theme={"dark" as any}
            width={320}
            height={400}
            searchPlaceholder="Search emoji..."
            lazyLoadEmojis
          />
        </div>
      )}

      {/* Input Area */}
      <div className="shrink-0 p-4 border-t border-gray-800 bg-[#1A1A1A]">
        {/* Error Message */}
        {sendError && (
          <div className="mb-3 p-3 bg-red-900/20 border border-red-500/50 rounded-lg flex items-start justify-between">
            <div className="flex-1">
              <p className="text-red-400 text-sm">{sendError}</p>
            </div>
            <button
              onClick={() => setSendError(null)}
              className="ml-2 text-red-400 hover:text-red-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* Attachment Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isSending}
            className="p-2 hover:bg-[#0A0A0A] rounded-lg transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Paperclip className="w-5 h-5 text-gray-400" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Message Input */}
          <div className={`flex-1 bg-[#0A0A0A] border rounded-lg focus-within:ring-2 focus-within:ring-[#FFCC00] focus-within:border-transparent ${
            sendError ? 'border-red-500/50' : 'border-gray-700'
          }`}>
            <textarea
              ref={textareaRef}
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type a message..."
              rows={1}
              disabled={isSending}
              className="w-full px-4 py-3 bg-transparent text-white placeholder-gray-500 resize-none focus:outline-none max-h-32 disabled:opacity-50"
              style={{
                minHeight: "44px",
                height: "auto",
              }}
            />
          </div>

          {/* Emoji Button */}
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            disabled={isSending}
            className="p-2 hover:bg-[#0A0A0A] rounded-lg transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Smile className="w-5 h-5 text-gray-400" />
          </button>

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={(!messageInput.trim() && selectedFiles.length === 0) || isSending}
            className="p-3 bg-gradient-to-br from-[#FFCC00] to-[#FFD700] rounded-lg hover:from-[#FFD700] hover:to-[#FFCC00] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            {isSending ? (
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-5 h-5 text-black" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
