// docs/tasks/strategy/voice-ai-dispatcher/qa-fixtures/fixtures.ts
//
// The 10-clip router-classification manifest (implementation.md Phase 6).
//
// Each entry maps a pre-recorded audio clip (under ./pre-recorded-audio/)
// to the domain the Haiku router is EXPECTED to classify it as. The
// `phrase` field is the exact sentence that was spoken when recording the
// clip — keep the WebM filename and the phrase in sync so a re-record is
// unambiguous. See ./pre-recorded-audio/README.md for the recording guide.
//
// replay-fixtures.ts reads this manifest, POSTs each present clip through
// /api/ai/voice/transcribe then /api/ai/dispatch, and asserts the returned
// domain equals `expectedDomain`. Router-accuracy target: > 95% (so at most
// 0 misses out of these 10 — one miss is a fail and warrants a prompt look).

export type VoiceDomain = "insights" | "marketing" | "help" | "out_of_scope";

export interface VoiceFixture {
  /** File under ./pre-recorded-audio/ — WebM/Opus, ~5-12s, <5 MB. */
  file: string;
  /** The exact phrase spoken in the clip. */
  phrase: string;
  /** What VoiceRouter.classifyDomain must return for this transcript. */
  expectedDomain: VoiceDomain;
  /**
   * Optional substring the transcription SHOULD contain (case-insensitive,
   * loose). Helps catch STT drift independent of routing. Leave undefined to
   * skip the transcript-content check for that clip.
   */
  expectTranscriptIncludes?: string;
}

// 3 Insights / 3 Marketing / 2 Help / 2 OUT_OF_SCOPE — exactly the mix
// implementation.md §4 Phase 6 calls for.
export const VOICE_FIXTURES: VoiceFixture[] = [
  // ---- Insights (questions about the shop's own data) ----
  {
    file: "insights-revenue-last-week.webm",
    phrase: "What was my revenue last week?",
    expectedDomain: "insights",
    expectTranscriptIncludes: "revenue",
  },
  {
    file: "insights-top-customers.webm",
    phrase: "Who are my top customers?",
    expectedDomain: "insights",
    expectTranscriptIncludes: "customers",
  },
  {
    file: "insights-low-stock-items.webm",
    phrase: "Which items are low on stock?",
    expectedDomain: "insights",
    expectTranscriptIncludes: "stock",
  },

  // ---- Marketing (campaigns / outreach / promotions) ----
  {
    file: "marketing-black-friday-campaign.webm",
    phrase: "Make a Black Friday campaign, twenty percent off all services.",
    expectedDomain: "marketing",
    expectTranscriptIncludes: "campaign",
  },
  {
    file: "marketing-winback-email.webm",
    phrase: "Email the customers who haven't booked in ninety days.",
    expectedDomain: "marketing",
    expectTranscriptIncludes: "email",
  },
  {
    file: "marketing-slow-day-promo.webm",
    phrase: "Create a promotion for our slow weekdays.",
    expectedDomain: "marketing",
    expectTranscriptIncludes: "promotion",
  },

  // ---- Help ("how do I…" / "where is…" product questions) ----
  {
    file: "help-export-bookings.webm",
    phrase: "How do I export my bookings?",
    expectedDomain: "help",
    expectTranscriptIncludes: "export",
  },
  {
    file: "help-add-a-service.webm",
    phrase: "Where do I add a new service?",
    expectedDomain: "help",
    expectTranscriptIncludes: "service",
  },

  // ---- OUT_OF_SCOPE (anything the router declines) ----
  {
    file: "oos-weather.webm",
    phrase: "What's the weather today?",
    expectedDomain: "out_of_scope",
    expectTranscriptIncludes: "weather",
  },
  {
    file: "oos-book-appointment.webm",
    phrase: "Book Alex for a screen repair at two PM.",
    expectedDomain: "out_of_scope",
    expectTranscriptIncludes: "book",
  },
];
