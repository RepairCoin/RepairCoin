/**
 * AI sales assistant preview mocks (Phase 1 only — visual demo).
 *
 * These are hardcoded sample replies the "See How the AI Replies" preview
 * shows on the Create/Edit Service page when the shop owner picks a tone.
 *
 * Phase 3 replaces these with live calls to the Anthropic API via the
 * `POST /api/ai/preview` endpoint described in
 * `docs/tasks/strategy/ai-sales-agent/ai-sales-agent-integration-strategy.md`.
 *
 * Until then, the strings here let stakeholders see and feel the tone
 * differences in the new UI without depending on a live LLM.
 */

import type { AITone } from "@/services/api/services";

// Re-export so existing consumers that imported AITone from this file still work.
export type { AITone };

export const AI_PREVIEW_MOCKS: Record<AITone, string[]> = {
  friendly: [
    "Hey! Yeah, we totally do this — usually takes about 30-45 mins. Want me to find you a spot this week?",
    "We can do that quickly and safely for you. Want to add optional protection while we're at it?",
    "Most jobs like this come in around the price you saw. Want me to walk you through what's included?",
  ],
  professional: [
    "Your device repair will take approximately 30-45 minutes. We also offer optional protection upgrades.",
    "We can complete your repair quickly and safely. Would you like to include a screen protector?",
    "Estimated repair is under 45 minutes. Optional add-ons are available for extended protection.",
  ],
  urgent: [
    "We can usually fit this in same-day if you book in the next hour — want me to lock in a slot?",
    "Same-day service is limited. Want me to check what we have open right now?",
    "Most repairs of this type are done in under an hour. Booking now keeps you ahead of the queue.",
  ],
};
