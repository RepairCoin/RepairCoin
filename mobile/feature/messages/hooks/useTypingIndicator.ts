import { useState, useEffect, useRef, useCallback } from "react";
import { messageApi } from "../services/message.services";

type TypingUser = {
  userAddress: string;
  userType: "customer" | "shop";
};

type UseTypingIndicatorOptions = {
  conversationId: string;
  enabled?: boolean;
  pollingInterval?: number; // ms, default 3000
  debounceDelay?: number; // ms, default 1000
};

type UseTypingIndicatorReturn = {
  /** Users currently typing (excluding self) */
  typingUsers: TypingUser[];
  /** Whether someone else is typing */
  isOtherTyping: boolean;
  /** Call this when user starts typing */
  onUserTyping: () => void;
};

export function useTypingIndicator({
  conversationId,
  enabled = true,
  pollingInterval = 10000,
  debounceDelay = 1000,
}: UseTypingIndicatorOptions): UseTypingIndicatorReturn {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentRef = useRef<number>(0);

  // Poll for typing indicators
  useEffect(() => {
    if (!enabled || !conversationId) return;

    const fetchTyping = async () => {
      try {
        const response = await messageApi.getTyping(conversationId);
        if (response.success && response.data) {
          setTypingUsers(
            response.data.map((t) => ({
              userAddress: t.userAddress,
              userType: t.userType,
            }))
          );
        }
      } catch (error) {
        // Silently fail - typing is non-critical
        console.debug("Failed to fetch typing indicators:", error);
      }
    };

    // Initial fetch
    fetchTyping();

    // Poll every interval
    const interval = setInterval(fetchTyping, pollingInterval);

    return () => clearInterval(interval);
  }, [conversationId, enabled, pollingInterval]);

  // Send typing indicator (debounced)
  const onUserTyping = useCallback(() => {
    if (!enabled || !conversationId) return;

    // Clear existing debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce to avoid spamming the API
    debounceRef.current = setTimeout(async () => {
      const now = Date.now();
      // Only send if we haven't sent in the last 5 seconds
      if (now - lastSentRef.current < 5000) return;

      try {
        await messageApi.setTyping(conversationId);
        lastSentRef.current = now;
      } catch (error) {
        // Silently fail - typing is non-critical
        console.debug("Failed to set typing indicator:", error);
      }
    }, debounceDelay);
  }, [conversationId, enabled, debounceDelay]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return {
    typingUsers,
    isOtherTyping: typingUsers.length > 0,
    onUserTyping,
  };
}
