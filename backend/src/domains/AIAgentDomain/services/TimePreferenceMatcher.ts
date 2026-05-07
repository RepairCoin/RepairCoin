// backend/src/domains/AIAgentDomain/services/TimePreferenceMatcher.ts
//
// Phase 3 Task 10 fix-4 — detect time-of-day preference in a customer's
// message and reorder the availability slots so matching ones land first.
//
// Why reorder instead of trusting the prompt: pure prompt rules failed to
// override Claude's recency bias. Even with explicit "NEVER suggest 9 AM as
// afternoon" instructions, Claude kept picking the first slot in the list.
// By putting the matching slots FIRST in the list, we use Claude's bias
// instead of fighting it. Slots that don't match still survive (just at the
// end) so Claude can offer them as a fallback if no matching slot exists.
//
// Detection is keyword-based, intentionally simple. We don't need fancy NLP —
// we need to flip the "earliest-first" anchor to "preferred-first" when the
// customer signaled a preference. False positives are cheap (still get a
// reasonable slot); false negatives just leave behavior unchanged.

import { AgentAvailabilitySlot } from "../types";

export type TimeBand = "morning" | "afternoon" | "evening";

export interface PreferenceDetectionResult {
  band: TimeBand | null;
  /** The phrase that matched (for logging / debugging) */
  matchedPhrase?: string;
}

/**
 * Map an HH:MM string to a band. Boundaries:
 *   morning    < 12:00
 *   afternoon  12:00 – 16:59
 *   evening    >= 17:00
 *
 * Aligns with what most English speakers mean by morning/afternoon/evening.
 * If a customer says "afternoon", they will not be happy with a 5 PM slot
 * (that's evening) — we keep afternoon strictly < 5 PM.
 */
export function bandForTime(hhmm: string): TimeBand {
  const [hStr] = hhmm.split(":");
  const hour = parseInt(hStr, 10);
  if (Number.isNaN(hour)) return "morning"; // shouldn't happen; safe default
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

// Patterns ordered most-specific first. Each entry is [regex, band, label].
// `s?` on the words allows plurals ("mornings", "evenings"). `\b` boundaries
// keep us from matching substrings like "afternoonable".
const PATTERNS: ReadonlyArray<[RegExp, TimeBand, string]> = [
  // Evening — match before "noon" patterns since "tonight" etc. are evening
  [/\b(evenings?|tonight|after\s+5|after\s+5\s*pm|5\s*pm|6\s*pm|7\s*pm|8\s*pm|nighttime|late\s+today)\b/i, "evening", "evening"],
  // Afternoon — explicit + noon-ish + afternoon-hour mentions
  [/\b(afternoons?|after\s+lunch|after\s+12|after\s+noon|noon|midday|mid-?day|lunchtime|12\s*pm|1\s*pm|2\s*pm|3\s*pm|4\s*pm)\b/i, "afternoon", "afternoon"],
  // Morning — explicit + early + morning-hour mentions
  [/\b(mornings?|early|breakfast|first\s+thing|9\s*am|10\s*am|11\s*am|before\s+lunch|before\s+noon|before\s+12)\b/i, "morning", "morning"],
];

/**
 * Detect a time-of-day preference in the customer's message. Returns null when
 * no preference is signaled — caller leaves slot ordering unchanged.
 */
export function detectTimePreference(message: string): PreferenceDetectionResult {
  if (!message) return { band: null };
  for (const [regex, band, label] of PATTERNS) {
    const match = regex.exec(message);
    if (match) {
      return { band, matchedPhrase: match[0] };
    }
  }
  return { band: null };
}

/**
 * Reorder the slot list so slots matching the customer's preference come
 * first, others follow in original order. When no preference is detected,
 * returns the original list unchanged.
 *
 * Stable sort: among matching slots, original order is preserved (so the
 * earliest matching slot is still first). Same for non-matching.
 */
export function reorderSlotsByPreference(
  slots: AgentAvailabilitySlot[],
  message: string
): { slots: AgentAvailabilitySlot[]; band: TimeBand | null; matchedPhrase?: string } {
  const detection = detectTimePreference(message);
  if (!detection.band) {
    return { slots, band: null };
  }

  const target: TimeBand = detection.band;
  const matching: AgentAvailabilitySlot[] = [];
  const others: AgentAvailabilitySlot[] = [];
  for (const slot of slots) {
    if (bandForTime(slot.time) === target) {
      matching.push(slot);
    } else {
      others.push(slot);
    }
  }

  // If no matching slot exists, original order survives — Claude will see
  // morning slots and the new prompt rules tell it to "say so honestly,
  // offer the closest match". No regression vs. previous behavior.
  if (matching.length === 0) {
    return { slots, band: target, matchedPhrase: detection.matchedPhrase };
  }

  return {
    slots: [...matching, ...others],
    band: target,
    matchedPhrase: detection.matchedPhrase,
  };
}
