'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, ChevronRight, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import * as messagingApi from '@/services/api/messaging';
import type { Conversation } from '@/services/api/messaging';

interface MessagePreviewDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  unreadCount: number;
}

export const MessagePreviewDropdown: React.FC<MessagePreviewDropdownProps> = ({
  isOpen,
  onClose,
  unreadCount,
}) => {
  const router = useRouter();
  const { userType } = useAuthStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch recent conversations when dropdown opens
  useEffect(() => {
    if (isOpen && userType) {
      fetchConversations();
    }
  }, [isOpen, userType]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const response = await messagingApi.getConversations({ page: 1, limit: 5 });
      setConversations(response.data);
    } catch (err) {
      console.error('[MessagePreviewDropdown] Error fetching conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSeeAllMessages = () => {
    if (userType === 'customer') {
      router.push('/customer?tab=messages');
    } else if (userType === 'shop') {
      router.push('/shop?tab=messages');
    }
    onClose();
  };

  const handleConversationClick = (conversationId: string) => {
    if (userType === 'customer') {
      router.push(`/customer?tab=messages&conversation=${conversationId}`);
    } else if (userType === 'shop') {
      router.push(`/shop?tab=messages&conversation=${conversationId}`);
    }
    onClose();
  };

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return '';

    const date = new Date(timestamp);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / 60000);
    const diffInHours = Math.floor(diffInMs / 3600000);
    const diffInDays = Math.floor(diffInMs / 86400000);

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getUnreadCount = (conv: Conversation) => {
    if (userType === 'customer') {
      return conv.unreadCountCustomer;
    } else if (userType === 'shop') {
      return conv.unreadCountShop;
    }
    return 0;
  };

  const getOtherPartyName = (conv: Conversation) => {
    if (userType === 'customer') {
      return conv.shopName || 'Shop';
    } else if (userType === 'shop') {
      return conv.customerName || 'Customer';
    }
    return 'Unknown';
  };

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-2 w-96 bg-[#101010] rounded-xl border border-gray-800 shadow-2xl z-50 overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 bg-[#1a1a1a]">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold text-lg">Messages</h3>
          {unreadCount > 0 && (
            <span className="px-2 py-1 text-xs font-bold text-white bg-blue-600 rounded-full">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      </div>

      {/* Conversations List */}
      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-[#FFCC00] animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <MessageCircle className="w-12 h-12 text-gray-600 mb-3" />
            <p className="text-gray-400 text-sm text-center">No messages yet</p>
            <p className="text-gray-500 text-xs text-center mt-1">
              Your conversations will appear here
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {conversations.map((conv) => {
              const unread = getUnreadCount(conv);
              const otherPartyName = getOtherPartyName(conv);

              return (
                <button
                  key={conv.conversationId}
                  onClick={() => handleConversationClick(conv.conversationId)}
                  className="w-full px-4 py-3 hover:bg-[#1a1a1a] transition-colors text-left flex items-start gap-3 group"
                >
                  {/* Avatar */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#FFCC00] flex items-center justify-center text-[#101010] font-bold text-sm">
                    {otherPartyName.charAt(0).toUpperCase()}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1">
                      <p className={`text-sm font-medium truncate ${unread > 0 ? 'text-white' : 'text-gray-300'}`}>
                        {otherPartyName}
                      </p>
                      <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                        {formatTimestamp(conv.lastMessageAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className={`text-xs truncate ${unread > 0 ? 'text-gray-300 font-medium' : 'text-gray-500'}`}>
                        {conv.lastMessagePreview || 'No messages yet'}
                      </p>
                      {unread > 0 && (
                        <span className="flex-shrink-0 ml-2 px-2 py-0.5 text-xs font-bold text-white bg-blue-600 rounded-full">
                          {unread}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Arrow */}
                  <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-[#FFCC00] transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer - See All Messages Button */}
      {conversations.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-800 bg-[#1a1a1a]">
          <button
            onClick={handleSeeAllMessages}
            className="w-full py-2.5 bg-[#FFCC00] hover:bg-[#e6b800] text-[#101010] font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <span>See All Messages</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
