// backend/src/domains/AIAgentDomain/services/ConversationHistoryScrubber.ts
//
// Phase 3 Task 10 fix-5 — strip specific time mentions from past assistant
// messages before sending the conversation history to Claude.
//
// Why: when a previous AI reply said "How does Thursday at 9:00 AM sound?",
// Claude reads that history on subsequent turns and pattern-matches its own
// past output — anchoring on "9:00 AM" even when the customer's NEW message
// asks for a different time. Fix-4 reordered the slot list to put preferred
// slots first, which helps Claude pick correctly when the slots are reranked.
// But conversation-history anchoring is a separate failure mode: Claude can
// re-suggest 9 AM by copy-pasting from its own past turn, regardless of what
// slot list it's looking at.
//
// The scrub:
//   1. Only touches role='assistant' messages (past AI turns). Customer
//      messages must stay verbatim — that's the prompt the AI is replying to.
//   2. Replaces "9 AM", "9:00 AM", "9 a.m.", "10pm", etc. with a neutral
//      placeholder so Claude knows there was a previous slot mention without
//      seeing the specific time.
//   3. Leaves day names ("Thursday") + everything else intact — Claude can
//      still see "we discussed Thursday" but not "Thursday at 9 AM".
//
// Note: this scrub is INVISIBLE to the customer. The actual messages.message_text
// rows in the DB are unchanged; we only modify the in-memory copy passed to
// Claude.

import { ChatMessage } from "../types";

/**
 * Match common time-of-day mentions in chat text. Captures:
 *   "9 AM", "9 PM", "9am", "9pm"
 *   "9:00 AM", "9:30 PM", "10:15 a.m."
 *   "9 a.m.", "9 p.m."
 *
 * Word boundary at start; negative-letter lookahead at end (instead of `\b`)
 * so the trailing "." in dotted forms ("a.m.") is captured into the match.
 * `\b` doesn't fire between two non-word chars (`.` then ` `), which would
 * leave a stray trailing dot behind. The `(?![A-Za-z])` says "next character
 * is not a letter", which lets the match include the trailing dot AND keeps
 * us from over-matching strings like "9PMABC" where letters continue.
 *
 * Case-insensitive via /i flag.
 */
// Two AM/PM variants kept distinct so dotted forms ("a.m.") consume both
// periods, while bare forms ("AM") leave sentence-ending periods alone:
//   "9 a.m." — dotted alternative matches "a.m." entirely
//   "10 AM." — bare alternative matches "AM"; trailing "." stays as punctuation
const TIME_REGEX = /\b\d{1,2}(?::\d{2})?\s*(?:[Aa]\.[Mm]\.|[Pp]\.[Mm]\.|[AaPp][Mm])(?![A-Za-z])/g;

/**
 * Replacement placeholder. Reads naturally enough that Claude doesn't get
 * confused by the inserted text, but doesn't carry a specific time anchor.
 */
const PLACEHOLDER = "[earlier suggested time]";

export function scrubSpecificTimes(text: string): string {
  if (!text) return text;
  return text.replace(TIME_REGEX, PLACEHOLDER);
}

/**
 * One conversation-history turn as seen by the scrubber: role + content
 * plus the raw message metadata (so the scrubber can tell a booking-slot
 * proposal apart from any other message that merely happens to mention a
 * time).
 */
export interface ScrubbableMessage {
  role: "user" | "assistant";
  content: string;
  metadata?: Record<string, any> | null;
}

/**
 * Scrub past assistant messages — leave customer (user) messages alone.
 *
 * CRITICAL: only assistant messages that ACTUALLY PROPOSED A BOOKING SLOT
 * are scrubbed. A message proposed a slot iff its metadata carries a
 * non-empty `booking_suggestions` array. The original copy-paste bug
 * (Claude re-suggesting a stale "Thursday at 9 AM" from its own past
 * turn) only happens with slot-proposal messages — those are the turns
 * whose reply_text contains a specific slot time.
 *
 * Messages that mention a time but did NOT propose a slot — shop
 * operating hours ("Sun: 9 AM – 6 PM"), service durations, "we close at
 * 5 PM", etc. — are LEFT INTACT. Scrubbing those was a bug: it turned a
 * past hours answer into "[earlier suggested time]" placeholders, so on
 * the next turn Claude read its own mangled history, concluded it had
 * never actually answered, and re-dumped the hours (observed staging
 * trace 2026-05-15: customer said "thank you", AI repeated the full
 * hours block).
 *
 * Pure function — does not mutate the input array or any of its messages.
 */
export function scrubAssistantHistory(
  messages: ScrubbableMessage[]
): ChatMessage[] {
  return messages.map((m) => {
    const base: ChatMessage = { role: m.role, content: m.content };
    if (m.role !== "assistant") return base;
    const suggestions = m.metadata?.booking_suggestions;
    const proposedASlot =
      Array.isArray(suggestions) && suggestions.length > 0;
    if (!proposedASlot) return base; // not a slot proposal — leave times intact
    const cleaned = scrubSpecificTimes(m.content);
    if (cleaned === m.content) return base;
    return { role: m.role, content: cleaned };
  });
}
