// backend/src/domains/AdsDomain/services/leadConversationState.ts
//
// PURE conversation-state derivation for the lead inbox / attention queue (Part B redesign, P2). This
// is the SECOND axis, independent of the sales pipeline stage (new/contacted/booked/...). It answers
// "what's happening in the conversation, and does a human need to step in?" — derived from the last
// message + the campaign's AI settings, NOT from a stored status.
// See docs/tasks/strategy/ads-system/ads-lead-conversation-attention-redesign.md.

export type ConversationState =
  | 'awaiting_ai'   // captured, AI is set to greet — first message imminent
  | 'ai_engaged'    // last message was ours (AI/human) — waiting on the customer
  | 'needs_human'   // last message is an unanswered customer reply (AI off/paused/failed) — ACTIONABLE
  | 'dormant'       // we spoke last, but the customer went quiet past the dormancy window
  | 'quiet';        // no messages and no AI outreach queued — a human needs to start

export interface ConversationStateInput {
  hasMessages: boolean;
  lastDirection: 'inbound' | 'outbound' | null;
  /** epoch ms of the last message (for dormancy). */
  lastAtMs: number | null;
  /** True when this campaign will auto-send the first outreach (auto mode + flag on). */
  aiWillInitiate: boolean;
  /** Escalation (P3): a hot lead (booking intent) — forces needs_human even if the AI answered. */
  escalated?: boolean;
  nowMs: number;
  dormantDays?: number;
}

/** PURE: derive the conversation state. "needs_human" is the actionable queue — a customer reply that
 *  nobody (not even the AI) has answered, or an escalated (hot) lead. AI-sent-and-waiting-on-the-customer
 *  is calm (ai_engaged). */
export function deriveConversationState(input: ConversationStateInput): ConversationState {
  const dormantMs = (input.dormantDays ?? 7) * 86400000;
  if (input.escalated) return 'needs_human'; // hot lead — a human should close it, even if the AI replied
  if (!input.hasMessages) return input.aiWillInitiate ? 'awaiting_ai' : 'quiet';
  if (input.lastDirection === 'inbound') return 'needs_human';
  // last message was outbound (ours) → waiting on the customer
  if (input.lastAtMs != null && input.nowMs - input.lastAtMs > dormantMs) return 'dormant';
  return 'ai_engaged';
}

/** True when a state belongs in the shop's "needs you" queue (a human should act now). */
export function needsHuman(state: ConversationState): boolean {
  return state === 'needs_human' || state === 'quiet';
}
