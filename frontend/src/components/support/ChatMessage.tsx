// frontend/src/components/support/ChatMessage.tsx
"use client";

import React from 'react';
import { SupportMessage } from '@/services/api/support';
import { formatDistanceToNow } from 'date-fns';

interface ChatMessageProps {
  message: SupportMessage;
  isOwnMessage: boolean;
}

export function ChatMessage({ message, isOwnMessage }: ChatMessageProps) {
  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch (error) {
      return dateString;
    }
  };

  return (
    <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[70%] ${isOwnMessage ? 'order-2' : 'order-1'}`}>
        {/* Message bubble */}
        <div
          className={`rounded-2xl px-4 py-3 ${
            isOwnMessage
              ? 'bg-[#FFCC00] text-black'
              : 'bg-gray-700 text-white'
          }`}
        >
          {/* Sender name for admin messages */}
          {message.senderType === 'admin' && !isOwnMessage && (
            <div className="text-xs font-semibold text-gray-300 mb-1">
              {message.senderName || 'Admin'}
            </div>
          )}

          {/* System message badge */}
          {message.senderType === 'system' && (
            <div className="text-xs font-semibold text-blue-400 mb-1">
              System Message
            </div>
          )}

          {/* Message content */}
          <div className="text-sm whitespace-pre-wrap break-words">
            {message.message}
          </div>

          {/* Timestamp */}
          <div
            className={`text-xs mt-1 ${
              isOwnMessage ? 'text-gray-700' : 'text-gray-400'
            }`}
          >
            {formatTime(message.createdAt)}
            {message.readAt && isOwnMessage && (
              <span className="ml-2">✓ Read</span>
            )}
          </div>
        </div>

        {/* Internal note indicator */}
        {message.isInternal && (
          <div className="text-xs text-gray-400 mt-1 flex items-center">
            <svg
              className="w-3 h-3 mr-1"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                clipRule="evenodd"
              />
            </svg>
            Internal note
          </div>
        )}
      </div>
    </div>
  );
}
