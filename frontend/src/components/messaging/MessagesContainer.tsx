"use client";

import React, { useState, useEffect } from "react";
import { MessageInbox, type Conversation } from "./MessageInbox";
import { ConversationThread, type Message } from "./ConversationThread";
import { MessageCircle, ArrowLeft } from "lucide-react";
import * as messagingApi from "@/services/api/messaging";

interface MessagesContainerProps {
  userType: "customer" | "shop";
  currentUserId: string;
}

export const MessagesContainer: React.FC<MessagesContainerProps> = ({
  userType,
  currentUserId,
}) => {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [showMobileThread, setShowMobileThread] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch conversations from API
  useEffect(() => {
    const fetchConversations = async (isInitialLoad = true) => {
      try {
        if (isInitialLoad) {
          setIsLoadingConversations(true);
          setError(null);
        }
        const response = await messagingApi.getConversations({ page: 1, limit: 50 });

        // Transform API response to match Conversation type
        const transformedConversations: Conversation[] = response.data.map((conv) => ({
          id: conv.conversationId,
          serviceId: "", // Will need to fetch from service orders if needed
          serviceName: "", // Will need to fetch from service orders if needed
          shopId: userType === "customer" ? conv.shopId : undefined,
          shopName: userType === "customer" ? conv.shopName : undefined,
          customerId: userType === "shop" ? conv.customerAddress : undefined,
          customerName: userType === "shop" ? conv.customerName : undefined,
          participantName: userType === "customer" ? (conv.shopName || "Shop") : (conv.customerName || "Customer"),
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

    // Initial fetch
    fetchConversations(true);

    // Poll for conversation updates every 5 seconds
    const pollInterval = setInterval(() => {
      fetchConversations(false);
    }, 5000);

    // Cleanup interval on unmount
    return () => clearInterval(pollInterval);
  }, [userType]);

  // Fetch messages when conversation is selected
  useEffect(() => {
    const fetchMessages = async (isInitialLoad = true) => {
      if (!selectedConversationId) {
        setMessages([]);
        return;
      }

      try {
        if (isInitialLoad) {
          setIsLoadingMessages(true);
        }
        const response = await messagingApi.getMessages(selectedConversationId, {
          page: 1,
          limit: 100,
        });

        // Transform API response to match Message type
        const transformedMessages: Message[] = response.data.map((msg) => ({
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
          attachments: msg.attachments?.length > 0 ? msg.attachments : undefined,
        }));

        setMessages(transformedMessages);

        // Mark conversation as read
        await messagingApi.markConversationAsRead(selectedConversationId);
      } catch (err) {
        console.error("Error fetching messages:", err);
      } finally {
        if (isInitialLoad) {
          setIsLoadingMessages(false);
        }
      }
    };

    // Initial fetch
    fetchMessages(true);

    // Poll for new messages every 3 seconds
    const pollInterval = setInterval(() => {
      if (selectedConversationId) {
        fetchMessages(false);
      }
    }, 3000);

    // Cleanup interval on unmount or conversation change
    return () => clearInterval(pollInterval);
  }, [selectedConversationId, currentUserId]);

  const selectedConversation = conversations.find((c) => c.id === selectedConversationId);

  const handleSelectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    setShowMobileThread(true);
  };

  const handleBackToInbox = () => {
    setShowMobileThread(false);
    setSelectedConversationId(null);
  };

  const handleSendMessage = async (content: string, attachments?: File[]): Promise<void> => {
    if (!selectedConversationId || !content.trim()) return;

    const newMessage = await messagingApi.sendMessage({
      conversationId: selectedConversationId,
      messageText: content,
      messageType: "text",
    });

    // Add the new message to the messages list
    const transformedMessage: Message = {
      id: newMessage.messageId,
      conversationId: newMessage.conversationId,
      senderId: newMessage.senderAddress,
      senderName: newMessage.senderName || "You",
      senderType: newMessage.senderType,
      content: newMessage.messageText,
      timestamp: newMessage.createdAt,
      status: "delivered",
      isSystemMessage: false,
    };

    setMessages((prev) => [...prev, transformedMessage]);

    // Refresh conversations to update last message preview
    const response = await messagingApi.getConversations({ page: 1, limit: 50 });
    const transformedConversations: Conversation[] = response.data.map((conv) => ({
      id: conv.conversationId,
      serviceId: "",
      serviceName: "",
      shopId: userType === "customer" ? conv.shopId : undefined,
      shopName: userType === "customer" ? conv.shopName : undefined,
      customerId: userType === "shop" ? conv.customerAddress : undefined,
      customerName: userType === "shop" ? conv.customerName : undefined,
      participantName: userType === "customer" ? (conv.shopName || "Shop") : (conv.customerName || "Customer"),
      lastMessage: conv.lastMessagePreview || "",
      lastMessageTime: conv.lastMessageAt || conv.createdAt,
      unreadCount: userType === "customer" ? conv.unreadCountCustomer : conv.unreadCountShop,
      status: conv.isArchivedCustomer || conv.isArchivedShop ? "resolved" : "active",
      hasAttachment: false,
      isOnline: false,
    }));
    setConversations(transformedConversations);
  };

  return (
    <div className="h-full flex bg-[#0A0A0A]">
      {/* Desktop Layout: Split View */}
      <div className="hidden md:flex w-full h-full">
        {/* Inbox Sidebar */}
        <div className="w-96 flex-shrink-0">
          <MessageInbox
            conversations={conversations}
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
            />
          </div>
        ) : (
          <MessageInbox
            conversations={conversations}
            selectedConversationId={selectedConversationId}
            onSelectConversation={handleSelectConversation}
            userType={userType}
          />
        )}
      </div>
    </div>
  );
};
