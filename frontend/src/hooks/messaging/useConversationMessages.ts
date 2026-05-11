import { useCallback, useEffect, useRef, useState } from "react";
import * as messagingApi from "@/services/api/messaging";
import type { Message } from "@/components/messaging/ConversationThread";

// Single page size: loadMore uses offset = (page - 1) * PAGE_SIZE, so if the
// initial fetch and loadMore used different sizes the offsets would overlap
// and the "older" batch would be messages we already have.
const PAGE_SIZE = 20;

function transformMessage(
  msg: messagingApi.Message,
  currentUserId: string,
): Message {
  return {
    id: msg.messageId,
    conversationId: msg.conversationId,
    senderId: msg.senderAddress,
    senderName:
      msg.senderName ||
      (msg.senderAddress === currentUserId ? "You" : "User"),
    senderType: msg.senderType,
    content: msg.messageText,
    timestamp: msg.createdAt,
    status: msg.isRead ? "read" : "delivered",
    isSystemMessage: msg.messageType === "system",
    messageType: msg.messageType,
    metadata: msg.metadata,
    attachments:
      msg.attachments?.length > 0
        ? msg.attachments.map((a) => ({
            type: a.type || "file",
            url: a.url,
            name: a.name || "attachment",
          }))
        : undefined,
  };
}

export interface UseConversationMessagesResult {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
}

/**
 * Fetches messages for the selected conversation with:
 * - Race-safe refetch (late responses from a prior conversation are dropped)
 * - Event-driven refresh on `new-message-received` scoped to this conversation
 * - Paginated load-more
 */
export function useConversationMessages(
  selectedConversationId: string | null,
  currentUserId: string,
): UseConversationMessagesResult {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const currentPageRef = useRef(1);
  const activeIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeIdRef.current = selectedConversationId;

    if (!selectedConversationId) {
      setMessages([]);
      setHasMore(false);
      currentPageRef.current = 1;
      return;
    }

    const fetchMessages = async (isInitialLoad: boolean) => {
      const requestedId = selectedConversationId;
      try {
        if (isInitialLoad) {
          setIsLoading(true);
          currentPageRef.current = 1;
        }
        const response = await messagingApi.getMessages(requestedId, {
          page: 1,
          limit: PAGE_SIZE,
          sort: "desc",
        });

        if (activeIdRef.current !== requestedId) return;

        const latest = (response.data || [])
          .slice()
          .reverse()
          .map((m) => transformMessage(m, currentUserId));

        if (isInitialLoad) {
          setMessages(latest);
          setHasMore(response.pagination.hasMore);
        } else {
          setMessages((prev) => {
            const older = prev.filter(
              (m) => !latest.some((lm) => lm.id === m.id),
            );
            return [...older, ...latest];
          });
        }
      } catch (err) {
        console.error("Error fetching messages:", err);
      } finally {
        if (isInitialLoad && activeIdRef.current === requestedId) {
          setIsLoading(false);
        }
      }
    };

    fetchMessages(true);

    // Catchup fetch for fresh-conversation WS race. When a conversation is
    // newly created mid-session (e.g., customer clicks the service modal,
    // backend creates the conversation, the AI sends an opener reply), the
    // `message:new` broadcast for that AI reply can fire BEFORE this hook's
    // listener is attached — the page is still mid-mount and selectedConversationId
    // is still null. The listener would then never see that broadcast, so the
    // AI reply sits in the DB unrendered until the user hard-refreshes.
    //
    // A delayed second fetch (~2.5s, comfortably longer than typical AI reply
    // latency of 2-3s) backfills any messages that landed during the race.
    // Cancelled if the effect re-runs first (selection changes).
    const catchupTimer = window.setTimeout(() => {
      if (activeIdRef.current === selectedConversationId) {
        fetchMessages(false);
      }
    }, 2500);

    const onNewMessage = (e: Event) => {
      const ce = e as CustomEvent<{ conversationId?: string }>;
      // Read the ref, not the closure: matches the race-safety pattern used
      // by fetchMessages above, and avoids any chance of acting on a
      // stale closure if React batches updates oddly.
      if (ce.detail?.conversationId !== activeIdRef.current) return;
      fetchMessages(false);
    };
    window.addEventListener("new-message-received", onNewMessage);

    // Refetch whenever the WS reconnects. If we were briefly disconnected
    // (network blip, backend deploy, heartbeat-triggered reconnect), any
    // broadcasts sent during the gap were silently dropped by the backend's
    // `if (client.readyState === WebSocket.OPEN)` guard. After reconnect we
    // have no other way to learn about them — pull fresh from the DB.
    const onReconnected = () => {
      if (!activeIdRef.current) return;
      fetchMessages(false);
    };
    window.addEventListener("ws-reconnected", onReconnected);

    return () => {
      window.clearTimeout(catchupTimer);
      window.removeEventListener("new-message-received", onNewMessage);
      window.removeEventListener("ws-reconnected", onReconnected);
    };
  }, [selectedConversationId, currentUserId]);

  const loadMore = useCallback(async () => {
    if (!selectedConversationId || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const nextPage = currentPageRef.current + 1;
      const response = await messagingApi.getMessages(selectedConversationId, {
        page: nextPage,
        limit: PAGE_SIZE,
        sort: "desc",
      });

      if (activeIdRef.current !== selectedConversationId) return;

      const older = (response.data || [])
        .slice()
        .reverse()
        .map((m) => transformMessage(m, currentUserId));

      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const deduped = older.filter((m) => !existingIds.has(m.id));
        return [...deduped, ...prev];
      });
      setHasMore(response.pagination.hasMore);
      currentPageRef.current = nextPage;
    } catch (err) {
      console.error("Error loading more messages:", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [selectedConversationId, isLoadingMore, hasMore, currentUserId]);

  return {
    messages,
    setMessages,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
  };
}
