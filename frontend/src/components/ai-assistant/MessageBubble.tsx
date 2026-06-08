/**
 * AI Chat Assistant - Message Bubble
 * Individual message display component
 */

'use client';

import React from 'react';
import { ChatMessage } from '@/types/aiChat';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

interface MessageBubbleProps {
  message: ChatMessage;
  isLatest?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isLatest = false }) => {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  const formatTime = (timestamp: string) => {
    try {
      return format(new Date(timestamp), 'h:mm a');
    } catch {
      return '';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <div className={`flex ${isUser ? 'flex-row-reverse' : 'flex-row'} items-end max-w-[85%] gap-2`}>
        {/* Avatar */}
        {isAssistant && (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#1A1A1A] border border-gray-700 flex items-center justify-center text-white text-lg">
            🤖
          </div>
        )}
        {isUser && (
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#FFCC00] flex items-center justify-center text-black text-lg">
            👤
          </div>
        )}

        {/* Message content */}
        <div className="flex flex-col">
          <div
            className={`px-4 py-2 rounded-lg ${
              isUser
                ? 'bg-[#FFCC00] text-black'
                : 'bg-[#1A1A1A] border border-gray-800 text-gray-200'
            }`}
          >
            {/* Image preview if present */}
            {message.metadata?.imageUrl && (
              <div className="mb-2">
                <img
                  src={message.metadata.imageUrl}
                  alt="Uploaded"
                  className="max-w-full rounded-lg max-h-48 object-cover border border-gray-700"
                />
              </div>
            )}

            {/* Message text */}
            <div className="text-sm whitespace-pre-line break-words">
              {message.content}
            </div>

            {/* Analysis result if present */}
            {message.metadata?.analysis && (
              <div className="mt-3 p-3 bg-black/40 border border-gray-700 rounded-lg text-xs space-y-1">
                <div className="font-semibold text-[#FFCC00]">📊 AI Analysis:</div>
                <div>Device: {message.metadata.analysis.deviceModel || message.metadata.analysis.deviceType}</div>
                <div>Issue: {message.metadata.analysis.damageType.replace('_', ' ')}</div>
                <div>Severity: {message.metadata.analysis.severity} ({message.metadata.analysis.severityScore}/10)</div>
                <div>Confidence: {Math.round(message.metadata.analysis.confidence * 100)}%</div>
              </div>
            )}
          </div>

          {/* Timestamp */}
          <div className={`text-xs text-gray-500 mt-1 px-1 ${isUser ? 'text-right' : 'text-left'}`}>
            {formatTime(message.timestamp)}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
