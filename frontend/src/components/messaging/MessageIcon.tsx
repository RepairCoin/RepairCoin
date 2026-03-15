'use client';

import React, { useState, useEffect } from 'react';
import { MessageCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import * as messagingApi from '@/services/api/messaging';
import { MessagePreviewDropdown } from './MessagePreviewDropdown';

export const MessageIcon: React.FC = () => {
  const { userType, switchingAccount } = useAuthStore();
  const [unreadCount, setUnreadCount] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Fetch unread message count
  useEffect(() => {
    // Don't fetch if userType is not set or during account switch
    if (!userType || (userType !== 'customer' && userType !== 'shop') || switchingAccount) {
      return;
    }

    const fetchUnreadCount = async () => {
      try {
        // Use lightweight endpoint instead of fetching all conversations
        const count = await messagingApi.getUnreadCount();
        setUnreadCount(count);
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
  }, [userType, switchingAccount]);

  const handleClick = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  return (
    <div className="relative">
      {/* Message Icon Button */}
      <button
        onClick={handleClick}
        className="relative p-2.5 rounded-full bg-[#FFCC00] text-[#1e1f22] hover:bg-[#e6b800] transition-all duration-300 lg:shadow-[0_2px_8px_4px_#101010]"
        aria-label="Messages"
      >
        {/* Message Icon */}
        <MessageCircle className="w-6 h-6" />

        {/* Unread Count Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold leading-none text-white bg-red-600 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Message Preview Dropdown */}
      <MessagePreviewDropdown
        isOpen={isDropdownOpen}
        onClose={() => setIsDropdownOpen(false)}
        unreadCount={unreadCount}
      />
    </div>
  );
};
