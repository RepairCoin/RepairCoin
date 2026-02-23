// frontend/src/components/support/ChatInput.tsx
"use client";

import React, { useState, useRef, useEffect } from 'react';

interface ChatInputProps {
  onSend: (message: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
  showInternalCheckbox?: boolean;
  onInternalChange?: (isInternal: boolean) => void;
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Type your message...",
  showInternalCheckbox = false,
  onInternalChange
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!message.trim() || isSending || disabled) {
      return;
    }

    setIsSending(true);
    try {
      await onSend(message.trim());
      setMessage('');
      setIsInternal(false);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleInternalChange = (checked: boolean) => {
    setIsInternal(checked);
    onInternalChange?.(checked);
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-gray-700 bg-[#1A1A1A] p-4">
      {/* Internal note checkbox */}
      {showInternalCheckbox && (
        <div className="mb-2 flex items-center">
          <input
            type="checkbox"
            id="internal-note"
            checked={isInternal}
            onChange={(e) => handleInternalChange(e.target.checked)}
            className="w-4 h-4 text-[#FFCC00] bg-gray-700 border-gray-600 rounded focus:ring-[#FFCC00] focus:ring-2"
          />
          <label htmlFor="internal-note" className="ml-2 text-sm text-gray-300 flex items-center">
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                clipRule="evenodd"
              />
            </svg>
            Internal note (only visible to admins)
          </label>
        </div>
      )}

      {/* Message input */}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isSending}
          rows={1}
          className="flex-1 bg-gray-800 text-white rounded-lg px-4 py-3 resize-none max-h-32 focus:outline-none focus:ring-2 focus:ring-[#FFCC00] disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={!message.trim() || disabled || isSending}
          className="bg-[#FFCC00] text-black px-6 py-3 rounded-lg font-semibold hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {isSending ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Sending...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
              Send
            </>
          )}
        </button>
      </div>

      {/* Helper text */}
      <div className="mt-2 text-xs text-gray-500">
        Press Enter to send, Shift+Enter for new line
      </div>
    </form>
  );
}
