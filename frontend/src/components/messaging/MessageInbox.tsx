"use client";

import React, { useState, useCallback } from "react";
import {
  Search,
  MessageCircle,
  Clock,
  CheckCheck,
  Image as ImageIcon,
  Filter,
} from "lucide-react";

export interface Conversation {
  id: string;
  serviceId: string;
  serviceName: string;
  shopId?: string;
  shopName?: string;
  customerId?: string;
  customerName?: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  status: "active" | "resolved" | "archived";
  hasAttachment: boolean;
  participantAvatar?: string;
  participantName: string;
  isOnline?: boolean;
}

interface MessageInboxProps {
  conversations: Conversation[];
  selectedConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  userType: "customer" | "shop";
}

export const MessageInbox: React.FC<MessageInboxProps> = ({
  conversations,
  selectedConversationId,
  onSelectConversation,
  userType,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "resolved">("all");
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const handleImageError = useCallback((conversationId: string) => {
    setFailedImages(prev => new Set(prev).add(conversationId));
  }, []);

  const filteredConversations = conversations.filter((conv) => {
    const matchesSearch =
      conv.participantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.serviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.lastMessage.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter = filterStatus === "all" || conv.status === filterStatus;

    return matchesSearch && matchesFilter;
  });

  const formatTime = (timeString: string) => {
    const date = new Date(timeString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex flex-col h-full bg-[#1A1A1A] border-r border-gray-800">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-xl font-bold text-white mb-4">Messages</h2>

        {/* Search Bar */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#0A0A0A] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
          />
        </div>

        {/* Filter Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilterStatus("all")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === "all"
                ? "bg-[#FFCC00] text-black"
                : "bg-[#0A0A0A] text-gray-400 hover:text-white"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterStatus("active")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === "active"
                ? "bg-[#FFCC00] text-black"
                : "bg-[#0A0A0A] text-gray-400 hover:text-white"
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setFilterStatus("resolved")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === "resolved"
                ? "bg-[#FFCC00] text-black"
                : "bg-[#0A0A0A] text-gray-400 hover:text-white"
            }`}
          >
            Resolved
          </button>
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <MessageCircle className="w-16 h-16 text-gray-600 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No conversations</h3>
            <p className="text-sm text-gray-400">
              {searchQuery
                ? "No conversations match your search"
                : "Start a conversation with a customer or shop"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {filteredConversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => onSelectConversation(conversation.id)}
                className={`w-full p-4 hover:bg-[#0A0A0A]/50 transition-colors text-left ${
                  selectedConversationId === conversation.id
                    ? "bg-[#0A0A0A] border-l-4 border-[#FFCC00]"
                    : ""
                }`}
              >
                <div className="flex gap-3">
                  {/* Avatar - Show shop logo if available, otherwise show initial */}
                  <div className="relative flex-shrink-0">
                    {conversation.participantAvatar && !failedImages.has(conversation.id) ? (
                      <img
                        src={conversation.participantAvatar}
                        alt={conversation.participantName}
                        className="w-12 h-12 rounded-full object-cover bg-[#0A0A0A]"
                        onError={() => handleImageError(conversation.id)}
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gradient-to-br from-[#FFCC00] to-[#FFD700] rounded-full flex items-center justify-center">
                        <span className="text-black font-bold text-lg">
                          {conversation.participantName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    {conversation.isOnline && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#1A1A1A]"></div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-white truncate">
                          {conversation.participantName}
                        </h3>
                        <p className="text-xs text-gray-500 truncate">
                          {conversation.serviceName}
                        </p>
                      </div>
                      <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                        {formatTime(conversation.lastMessageTime)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-gray-400 truncate flex-1">
                        {conversation.hasAttachment && (
                          <ImageIcon className="w-3 h-3 inline mr-1" />
                        )}
                        {conversation.lastMessage}
                      </p>
                      {conversation.unreadCount > 0 && (
                        <span className="flex-shrink-0 w-5 h-5 bg-[#FFCC00] text-black text-xs font-bold rounded-full flex items-center justify-center">
                          {conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
