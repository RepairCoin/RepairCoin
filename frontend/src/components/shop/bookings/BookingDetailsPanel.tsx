"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { X, Package, Loader2, MessageSquare, Edit2, Send } from "lucide-react";
import { MockBooking, getStatusLabel, getStatusColor } from "./mockData";
import { BookingOverviewTab } from "./tabs/BookingOverviewTab";
import { BookingTimelineTab } from "./tabs/BookingTimelineTab";
import { type Message } from "@/components/messaging/ConversationThread";
import * as messagingApi from "@/services/api/messaging";
import type { QuickReply } from "@/services/api/messaging";
import { QuickReplyManager } from "@/components/messaging/QuickReplyManager";
import { useAuthStore } from "@/stores/authStore";

interface BookingDetailsPanelProps {
  booking: MockBooking | null;
  onClose: () => void;
  shopId: string;
  isBlocked?: boolean;
  blockReason?: string;
}

type TabType = 'overview' | 'message' | 'timeline';

export const BookingDetailsPanel: React.FC<BookingDetailsPanelProps> = ({
  booking,
  onClose,
  shopId,
  isBlocked = false,
  blockReason = "Action blocked"
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [participantName, setParticipantName] = useState("Customer");
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const [inputValue, setInputValue] = useState("");
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [showQuickReplyManager, setShowQuickReplyManager] = useState(false);
  const sentBookingLinksRef = useRef<Set<string>>(new Set());
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef<number>(0);
  const { userProfile } = useAuthStore();

  // Load or create conversation when Message tab is selected
  const loadConversation = useCallback(async () => {
    if (!booking?.customerAddress) return;

    setIsLoadingConversation(true);
    try {
      const conversation = await messagingApi.getOrCreateConversation(booking.customerAddress);
      setConversationId(conversation.conversationId);
      setParticipantName(conversation.customerName || booking.customerName || "Customer");

      const response = await messagingApi.getMessages(conversation.conversationId, { page: 1, limit: 100 });
      const transformedMessages: Message[] = (response.data || []).map((msg: any) => ({
        id: msg.messageId,
        conversationId: msg.conversationId,
        senderId: msg.senderAddress,
        senderName: msg.senderName || (msg.senderType === "shop" ? "You" : booking.customerName),
        senderType: msg.senderType,
        content: msg.messageText,
        timestamp: msg.createdAt,
        status: msg.isRead ? "read" as const : "delivered" as const,
        isSystemMessage: msg.messageType === "system",
        messageType: msg.messageType,
        metadata: msg.metadata,
        attachments: msg.attachments?.length > 0 ? msg.attachments : undefined,
      }));
      setMessages(transformedMessages);

      await messagingApi.markConversationAsRead(conversation.conversationId);
      window.dispatchEvent(new CustomEvent('conversation-marked-read', {
        detail: { conversationId: conversation.conversationId }
      }));

      // Auto-send booking_link message if first time for this booking
      const bookingKey = `${booking.orderId}-${conversation.conversationId}`;
      const alreadySentBookingLink = transformedMessages.some(
        (msg) => msg.messageType === "booking_link" && msg.metadata?.bookingId === booking.orderId
      );

      if (!alreadySentBookingLink && !sentBookingLinksRef.current.has(bookingKey)) {
        sentBookingLinksRef.current.add(bookingKey);

        const bookingDateStr = booking.serviceDate && booking.serviceTime
          ? `${booking.serviceDate} at ${booking.serviceTime}`
          : booking.serviceDate || "";

        const newMsg = await messagingApi.sendMessage({
          conversationId: conversation.conversationId,
          messageText: `Regarding your booking for ${booking.serviceName}${bookingDateStr ? ` on ${bookingDateStr}` : ""}`,
          messageType: "booking_link",
          metadata: {
            bookingId: booking.orderId,
            serviceName: booking.serviceName,
            serviceImage: booking.serviceImageUrl,
            servicePrice: booking.amount,
            serviceCategory: booking.serviceCategory,
            shopName: userProfile?.name || "",
            bookingDate: bookingDateStr,
          },
        });

        const transformedNew: Message = {
          id: newMsg.messageId,
          conversationId: newMsg.conversationId,
          senderId: newMsg.senderAddress,
          senderName: "You",
          senderType: newMsg.senderType,
          content: newMsg.messageText,
          timestamp: newMsg.createdAt,
          status: "delivered",
          messageType: newMsg.messageType,
          metadata: newMsg.metadata,
        };
        setMessages((prev) => [...prev, transformedNew]);
      }
    } catch (err) {
      console.error("Error loading conversation for booking:", err);
    } finally {
      setIsLoadingConversation(false);
    }
  }, [booking?.customerAddress, booking?.orderId, booking?.serviceName, booking?.serviceImageUrl, booking?.amount, booking?.serviceCategory, booking?.serviceDate, booking?.serviceTime, booking?.customerName, userProfile?.name]);

  // Load conversation when Message tab is selected
  useEffect(() => {
    if (activeTab === "message" && booking) {
      loadConversation();
    }
  }, [activeTab, booking?.bookingId, loadConversation]);

  // Poll for new messages while on message tab
  useEffect(() => {
    if (activeTab !== "message" || !conversationId) return;

    const pollMessages = async () => {
      try {
        const response = await messagingApi.getMessages(conversationId, { page: 1, limit: 100 });
        const transformedMessages: Message[] = (response.data || []).map((msg: any) => ({
          id: msg.messageId,
          conversationId: msg.conversationId,
          senderId: msg.senderAddress,
          senderName: msg.senderName || (msg.senderType === "shop" ? "You" : booking?.customerName || "Customer"),
          senderType: msg.senderType,
          content: msg.messageText,
          timestamp: msg.createdAt,
          status: msg.isRead ? "read" as const : "delivered" as const,
          isSystemMessage: msg.messageType === "system",
          messageType: msg.messageType,
          metadata: msg.metadata,
          attachments: msg.attachments?.length > 0 ? msg.attachments : undefined,
        }));
        setMessages(transformedMessages);
        await messagingApi.markConversationAsRead(conversationId);
        window.dispatchEvent(new CustomEvent('conversation-marked-read', {
          detail: { conversationId }
        }));
      } catch (err) {
        // Silent fail on polling
      }
    };

    const interval = setInterval(pollMessages, 3000);
    return () => clearInterval(interval);
  }, [activeTab, conversationId, booking?.customerName]);

  // Auto-scroll to latest message only when new messages are added
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current && messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      container.scrollTop = container.scrollHeight;
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length]);

  // Fetch quick replies from API
  const fetchQuickReplies = useCallback(async () => {
    try {
      const data = await messagingApi.getQuickReplies();
      setQuickReplies(data);
    } catch (err) {
      // Silent fail — will use default fallback
    }
  }, []);

  useEffect(() => {
    fetchQuickReplies();
  }, [fetchQuickReplies]);

  // Reset conversation state when booking changes
  useEffect(() => {
    setConversationId(null);
    setMessages([]);
  }, [booking?.bookingId]);

  const handleSendMessage = async (content: string): Promise<void> => {
    if (!conversationId || !content.trim()) return;

    const newMsg = await messagingApi.sendMessage({
      conversationId,
      messageText: content,
      messageType: "text",
    });

    const transformedMessage: Message = {
      id: newMsg.messageId,
      conversationId: newMsg.conversationId,
      senderId: newMsg.senderAddress,
      senderName: "You",
      senderType: newMsg.senderType,
      content: newMsg.messageText,
      timestamp: newMsg.createdAt,
      status: "delivered",
    };

    setMessages((prev) => [...prev, transformedMessage]);
  };

  // Early return AFTER all hooks
  if (!booking) {
    return (
      <div className="h-full flex items-center justify-center bg-[#1A1A1A] rounded-2xl border border-gray-800">
        <div className="text-center p-8">
          <Package className="w-16 h-16 text-gray-700 mx-auto mb-4" />
          <h3 className="text-white font-medium mb-2">Select a Booking</h3>
          <p className="text-gray-500 text-sm">
            Click on a booking from the list to view details
          </p>
        </div>
      </div>
    );
  }

  const tabs: { key: TabType; label: string; badge?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'message', label: 'Message', badge: booking.unreadCount > 0 ? booking.unreadCount : undefined },
    { key: 'timeline', label: 'Timeline' }
  ];

  return (
    <div className="flex flex-col bg-[#1A1A1A] rounded-2xl border border-gray-800">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold text-white">{booking.bookingId}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors lg:hidden"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(booking.status)}`}>
          <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
          {getStatusLabel(booking.status)}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
              activeTab === tab.key
                ? 'text-white border-b-2 border-[#FFCC00]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
            {tab.badge && (
              <span className="absolute top-2 right-2 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && (
          <div className="p-4">
            <BookingOverviewTab booking={booking} />
          </div>
        )}
        {activeTab === 'message' && (
          isLoadingConversation ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 className="w-8 h-8 text-[#FFCC00] animate-spin mx-auto mb-2" />
                <p className="text-gray-400 text-sm">Loading conversation...</p>
              </div>
            </div>
          ) : conversationId ? (
            <div className="flex flex-col h-full p-4">
              {/* Unified Messages Header */}
              <div className="p-4 bg-[#0D0D0D] rounded-xl border border-gray-800 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-5 h-5 text-gray-400" />
                  <h4 className="text-white font-medium">Unified Messages</h4>
                </div>
                <p className="text-gray-500 text-sm">
                  Last message: {messages.length > 0
                    ? new Date(messages[messages.length - 1].timestamp).toLocaleString()
                    : "No messages yet"}
                </p>
                <div className="mt-3 p-3 bg-[#1A1A1A] rounded-lg border border-gray-700">
                  <div className="flex items-start gap-2">
                    <span className="text-gray-400 text-lg">ℹ️</span>
                    <p className="text-sm text-yellow-400/80">
                      Channel-agnostic thread. FB/IG/WhatsApp/SMS all normalize into the same Conversation object.
                    </p>
                  </div>
                </div>
              </div>

              {/* Messages List */}
              <div ref={messagesContainerRef} className="flex-1 overflow-y-auto space-y-3 mb-4 min-h-[200px]">
                {messages.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageSquare className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                    <p className="text-gray-500">No messages yet</p>
                    <p className="text-gray-600 text-sm">Start the conversation with your customer</p>
                  </div>
                ) : (
                  messages.map((message) => {
                    const isOwnMessage = message.senderType === "shop";
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[80%]`}>
                          <div
                            className={`p-3 rounded-xl ${
                              isOwnMessage
                                ? 'bg-[#FFCC00] text-black rounded-br-sm'
                                : 'bg-[#2A2A2A] text-white rounded-bl-sm'
                            }`}
                          >
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
                                        <p>Category: {message.metadata.serviceCategory}</p>
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
                            {/* Service Link Card */}
                            {message.messageType === "service_link" && message.metadata && (
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
                                      {message.metadata.serviceName}
                                    </h4>
                                    <div className="flex items-center justify-between">
                                      <span className={`text-xs ${
                                        isOwnMessage ? "text-black/70" : "text-gray-400"
                                      }`}>
                                        {message.metadata.serviceCategory}
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
                            <p className="text-sm">{message.content}</p>
                          </div>
                          <div className={`flex items-center gap-2 mt-1 text-xs text-gray-500 ${
                            isOwnMessage ? 'justify-end' : 'justify-start'
                          }`}>
                            {!isOwnMessage && (
                              <>
                                <span>{participantName}</span>
                                <span>•</span>
                              </>
                            )}
                            <span>{new Date(message.timestamp).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Quick Replies */}
              <div className="mb-4 p-4 bg-[#0D0D0D] rounded-xl border border-gray-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-gray-400" />
                    <h4 className="text-white font-medium text-sm">Quick Replies</h4>
                  </div>
                  <button
                    onClick={() => setShowQuickReplyManager(true)}
                    className="p-1 hover:bg-gray-800 rounded transition-colors"
                    title="Edit Quick Replies"
                  >
                    <Edit2 className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
                <div className="space-y-2">
                  {quickReplies.length > 0
                    ? quickReplies.map((reply) => (
                        <button
                          key={reply.id}
                          onClick={async () => {
                            await handleSendMessage(reply.content);
                            messagingApi.useQuickReply(reply.id).catch(() => {});
                          }}
                          disabled={isBlocked}
                          title={isBlocked ? blockReason : reply.content}
                          className={`w-full p-2 text-left text-sm text-gray-300 bg-[#1A1A1A] rounded-lg transition-colors truncate ${
                            isBlocked ? "opacity-50 cursor-not-allowed" : "hover:bg-[#2A2A2A]"
                          }`}
                        >
                          {reply.content}
                        </button>
                      ))
                    : (
                        <p className="text-gray-500 text-xs text-center py-2">
                          No quick replies yet. Click ✏️ to create one.
                        </p>
                      )
                  }
                </div>
              </div>

              {/* Message Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isBlocked && inputValue.trim()) {
                      handleSendMessage(inputValue);
                      setInputValue('');
                    }
                  }}
                  placeholder={isBlocked ? blockReason : "Type a message..."}
                  disabled={isBlocked}
                  className={`flex-1 px-4 py-3 bg-[#1A1A1A] border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00]/50 transition-colors ${
                    isBlocked ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                />
                <button
                  onClick={() => {
                    if (inputValue.trim() && !isBlocked) {
                      handleSendMessage(inputValue);
                      setInputValue('');
                    }
                  }}
                  disabled={!inputValue.trim() || isBlocked}
                  title={isBlocked ? blockReason : "Send message"}
                  className={`px-4 py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    isBlocked
                      ? "bg-gray-700 text-gray-500"
                      : "bg-[#FFCC00] text-black hover:bg-[#FFD700]"
                  }`}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500 text-sm">Unable to load conversation</p>
            </div>
          )
        )}
        {activeTab === 'timeline' && (
          <div className="p-4">
            <BookingTimelineTab booking={booking} />
          </div>
        )}
      </div>

      {/* Quick Reply Manager Modal */}
      {showQuickReplyManager && (
        <QuickReplyManager
          onClose={() => setShowQuickReplyManager(false)}
          onRepliesUpdated={fetchQuickReplies}
        />
      )}
    </div>
  );
};
