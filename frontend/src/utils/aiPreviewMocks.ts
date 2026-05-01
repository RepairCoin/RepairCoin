/**
 * AI sales assistant preview mocks (Phase 1 / 2.5 — visual demo).
 *
 * These are hardcoded sample replies the "See How the AI Replies" preview
 * shows on the Create/Edit Service page when the shop owner picks a tone.
 *
 * Phase 2.5 rewrote these from 3 short generic replies into a 4-message
 * narrative sales arc per tone (greet → concern → urgency → confirm),
 * pushed further with emojis, embedded time slots, and stronger urgency
 * cues so the preview feels like real AI sales messages, not lorem-ipsum.
 *
 * The arc is deliberately marketing-demo content, not "what Claude will
 * actually do" — Phase 3 replies are single-turn responses to live
 * customer messages, not a pre-scripted 4-step funnel.
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
    "Hey! 👋 Yeah, we totally do this — it's one of our most popular services this month. Want a quick rundown or jump straight to booking?",
    "Totally fair on the price 💯 We're $89 and most jobs wrap in 30 mins. I've got Thursday at 2:30 PM open — want me to grab it for you?",
    "Heads up ⏰ — we're booked solid Mon-Wed already. Only 2 slots left this week: Thursday 2:30 PM and Friday 4:00 PM. Which one works?",
    "Locked in for Thursday at 2:30 PM ✅ You'll get a confirmation text in 30 secs, and we'll ping you 30 mins before. Anything else I can help with? 😊",
  ],
  professional: [
    "Yes, our shop offers this service. Most appointments are completed within 30 minutes. Would you like to schedule, or do you have questions first?",
    "Standard pricing is $89, with our 30-day workmanship guarantee included. We have availability Thursday at 2:30 PM or Friday at 11:00 AM — which would you prefer?",
    "Two appointment slots remain this week: Thursday 2:30 PM and Friday 11:00 AM. Both typically book within 24 hours. Shall I reserve one for you? ✅",
    "Confirmed: Thursday at 2:30 PM. You will receive a confirmation message within 60 seconds, followed by a reminder 30 minutes prior to your appointment.",
  ],
  urgent: [
    "🔥 Same-day spot just opened — 4:00 PM today. Books in the next 15 minutes get priority. Want it?",
    "⚡ $89, under an hour, done today. Last 2 slots: 4:00 PM and 5:30 PM. After 4 PM usually goes by lunch — moving fast.",
    "⏰ 3 customers booked this exact service today already. ONE spot left at 5:30 PM. Tomorrow's already 80% full. Lock it now?",
    "🎯 Booked: 5:30 PM today. Confirmation text incoming. Please arrive 5 minutes early — we'll have your repair ready to go.",
  ],
};
