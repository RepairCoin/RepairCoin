/**
 * AI Chat Assistant - Chat Window (Expanded State)
 * Main chat interface component
 */

'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAIChatStore, useChatSession, useIsLoading, useChatError } from '@/stores/aiChatStore';
import { MessageList } from './MessageList';
import { InputArea } from './InputArea';
import { QuickActions } from './QuickActions';
import { QuickAction } from '@/types/aiChat';
import { startChatSession, sendMessage, uploadImage } from '@/services/api/aiAssistant';
import toast from 'react-hot-toast';

export const ChatWindow: React.FC = () => {
  const {
    closeChat,
    initializeSession,
    addMessage,
    setTyping,
    setLoading,
    setError,
  } = useAIChatStore();

  const session = useChatSession();
  const isLoading = useIsLoading();
  const error = useChatError();

  const [currentQuickActions, setCurrentQuickActions] = useState<QuickAction[]>([]);
  const [showImageUpload, setShowImageUpload] = useState(false);

  // Initialize chat session on mount
  useEffect(() => {
    if (!session) {
      initSession();
    }
  }, [session]);

  const initSession = async () => {
    try {
      setLoading(true);
      const response = await startChatSession({});

      if (response.success) {
        initializeSession({
          id: response.data.sessionId,
          sessionToken: response.data.sessionToken,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastActivityAt: new Date().toISOString(),
        });

        addMessage(response.data.message);

        // Extract quick actions from initial message
        if (response.data.message.metadata?.quickActions) {
          setCurrentQuickActions(response.data.message.metadata.quickActions);
        }
      }
    } catch (err) {
      console.error('Failed to start chat session:', err);
      setError('Failed to connect. Please try again.');
      toast.error('Failed to start chat');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!session) return;

    try {
      setLoading(true);
      setTyping(true);

      const response = await sendMessage({
        sessionId: session.id,
        sessionToken: session.sessionToken,
        message,
      });

      if (response.success) {
        addMessage(response.data.userMessage);
        addMessage(response.data.assistantMessage);

        // Update quick actions
        if (response.data.assistantMessage.metadata?.quickActions) {
          setCurrentQuickActions(response.data.assistantMessage.metadata.quickActions);
        } else {
          setCurrentQuickActions([]);
        }

        // Show image upload if suggested
        if (response.data.assistantMessage.metadata?.showImageUpload) {
          setShowImageUpload(true);
        }
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message');
      toast.error('Failed to send message');
    } finally {
      setLoading(false);
      setTyping(false);
    }
  };

  const handleQuickActionClick = async (action: QuickAction) => {
    handleSendMessage(action.label);
  };

  const handleImageUpload = async (file: File) => {
    if (!session) return;

    try {
      setLoading(true);
      setTyping(true);
      toast.loading('Analyzing image...', { id: 'image-upload' });

      const response = await uploadImage({
        sessionId: session.id,
        sessionToken: session.sessionToken,
        image: file,
      });

      if (response.success) {
        // Add user message (image)
        addMessage({
          id: `msg-${Date.now()}-user`,
          sessionId: session.id,
          role: 'user',
          content: '[Uploaded image]',
          timestamp: new Date().toISOString(),
          metadata: {
            imageUrl: response.data.imageUrl,
          },
        });

        // Add AI response
        addMessage(response.data.assistantMessage);

        // Clear quick actions after image upload
        setCurrentQuickActions([]);
        setShowImageUpload(false);

        toast.success('Image analyzed!', { id: 'image-upload' });
      }
    } catch (err) {
      console.error('Failed to upload image:', err);
      setError('Failed to analyze image');
      toast.error('Failed to analyze image', { id: 'image-upload' });
    } finally {
      setLoading(false);
      setTyping(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="fixed bottom-6 right-6 z-[9999] w-[400px] h-[600px] max-w-[calc(100vw-48px)] max-h-[calc(100vh-48px)] md:max-w-[400px] md:max-h-[600px] flex flex-col bg-[#101010] rounded-2xl shadow-2xl overflow-hidden border border-gray-800"
      >
        {/* Header */}
        <div className="flex-shrink-0 bg-[#101010] border-b border-gray-800 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🤖</span>
            <div>
              <div className="font-semibold text-sm text-white">AI Repair Assistant</div>
              <div className="text-xs text-gray-400 flex items-center gap-1">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                Online
              </div>
            </div>
          </div>

          <button
            onClick={closeChat}
            className="text-gray-400 hover:text-white hover:bg-gray-800 rounded-full p-1 transition-colors"
            aria-label="Close chat"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex-shrink-0 bg-red-900/30 border-b border-red-700/60 px-4 py-2">
            <div className="text-sm text-red-300 flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Messages */}
        <MessageList />

        {/* Quick Actions */}
        {currentQuickActions.length > 0 && (
          <QuickActions
            actions={currentQuickActions}
            onActionClick={handleQuickActionClick}
            disabled={isLoading}
          />
        )}

        {/* Input Area */}
        <InputArea
          onSendMessage={handleSendMessage}
          onImageUpload={handleImageUpload}
          disabled={isLoading}
          showImageUpload={showImageUpload}
        />

        {/* Powered by badge */}
        <div className="flex-shrink-0 px-4 py-2 bg-[#1A1A1A] border-t border-gray-800">
          <div className="text-xs text-center text-gray-500">
            Powered by AI • RepairCoin
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
