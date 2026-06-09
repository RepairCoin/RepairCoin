/**
 * AI Chat Assistant - Message List
 * Scrollable container for displaying all chat messages
 */

'use client';

import React, { useEffect, useRef } from 'react';
import { useChatMessages, useIsTyping } from '@/stores/aiChatStore';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';

export const MessageList: React.FC = () => {
  const messages = useChatMessages();
  const isTyping = useIsTyping();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-[#101010]">
        <div className="text-center">
          <div className="text-5xl mb-4">🤖</div>
          <p className="text-base text-gray-300 mb-1">Hi! I'm your AI repair assistant.</p>
          <p className="text-sm text-gray-500">I can help diagnose device issues and find the best repair services for you.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-4 py-4 space-y-2 scroll-smooth bg-[#101010]"
      style={{ scrollbarWidth: 'thin' }}
    >
      {messages.map((message, index) => (
        <MessageBubble
          key={message.id}
          message={message}
          isLatest={index === messages.length - 1}
        />
      ))}

      {/* Typing indicator */}
      {isTyping && <TypingIndicator />}

      {/* Scroll anchor */}
      <div ref={messagesEndRef} />
    </div>
  );
};
