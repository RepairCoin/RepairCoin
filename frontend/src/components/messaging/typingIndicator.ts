// frontend/src/components/messaging/typingIndicator.ts
//
// Pure decision logic for the customer-side "AI is typing" indicator,
// extracted from ConversationThread so it can be reasoned about and
// (once the frontend gains a test harness) unit-tested in isolation.
//
// Background — the indicator is a heuristic: the customer-side chat
// shows it optimistically while it believes an AI reply is on the way.
// Two failure modes it has to avoid:
//   1. Showing on a conversation where the AI is paused (staff took
//      over, or the 30s auto race-window from a recent staff message)
//      — the AI will skip and no reply ever lands.
//   2. Showing forever — the indicator's own 30s safety timeout must
//      eventually clear it if no reply arrives.
// This module owns the "should it show right now?" decision; the
// component owns the React effect + the 30s timeout.

/** Minimal message shape this module needs — avoids importing the full
 * Message type from ConversationThread (keeps the module standalone). */
export interface TypingIndicatorMessage {
  senderType: string;
  metadata?: Record<string, any> | null;
  timestamp: string;
}

/**
 * Backend auto-pauses the AI for 30s after any non-AI shop message.
 * We use 35s client-side: the backend's 30s window plus a ~5s margin
 * for client/server clock skew. Erring toward over-suppression (briefly
 * hiding a valid indicator) is far safer than under-suppression
 * (showing a doomed indicator on a paused conversation).
 */
export const HUMAN_SHOP_PAUSE_WINDOW_MS = 35_000;

/**
 * Timestamp (ms since epoch) of the most recent NON-AI shop message in
 * the thread, or null when there is none.
 *
 * "Non-AI shop message" = senderType "shop" AND
 * metadata.generated_by !== "ai_agent" — i.e. a real staff member typed
 * it (the AI orchestrator stamps generated_by="ai_agent" on its replies).
 *
 * This derives the backend's 30s auto-pause window from the `messages`
 * array — which is RELIABLE, because the staff message rendered in the
 * customer's own thread — rather than from the conversation row's
 * cached `ai_paused_until`, which lags reality when the staff message's
 * WebSocket broadcast was missed.
 */
export function findRecentHumanShopMessageAt(
  messages: readonly TypingIndicatorMessage[]
): number | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m || m.senderType !== "shop") continue;
    if (m.metadata?.generated_by === "ai_agent") continue; // AI turn, not staff
    const t = Date.parse(m.timestamp);
    return Number.isFinite(t) ? t : null;
  }
  return null;
}

export interface ShouldAwaitAiReplyParams {
  /** Who is viewing the chat. Indicator is customer-side only. */
  currentUserType: "customer" | "shop";
  /** Server-stamped: does this conversation have an AI agent at all. */
  aiEnabled: boolean;
  /** Derived from the cached ai_paused_until conversation field. */
  aiPauseState: "active" | "auto" | "takeover";
  /** Identity fields of the latest message in the thread. */
  lastMessageId: string | null;
  lastMessageSenderType: "customer" | "shop" | null;
  lastMessageStatus: string | null;
  /** From findRecentHumanShopMessageAt — see above. */
  recentHumanShopMessageAt: number | null;
  /** Injected so the function is deterministic / testable. */
  now: number;
}

/**
 * Whether the "AI is typing" indicator should be showing right now.
 * Pure — every input is explicit, `now` is injected.
 *
 * The component applies this each time the latest message's identity
 * changes; a `true` result also arms a 30s safety timeout.
 */
export function shouldAwaitAiReply(p: ShouldAwaitAiReplyParams): boolean {
  // Shop staff don't need to watch their own AI "typing".
  if (p.currentUserType !== "customer") return false;
  // Shop has no AI configured → no AI reply is ever coming.
  if (!p.aiEnabled) return false;
  // Conversation paused per the cached signal (auto window or takeover).
  if (p.aiPauseState !== "active") return false;
  // Root-cause guard: even when the cached aiPauseState says "active"
  // (because ai_paused_until lagged), a non-AI shop message newer than
  // the 30s+margin window means the backend's auto-pause is still open
  // and the AI will skip this turn — so don't promise a reply.
  if (
    p.recentHumanShopMessageAt !== null &&
    p.now - p.recentHumanShopMessageAt < HUMAN_SHOP_PAUSE_WINDOW_MS
  ) {
    return false;
  }
  // No messages in the thread yet.
  if (!p.lastMessageId) return false;
  // A failed send never reached the server → no reply is coming.
  if (p.lastMessageStatus === "failed") return false;
  // Show the indicator only while the customer's own message is the
  // latest turn (i.e. we're waiting on the AI, not the other way).
  return p.lastMessageSenderType === "customer";
}
