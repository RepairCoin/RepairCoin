// backend/src/domains/AdsDomain/services/leadIntent.ts
//
// PURE booking-intent detection for escalation (Part B redesign, P3). A deterministic keyword pass
// (no model call) over an inbound reply — cheap, testable, and good enough to flag a hot lead for a
// human to close. When it hits, the conversation is escalated → 'needs_human' + a high-urgency push.
// See docs/tasks/strategy/ads-system/ads-lead-conversation-attention-redesign.md.

// Signals that the customer is ready to transact / book (word-boundary matched, case-insensitive).
const INTENT_PATTERNS: RegExp[] = [
  /\bbook(ing|ed)?\b/, /\bappointment\b/, /\bschedul(e|ing)\b/, /\breserve\b/,
  /\bhow much\b/, /\bprice|pricing|cost|quote\b/, /\bavailab(le|ility)\b/,
  /\bwhen can\b/, /\bwhat time\b/, /\btoday|tomorrow|this week\b/,
  /\bready to\b/, /\bsign( |-)?up\b/, /\bbuy|purchase|order\b/, /\bget started\b/,
  /\bcome in\b/, /\bstop by\b/, /\bwalk( |-)?in\b/,
];

/** PURE: does this inbound text signal booking / buying intent? */
export function detectBookingIntent(text: string | null | undefined): boolean {
  const s = (text || '').toLowerCase();
  if (!s.trim()) return false;
  return INTENT_PATTERNS.some((re) => re.test(s));
}
