import { useRef, useCallback } from "react";

interface UnlockedMessage {
  text: string | null;
  attachmentUrls: string[];
}

/**
 * Session-based unlock storage for encrypted messages.
 * Once a message is unlocked, it stays unlocked until the user leaves the conversation.
 * Uses useRef so state persists across re-renders without triggering them.
 */
export function useUnlockSession() {
  const unlockedMessages = useRef<Map<string, UnlockedMessage>>(new Map());

  const getUnlocked = useCallback((messageId: string): UnlockedMessage | undefined => {
    return unlockedMessages.current.get(messageId);
  }, []);

  const setUnlocked = useCallback((messageId: string, data: UnlockedMessage) => {
    unlockedMessages.current.set(messageId, data);
  }, []);

  const clearAll = useCallback(() => {
    unlockedMessages.current.clear();
  }, []);

  return { getUnlocked, setUnlocked, clearAll };
}
