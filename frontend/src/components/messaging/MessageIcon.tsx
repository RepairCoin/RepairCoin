'use client';

import React, { useState, useEffect } from 'react';
import { MessageCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import * as messagingApi from '@/services/api/messaging';

export const MessageIcon: React.FC = () => {
  const router = useRouter();
  const { userType } = useAuthStore();
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread message count
  useEffect(() => {
    // Don't fetch if userType is not set
    if (!userType || (userType !== 'customer' && userType !== 'shop')) {
      return;
    }

    const fetchUnreadCount = async () => {
      try {
        const response = await messagingApi.getConversations({ page: 1, limit: 100 });

        // Calculate total unread count based on user type
        const totalUnread = response.data.reduce((sum, conv) => {
          if (userType === 'customer') {
            return sum + (conv.unreadCountCustomer || 0);
          } else if (userType === 'shop') {
            return sum + (conv.unreadCountShop || 0);
          }
          return sum;
        }, 0);

        setUnreadCount(totalUnread);
      } catch (err) {
        console.error('[MessageIcon] Error fetching unread message count:', err);
      }
    };

    // Initial fetch
    fetchUnreadCount();

    // Poll for updates every 10 seconds
    const pollInterval = setInterval(fetchUnreadCount, 10000);

    // Cleanup interval on unmount
    return () => clearInterval(pollInterval);
  }, [userType]);

  const handleClick = () => {
    if (userType === 'customer') {
      router.push('/customer?tab=messages');
    } else if (userType === 'shop') {
      router.push('/shop?tab=messages');
    }
  };

  return (
    <div className="relative">
      {/* Message Icon Button */}
      <button
        onClick={handleClick}
        className="relative p-2 text-gray-400 hover:text-[#FFCC00] transition-colors"
        aria-label="Messages"
      >
        {/* Message Icon */}
        <MessageCircle className="w-6 h-6" />

        {/* Unread Count Badge */}
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-blue-600 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
    </div>
  );
};
