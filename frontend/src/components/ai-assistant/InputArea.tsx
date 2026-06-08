/**
 * AI Chat Assistant - Input Area
 * Text input and image upload controls
 */

'use client';

import React, { useState, useRef, KeyboardEvent } from 'react';
import { motion } from 'framer-motion';

interface InputAreaProps {
  onSendMessage: (message: string) => void;
  onImageUpload: (file: File) => void;
  disabled?: boolean;
  showImageUpload?: boolean;
}

export const InputArea: React.FC<InputAreaProps> = ({
  onSendMessage,
  onImageUpload,
  disabled = false,
  showImageUpload = true,
}) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    const trimmedMessage = message.trim();
    if (trimmedMessage && !disabled) {
      onSendMessage(trimmedMessage);
      setMessage('');
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && !disabled) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('Image size must be less than 10MB');
        return;
      }

      onImageUpload(file);

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="border-t border-gray-800 bg-[#101010] p-4">
      <div className="space-y-2">
        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={message}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Type a message..."
          rows={2}
          className={`
            w-full px-4 py-2
            bg-[#1A1A1A] border border-gray-700 rounded-lg
            text-white placeholder-gray-500
            resize-none
            focus:outline-none focus:border-[#FFCC00]
            disabled:opacity-50 disabled:cursor-not-allowed
            text-sm transition-colors
          `}
          style={{ minHeight: '60px', maxHeight: '120px' }}
        />

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {/* Image upload button */}
          {showImageUpload && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                disabled={disabled}
              />
              <motion.button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                whileHover={{ scale: disabled ? 1 : 1.05 }}
                whileTap={{ scale: disabled ? 1 : 0.95 }}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-[#1A1A1A] border-gray-700 text-gray-400 hover:text-white hover:border-[#FFCC00]/60"
                aria-label="Upload image"
              >
                📷
                <span>Photo</span>
              </motion.button>
            </>
          )}

          {/* Send button */}
          <motion.button
            type="button"
            onClick={handleSend}
            disabled={disabled || !message.trim()}
            whileHover={{ scale: disabled || !message.trim() ? 1 : 1.05 }}
            whileTap={{ scale: disabled || !message.trim() ? 1 : 0.95 }}
            className={`ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              disabled || !message.trim()
                ? 'bg-[#1A1A1A] border border-gray-800 text-gray-600 cursor-not-allowed'
                : 'bg-[#FFCC00] text-black hover:bg-[#FFD700]'
            }`}
            aria-label="Send message"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
            <span>Send</span>
          </motion.button>
        </div>

        {/* Helper text */}
        <p className="text-xs text-gray-500 text-center">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
};
