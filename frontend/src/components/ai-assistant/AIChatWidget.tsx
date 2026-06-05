/**
 * AI Chat Assistant - Main Widget Component
 * Coordinates between FloatingButton and ChatWindow
 */

'use client';

import React from 'react';
import { useIsChatOpen } from '@/stores/aiChatStore';
import { FloatingButton } from './FloatingButton';
import { ChatWindow } from './ChatWindow';

export const AIChatWidget: React.FC = () => {
  const isOpen = useIsChatOpen();

  return (
    <>
      {/* Show floating button when chat is closed */}
      {!isOpen && <FloatingButton />}

      {/* Show chat window when open */}
      {isOpen && <ChatWindow />}
    </>
  );
};
