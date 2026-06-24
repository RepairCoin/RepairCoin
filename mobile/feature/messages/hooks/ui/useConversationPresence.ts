import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useRealtime } from "@/shared/providers/RealtimeProvider";

// Tell the backend which conversation the user is actively viewing, so
// MessageService suppresses push + email notifications while they're already
// looking at the thread (conversationPresenceService.isViewing). React Native
// port of frontend/src/hooks/useConversationPresence.ts.
//
// Two RN adaptations:
//   - Screen focus replaces the web's document visibilitychange: focused =
//     "viewing", blurred (navigated away / back) = "not viewing".
//   - Sends are gated on `isConnected` because the backend ignores
//     conversation:open frames until the socket has authenticated. The
//     [focusedId, isConnected] effect also re-announces presence after a
//     reconnect — the backend clears presence on disconnect, so a dropped
//     socket would otherwise leave us silently "not viewing".
export function useConversationPresence(
  conversationId: string | null | undefined
): void {
  const { isConnected, send } = useRealtime();
  const [focusedId, setFocusedId] = useState<string | null>(null);

  // Track focus: mark this conversation focused while the screen is on top,
  // and cleared on blur / unmount.
  useFocusEffect(
    useCallback(() => {
      setFocusedId(conversationId || null);
      return () => setFocusedId(null);
    }, [conversationId])
  );

  // Announce open while focused AND connected; the cleanup (blur, id change,
  // disconnect, or reconnect re-run) announces close. A close sent on a dead
  // socket is a harmless no-op — the backend already dropped our presence.
  useEffect(() => {
    if (!focusedId || !isConnected) return;

    send({ type: "conversation:open", payload: { conversationId: focusedId } });

    return () => {
      send({ type: "conversation:close", payload: { conversationId: focusedId } });
    };
  }, [focusedId, isConnected, send]);
}
