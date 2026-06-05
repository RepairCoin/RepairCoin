/**
 * AI Chat Assistant - Floating Button (Minimized State)
 * Bottom-right floating button that opens the chat widget
 */

'use client';

import React from 'react';
import { useAIChatStore, useHasUnreadMessages, useUnreadCount } from '@/stores/aiChatStore';
import { motion, AnimatePresence } from 'framer-motion';

export const FloatingButton: React.FC = () => {
  const { openChat } = useAIChatStore();
  const hasUnread = useHasUnreadMessages();
  const unreadCount = useUnreadCount();

  return (
    <motion.button
      onClick={openChat}
      className="fixed bottom-6 right-6 z-[9998] group"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 20,
      }}
      aria-label="Open AI Assistant"
    >
      {/* Main button circle */}
      <div className="relative">
        {/* Pulse animation on first load */}
        <motion.div
          className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 opacity-75"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.75, 0.3, 0.75],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            repeatType: 'loop',
          }}
        />

        {/* Button itself */}
        <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg flex items-center justify-center text-white text-3xl transform transition-transform group-hover:shadow-xl">
          <span className="relative z-10">🤖</span>
        </div>

        {/* Unread badge */}
        <AnimatePresence>
          {hasUnread && unreadCount > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow-md"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Tooltip */}
      <div className="absolute bottom-full right-0 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="bg-gray-900 text-white text-sm px-3 py-2 rounded-lg shadow-lg whitespace-nowrap">
          Need help? Chat with AI Assistant
          <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
        </div>
      </div>
    </motion.button>
  );
};
