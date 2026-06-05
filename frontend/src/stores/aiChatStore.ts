/**
 * AI Chat Assistant - Zustand Store
 * Manages chat widget state, messages, and session data
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  ChatMessage,
  ChatSession,
  ChatWidgetState,
  ServiceRecommendation,
  ImageAnalysis,
} from '@/types/aiChat';

interface AIChatStore extends ChatWidgetState {
  // Actions
  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;
  setTyping: (isTyping: boolean) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;

  // Session management
  initializeSession: (session: ChatSession) => void;
  updateSession: (updates: Partial<ChatSession>) => void;
  endSession: () => void;

  // Message management
  addMessage: (message: ChatMessage) => void;
  addMessages: (messages: ChatMessage[]) => void;
  clearMessages: () => void;
  markAsRead: () => void;

  // Recommendations
  setRecommendations: (recommendations: ServiceRecommendation[]) => void;
  recommendations: ServiceRecommendation[];

  // Image analysis
  setAnalysis: (analysis: ImageAnalysis | null) => void;
  currentAnalysis: ImageAnalysis | null;
}

export const useAIChatStore = create<AIChatStore>()(
  persist(
    (set, get) => ({
      // Initial state
      isOpen: false,
      isMinimized: true,
      hasUnreadMessages: false,
      unreadCount: 0,
      session: null,
      messages: [],
      isTyping: false,
      isLoading: false,
      error: null,
      recommendations: [],
      currentAnalysis: null,

      // Chat visibility actions
      openChat: () => {
        set({
          isOpen: true,
          isMinimized: false,
          hasUnreadMessages: false,
          unreadCount: 0,
        });
      },

      closeChat: () => {
        set({
          isOpen: false,
          isMinimized: true,
        });
      },

      toggleChat: () => {
        const { isOpen } = get();
        if (isOpen) {
          get().closeChat();
        } else {
          get().openChat();
        }
      },

      // Loading and error states
      setTyping: (isTyping: boolean) => {
        set({ isTyping });
      },

      setLoading: (isLoading: boolean) => {
        set({ isLoading });
      },

      setError: (error: string | null) => {
        set({ error });
      },

      // Session management
      initializeSession: (session: ChatSession) => {
        set({
          session,
          messages: [],
          error: null,
        });
      },

      updateSession: (updates: Partial<ChatSession>) => {
        const { session } = get();
        if (session) {
          set({
            session: {
              ...session,
              ...updates,
              updatedAt: new Date().toISOString(),
            },
          });
        }
      },

      endSession: () => {
        set({
          session: null,
          messages: [],
          recommendations: [],
          currentAnalysis: null,
          error: null,
          isTyping: false,
          isLoading: false,
        });
      },

      // Message management
      addMessage: (message: ChatMessage) => {
        set((state) => {
          const newMessages = [...state.messages, message];

          // If chat is closed and it's an assistant message, increment unread count
          const isAssistantMessage = message.role === 'assistant';
          const shouldIncrementUnread = !state.isOpen && isAssistantMessage;

          return {
            messages: newMessages,
            hasUnreadMessages: shouldIncrementUnread || state.hasUnreadMessages,
            unreadCount: shouldIncrementUnread
              ? state.unreadCount + 1
              : state.unreadCount,
            isTyping: false, // Stop typing indicator when message arrives
          };
        });
      },

      addMessages: (messages: ChatMessage[]) => {
        set((state) => ({
          messages: [...state.messages, ...messages],
        }));
      },

      clearMessages: () => {
        set({ messages: [] });
      },

      markAsRead: () => {
        set({
          hasUnreadMessages: false,
          unreadCount: 0,
        });
      },

      // Recommendations
      setRecommendations: (recommendations: ServiceRecommendation[]) => {
        set({ recommendations });
      },

      // Image analysis
      setAnalysis: (analysis: ImageAnalysis | null) => {
        set({ currentAnalysis: analysis });
      },
    }),
    {
      name: 'ai-chat-storage', // localStorage key
      partialize: (state) => ({
        // Only persist session and messages
        session: state.session,
        messages: state.messages,
        recommendations: state.recommendations,
        currentAnalysis: state.currentAnalysis,
      }),
    }
  )
);

// Selector hooks for optimized re-renders
export const useIsChatOpen = () => useAIChatStore((state) => state.isOpen);
export const useHasUnreadMessages = () => useAIChatStore((state) => state.hasUnreadMessages);
export const useUnreadCount = () => useAIChatStore((state) => state.unreadCount);
export const useChatMessages = () => useAIChatStore((state) => state.messages);
export const useIsTyping = () => useAIChatStore((state) => state.isTyping);
export const useIsLoading = () => useAIChatStore((state) => state.isLoading);
export const useChatError = () => useAIChatStore((state) => state.error);
export const useChatSession = () => useAIChatStore((state) => state.session);
export const useRecommendations = () => useAIChatStore((state) => state.recommendations);
export const useCurrentAnalysis = () => useAIChatStore((state) => state.currentAnalysis);
