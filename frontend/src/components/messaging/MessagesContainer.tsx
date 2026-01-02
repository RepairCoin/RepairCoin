"use client";

import React, { useState } from "react";
import { MessageInbox, type Conversation } from "./MessageInbox";
import { ConversationThread, type Message } from "./ConversationThread";
import { MessageCircle, ArrowLeft } from "lucide-react";

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

  // Mock data - replace with actual API calls
  const mockConversations: Conversation[] = [
    {
      id: "1",
      serviceId: "service-1",
      serviceName: "Oil Change & Filter Replacement",
      shopId: userType === "customer" ? "shop-1" : undefined,
      shopName: userType === "customer" ? "Premium Auto Repair" : undefined,
      customerId: userType === "shop" ? "customer-1" : undefined,
      customerName: userType === "shop" ? "John Doe" : undefined,
      participantName: userType === "customer" ? "Premium Auto Repair" : "John Doe",
      lastMessage: "Thank you! See you tomorrow at 2 PM.",
      lastMessageTime: new Date(Date.now() - 300000).toISOString(), // 5 mins ago
      unreadCount: 0,
      status: "active",
      hasAttachment: false,
      isOnline: true,
    },
    {
      id: "2",
      serviceId: "service-2",
      serviceName: "Brake Inspection & Repair",
      shopId: userType === "customer" ? "shop-2" : undefined,
      shopName: userType === "customer" ? "City Motors" : undefined,
      customerId: userType === "shop" ? "customer-2" : undefined,
      customerName: userType === "shop" ? "Jane Smith" : undefined,
      participantName: userType === "customer" ? "City Motors" : "Jane Smith",
      lastMessage: "Can you provide more details about the noise?",
      lastMessageTime: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      unreadCount: 2,
      status: "active",
      hasAttachment: false,
      isOnline: false,
    },
    {
      id: "3",
      serviceId: "service-3",
      serviceName: "Tire Rotation Service",
      shopId: userType === "customer" ? "shop-1" : undefined,
      shopName: userType === "customer" ? "Premium Auto Repair" : undefined,
      customerId: userType === "shop" ? "customer-3" : undefined,
      customerName: userType === "shop" ? "Mike Johnson" : undefined,
      participantName: userType === "customer" ? "Premium Auto Repair" : "Mike Johnson",
      lastMessage: "Perfect! Your appointment is confirmed.",
      lastMessageTime: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      unreadCount: 0,
      status: "resolved",
      hasAttachment: true,
      isOnline: false,
    },
  ];

  const mockMessages: Message[] = [
    {
      id: "msg-1",
      conversationId: selectedConversationId || "1",
      senderId: userType === "customer" ? currentUserId : "shop-1",
      senderName: userType === "customer" ? "You" : "Premium Auto Repair",
      senderType: userType === "customer" ? "customer" : "shop",
      content: "Hi! I'd like to schedule an oil change for my 2020 Honda Civic.",
      timestamp: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
      status: "read",
    },
    {
      id: "msg-2",
      conversationId: selectedConversationId || "1",
      senderId: userType === "shop" ? currentUserId : "customer-1",
      senderName: userType === "shop" ? "You" : "John Doe",
      senderType: userType === "shop" ? "shop" : "customer",
      content: "Hello! We'd be happy to help. We have availability tomorrow at 2 PM or Thursday at 10 AM. Which works better for you?",
      timestamp: new Date(Date.now() - 6900000).toISOString(),
      status: "read",
    },
    {
      id: "msg-3",
      conversationId: selectedConversationId || "1",
      senderId: "system",
      senderName: "System",
      senderType: "customer",
      content: "Booking confirmed for Oil Change & Filter Replacement on March 15, 2025 at 2:00 PM",
      timestamp: new Date(Date.now() - 6600000).toISOString(),
      status: "read",
      isSystemMessage: true,
    },
    {
      id: "msg-4",
      conversationId: selectedConversationId || "1",
      senderId: userType === "customer" ? currentUserId : "shop-1",
      senderName: userType === "customer" ? "You" : "Premium Auto Repair",
      senderType: userType === "customer" ? "customer" : "shop",
      content: "Tomorrow at 2 PM works perfectly! Do I need to bring anything?",
      timestamp: new Date(Date.now() - 6300000).toISOString(),
      status: "read",
    },
    {
      id: "msg-5",
      conversationId: selectedConversationId || "1",
      senderId: userType === "shop" ? currentUserId : "customer-1",
      senderName: userType === "shop" ? "You" : "John Doe",
      senderType: userType === "shop" ? "shop" : "customer",
      content: "Just your vehicle keys and registration. We'll take care of the rest! The service typically takes 30-45 minutes.",
      timestamp: new Date(Date.now() - 5400000).toISOString(),
      status: "read",
      attachments: [
        {
          type: "image",
          url: "https://via.placeholder.com/400x300?text=Oil+Change+Checklist",
          name: "oil-change-checklist.jpg",
        },
      ],
    },
    {
      id: "msg-6",
      conversationId: selectedConversationId || "1",
      senderId: userType === "customer" ? currentUserId : "shop-1",
      senderName: userType === "customer" ? "You" : "Premium Auto Repair",
      senderType: userType === "customer" ? "customer" : "shop",
      content: "Thank you! See you tomorrow at 2 PM.",
      timestamp: new Date(Date.now() - 300000).toISOString(), // 5 mins ago
      status: "read",
    },
  ];

  const selectedConversation = mockConversations.find((c) => c.id === selectedConversationId);

  const handleSelectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    setShowMobileThread(true);
  };

  const handleBackToInbox = () => {
    setShowMobileThread(false);
    setSelectedConversationId(null);
  };

  const handleSendMessage = (content: string, attachments?: File[]) => {
    console.log("Sending message:", { content, attachments });
    // TODO: Implement actual message sending logic
  };

  return (
    <div className="h-full flex bg-[#0A0A0A]">
      {/* Desktop Layout: Split View */}
      <div className="hidden md:flex w-full h-full">
        {/* Inbox Sidebar */}
        <div className="w-96 flex-shrink-0">
          <MessageInbox
            conversations={mockConversations}
            selectedConversationId={selectedConversationId}
            onSelectConversation={handleSelectConversation}
            userType={userType}
          />
        </div>

        {/* Conversation Thread */}
        <div className="flex-1">
          {selectedConversation ? (
            <ConversationThread
              conversationId={selectedConversation.id}
              messages={mockMessages}
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
                Choose a conversation from the list to start messaging with{" "}
                {userType === "customer" ? "shops" : "customers"}
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
              messages={mockMessages}
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
            conversations={mockConversations}
            selectedConversationId={selectedConversationId}
            onSelectConversation={handleSelectConversation}
            userType={userType}
          />
        )}
      </div>
    </div>
  );
};
