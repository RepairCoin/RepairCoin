/**
 * AI Chat Assistant - Zustand Store
 * Manages chat widget state, messages, and session data.
 *
 * Threads: we keep a small ring of recent conversations (MAX_THREADS) entirely
 * in localStorage so customers can switch between them via the tab strip.
 * `session` and `messages` always mirror the currently-active thread so the
 * chat panel can read them directly without knowing about the thread ring.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  ChatMessage,
  ChatSession,
  ChatThread,
  ChatWidgetState,
  ServiceRecommendation,
  ImageAnalysis,
} from '@/types/aiChat';

const MAX_THREADS = 5;
const DEFAULT_THREAD_TITLE = 'New chat';
const TITLE_MAX_LENGTH = 24;

const deriveTitle = (content: string): string => {
  const trimmed = content.trim();
  if (!trimmed) return DEFAULT_THREAD_TITLE;
  return trimmed.length > TITLE_MAX_LENGTH
    ? `${trimmed.slice(0, TITLE_MAX_LENGTH).trimEnd()}…`
    : trimmed;
};

interface AIChatStore extends ChatWidgetState {
  // Threads (recent conversations)
  threads: ChatThread[];
  activeThreadId: string | null;

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

  // Thread management
  switchThread: (threadId: string) => void;
  deleteThread: (threadId: string) => void;

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
      threads: [],
      activeThreadId: null,
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
        set((state) => {
          const newThread: ChatThread = {
            id: session.id,
            title: DEFAULT_THREAD_TITLE,
            session,
            messages: [],
            createdAt: session.createdAt,
            lastActivityAt: session.lastActivityAt,
          };

          // Newest first, cap the ring (oldest threads drop off the end).
          const threads = [newThread, ...state.threads].slice(0, MAX_THREADS);

          return {
            threads,
            activeThreadId: session.id,
            session,
            messages: [],
            error: null,
          };
        });
      },

      updateSession: (updates: Partial<ChatSession>) => {
        const { session } = get();
        if (session) {
          const updatedSession: ChatSession = {
            ...session,
            ...updates,
            updatedAt: new Date().toISOString(),
          };
          set((state) => ({
            session: updatedSession,
            threads: state.threads.map((t) =>
              t.id === updatedSession.id ? { ...t, session: updatedSession } : t
            ),
          }));
        }
      },

      endSession: () => {
        set({
          session: null,
          messages: [],
          activeThreadId: null,
          recommendations: [],
          currentAnalysis: null,
          error: null,
          isTyping: false,
          isLoading: false,
        });
      },

      // Thread management
      switchThread: (threadId: string) => {
        const thread = get().threads.find((t) => t.id === threadId);
        if (!thread) return;
        set({
          activeThreadId: thread.id,
          session: thread.session,
          messages: thread.messages,
          error: null,
          isLoading: false,
          isTyping: false,
          hasUnreadMessages: false,
          unreadCount: 0,
        });
      },

      deleteThread: (threadId: string) => {
        set((state) => {
          const threads = state.threads.filter((t) => t.id !== threadId);

          // Removing a non-active thread leaves the active view untouched.
          if (state.activeThreadId !== threadId) {
            return { threads };
          }

          // Removed the active thread — fall back to the most recent remaining.
          const next = threads[0] ?? null;
          return {
            threads,
            activeThreadId: next?.id ?? null,
            session: next?.session ?? null,
            messages: next?.messages ?? [],
          };
        });
      },

      // Message management
      addMessage: (message: ChatMessage) => {
        set((state) => {
          const messages = [...state.messages, message];

          // If chat is closed and it's an assistant message, increment unread count
          const isAssistantMessage = message.role === 'assistant';
          const shouldIncrementUnread = !state.isOpen && isAssistantMessage;

          const now = new Date().toISOString();
          const threads = state.threads.map((t) => {
            if (t.id !== state.activeThreadId) return t;
            // Name the thread after the customer's first message.
            const title =
              t.title === DEFAULT_THREAD_TITLE && message.role === 'user'
                ? deriveTitle(message.content)
                : t.title;
            return { ...t, title, messages, lastActivityAt: now };
          });

          return {
            messages,
            threads,
            hasUnreadMessages: shouldIncrementUnread || state.hasUnreadMessages,
            unreadCount: shouldIncrementUnread
              ? state.unreadCount + 1
              : state.unreadCount,
            isTyping: false, // Stop typing indicator when message arrives
          };
        });
      },

      addMessages: (newMessages: ChatMessage[]) => {
        set((state) => {
          const messages = [...state.messages, ...newMessages];
          const now = new Date().toISOString();
          const threads = state.threads.map((t) =>
            t.id === state.activeThreadId
              ? { ...t, messages, lastActivityAt: now }
              : t
          );
          return { messages, threads };
        });
      },

      clearMessages: () => {
        set((state) => ({
          messages: [],
          threads: state.threads.map((t) =>
            t.id === state.activeThreadId ? { ...t, messages: [] } : t
          ),
        }));
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
      version: 1,
      // Migrate the old single-session shape into the thread ring.
      migrate: (persistedState, version) => {
        const state = (persistedState ?? {}) as Partial<AIChatStore>;
        if (version < 1 && !state.threads) {
          if (state.session) {
            const session = state.session;
            state.threads = [
              {
                id: session.id,
                title: DEFAULT_THREAD_TITLE,
                session,
                messages: state.messages ?? [],
                createdAt: session.createdAt,
                lastActivityAt: session.lastActivityAt,
              },
            ];
            state.activeThreadId = session.id;
          } else {
            state.threads = [];
            state.activeThreadId = null;
          }
        }
        // Partial state is merged with defaults by zustand on rehydrate.
        return state as unknown as AIChatStore;
      },
      partialize: (state) => ({
        // Persist the thread ring + the active pointer (session/messages are
        // derived from the active thread on rehydrate).
        session: state.session,
        messages: state.messages,
        threads: state.threads,
        activeThreadId: state.activeThreadId,
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
export const useChatThreads = () => useAIChatStore((state) => state.threads);
export const useActiveThreadId = () => useAIChatStore((state) => state.activeThreadId);
export const useIsTyping = () => useAIChatStore((state) => state.isTyping);
export const useIsLoading = () => useAIChatStore((state) => state.isLoading);
export const useChatError = () => useAIChatStore((state) => state.error);
export const useChatSession = () => useAIChatStore((state) => state.session);
export const useRecommendations = () => useAIChatStore((state) => state.recommendations);
export const useCurrentAnalysis = () => useAIChatStore((state) => state.currentAnalysis);
