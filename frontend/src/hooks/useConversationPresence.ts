import { useEffect, useRef } from 'react';
import { sendWS } from '@/utils/wsClient';

/**
 * Tell the backend which conversation the current user is actively viewing,
 * so MessageService can suppress email notifications while the recipient is
 * already looking at the thread.
 *
 * - Sends `conversation:open` when `conversationId` becomes truthy/changes.
 * - Sends `conversation:close` for the previous id on change / unmount.
 * - On tab hide (visibilitychange), treats as closed; on show, reopens.
 * - If the WS isn't open yet (e.g. reconnecting), the send is a no-op; the
 *   backend will see the next successful open. Worst case: one extra email.
 */
export function useConversationPresence(conversationId: string | null | undefined): void {
  const activeIdRef = useRef<string | null>(null);

  useEffect(() => {
    const id = conversationId || null;

    if (activeIdRef.current && activeIdRef.current !== id) {
      sendWS({ type: 'conversation:close', payload: { conversationId: activeIdRef.current } });
    }

    if (id) {
      sendWS({ type: 'conversation:open', payload: { conversationId: id } });
    }

    activeIdRef.current = id;

    const handleVisibility = () => {
      const current = activeIdRef.current;
      if (!current) return;
      if (document.visibilityState === 'hidden') {
        sendWS({ type: 'conversation:close', payload: { conversationId: current } });
      } else if (document.visibilityState === 'visible') {
        sendWS({ type: 'conversation:open', payload: { conversationId: current } });
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (activeIdRef.current) {
        sendWS({ type: 'conversation:close', payload: { conversationId: activeIdRef.current } });
        activeIdRef.current = null;
      }
    };
  }, [conversationId]);
}
