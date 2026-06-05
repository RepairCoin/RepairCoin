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
    <div className="border-t border-gray-200 bg-white p-4">
      <div className="flex items-end gap-2">
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
              whileHover={{ scale: disabled ? 1 : 1.1 }}
              whileTap={{ scale: disabled ? 1 : 0.9 }}
              className={`
                flex-shrink-0 w-10 h-10 rounded-full
                bg-gray-100 hover:bg-gray-200 active:bg-gray-300
                flex items-center justify-center text-xl
                transition-colors duration-200
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
              aria-label="Upload image"
            >
              📷
            </motion.button>
          </>
        )}

        {/* Text input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder="Type a message..."
            rows={1}
            className={`
              w-full px-4 py-2 pr-12
              border border-gray-300 rounded-full
              resize-none overflow-hidden
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
              disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50
              text-sm
            `}
            style={{ minHeight: '40px', maxHeight: '120px' }}
          />

          {/* Character count (optional) */}
          {message.length > 200 && (
            <div className="absolute right-14 bottom-2 text-xs text-gray-400">
              {message.length}/500
            </div>
          )}
        </div>

        {/* Send button */}
        <motion.button
          type="button"
          onClick={handleSend}
          disabled={disabled || !message.trim()}
          whileHover={{ scale: disabled || !message.trim() ? 1 : 1.1 }}
          whileTap={{ scale: disabled || !message.trim() ? 1 : 0.9 }}
          className={`
            flex-shrink-0 w-10 h-10 rounded-full
            flex items-center justify-center text-xl
            transition-all duration-200
            ${
              disabled || !message.trim()
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-br from-blue-500 to-purple-600 text-white hover:shadow-lg'
            }
          `}
          aria-label="Send message"
        >
          →
        </motion.button>
      </div>

      {/* Helper text */}
      <div className="text-xs text-gray-400 mt-2 px-2">
        Press Enter to send, Shift+Enter for new line
      </div>
    </div>
  );
};
