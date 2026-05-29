// frontend/src/utils/voiceDomainHints.ts
//
// Voice AI Dispatcher Phase 5.5 — client-side keyword classifier for
// the D3 hybrid handoff inside per-panel inline mics.
//
// Why this exists:
//   - The global voice surfaces (pill / header / mobile +) always call
//     the cross-domain router (Haiku) on every Send. That's correct —
//     the user could be anywhere in the dashboard and the dispatcher
//     has to pick the right panel.
//   - The per-panel inline mic (Phase 5.5) lives INSIDE a specific
//     panel. The vast majority of follow-up turns stay in that panel
//     ("make it more urgent", "do the same for last week", "who is
//     #3 in that list"). Paying for a router call on every follow-up
//     is wasteful.
//   - This classifier runs synchronously on the transcript before any
//     network call. When the keywords match the current panel (or no
//     signals fire), the panel handles the message directly — no
//     router call, no cost. Only when keywords point at a DIFFERENT
//     domain than the current panel do we pay for the router call,
//     which then confirms the cross-domain mismatch and surfaces the
//     "send here vs open the other panel" choice card.
//
// Accuracy posture:
//   - This classifier is intentionally CHEAP, not exhaustive. False
//     negatives (signals exist but we miss them) just mean we treat
//     the message as in-domain — same as always-skip behavior. The
//     user can still re-ask in the right panel manually.
//   - False positives (signals fire for the wrong domain) get
//     corrected by the router call. So a too-aggressive classifier
//     wastes a Haiku call but doesn't mislead the user.
//   - Tie-breaks: pick the domain with the most matches. If still
//     tied, prefer insights > marketing > help (matches the rough
//     frequency we expect on real follow-ups).
//
// When the classifier returns null, the caller should TREAT THAT AS
// IN-DOMAIN — no signals = no reason to suspect cross-domain.

export type VoiceHintDomain = "insights" | "marketing" | "help";

const INSIGHTS_RX =
  /\b(revenue|sales|earned|made|grossed|profit|customer|customers|booking|bookings|order|orders|top|stats|statistics|metric|metrics|breakdown|frequency|tier|tiers|bronze|silver|gold|rcn|balance|cancellation|cancellations|no[- ]show|repeat|time of day|inventory|stock|low stock|out of stock|turnover|how many|how much|when did|which service|which customer)\b/i;

const MARKETING_RX =
  /\b(campaign|email|send (to|out|a)|win[- ]back|black friday|cyber monday|weekend special|holiday|promotion|promo|offer|discount|coupon|subject|recipients|draft|blast|newsletter|invite|lapsed|inactive|haven't been)\b/i;

const HELP_RX =
  /\b(how do i|how can i|how to|where do i|where is|where can i|what is|what does|explain|guide|tutorial|setup|set up|configure|enable|disable|change my|update my|edit my|the button|the icon|the page|tab does)\b/i;

interface DomainScore {
  domain: VoiceHintDomain;
  matches: number;
}

/**
 * Count regex matches in a string (overlapping not supported — that's
 * fine, we're scoring on distinct keyword hits).
 */
function countMatches(text: string, rx: RegExp): number {
  // Clone with the global flag so .match() returns all hits.
  const globalRx = new RegExp(
    rx.source,
    rx.flags.includes("g") ? rx.flags : rx.flags + "g"
  );
  const found = text.match(globalRx);
  return found ? found.length : 0;
}

/**
 * Classify a transcript by counting keyword hits per domain. Returns
 * the BEST matching domain or null if no signals fire.
 *
 * Tie-breaking order: insights > marketing > help. Roughly matches
 * the relative frequency we expect on real follow-ups (data questions
 * are the most common voice follow-up, help questions are rarest).
 */
export function classifyTranscriptClientSide(
  transcript: string
): VoiceHintDomain | null {
  if (!transcript || transcript.trim().length === 0) return null;

  const scores: DomainScore[] = [
    { domain: "insights", matches: countMatches(transcript, INSIGHTS_RX) },
    { domain: "marketing", matches: countMatches(transcript, MARKETING_RX) },
    { domain: "help", matches: countMatches(transcript, HELP_RX) },
  ];

  const total = scores.reduce((sum, s) => sum + s.matches, 0);
  if (total === 0) return null;

  // Sort: higher matches first, then tie-break by source order (which
  // is already insights > marketing > help in the array above).
  scores.sort((a, b) => b.matches - a.matches);
  return scores[0].matches > 0 ? scores[0].domain : null;
}
