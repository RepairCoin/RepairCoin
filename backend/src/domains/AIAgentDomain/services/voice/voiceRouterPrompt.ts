// backend/src/domains/AIAgentDomain/services/voice/voiceRouterPrompt.ts
//
// System prompt for the Voice AI Dispatcher cross-domain router (Phase 3).
// One stable string, never per-shop personalized, so Anthropic prompt cache
// can hit it on every dispatch.
//
// The router runs on Haiku (claude-haiku-4-5-20251001) — it's a 4-way
// classification, not generative answering. Cheap, fast, and well within
// what Haiku handles cleanly.
//
// Output contract: ONE of these literal labels, no surrounding prose:
//   INSIGHTS      — shop data questions (revenue, customers, bookings,
//                   services, inventory, AI assistant impact)
//   MARKETING     — campaign drafting, sending, win-back outreach,
//                   promotional offers
//   HELP          — how-to / product feature questions
//   OUT_OF_SCOPE  — anything else (booking actions, inventory edits,
//                   general chat, off-platform topics)
//
// If Haiku returns anything else, the controller normalizes to
// OUT_OF_SCOPE and logs the unparseable response for prompt tuning.

export const VOICE_ROUTER_LABELS = [
  "INSIGHTS",
  "MARKETING",
  "HELP",
  "OUT_OF_SCOPE",
] as const;

export type VoiceRouterLabel = (typeof VOICE_ROUTER_LABELS)[number];

/**
 * Map a router label to the lowercase domain key used by the frontend
 * (and the ai_dispatch_audit.router_decision column).
 */
export function labelToDomain(
  label: VoiceRouterLabel
): "insights" | "marketing" | "help" | "out_of_scope" {
  switch (label) {
    case "INSIGHTS":
      return "insights";
    case "MARKETING":
      return "marketing";
    case "HELP":
      return "help";
    case "OUT_OF_SCOPE":
      return "out_of_scope";
  }
}

/**
 * Parse Haiku's response into a known label. Trims whitespace, normalizes
 * common variations (case, punctuation). Returns null when nothing matches —
 * the controller then records `router_decision = 'error'` in the audit row
 * and returns `out_of_scope` to the client (graceful degradation).
 */
export function parseRouterLabel(rawText: string): VoiceRouterLabel | null {
  if (!rawText) return null;
  // Strip whitespace + trailing punctuation + lowercase for matching.
  const cleaned = rawText.trim().replace(/[.!,;:?]+$/g, "").toUpperCase();
  for (const label of VOICE_ROUTER_LABELS) {
    if (cleaned === label) return label;
  }
  // Generous match — Haiku occasionally prepends "Domain:" or wraps in
  // a sentence. Take the first label that appears in the text.
  for (const label of VOICE_ROUTER_LABELS) {
    if (cleaned.includes(label)) return label;
  }
  return null;
}

export const VOICE_ROUTER_SYSTEM_PROMPT = `You are a routing assistant for a shop owner's voice command in the RepairCoin shop dashboard. Your only job is to classify the command into ONE of four domains.

# The four domains

- **INSIGHTS** — questions about the shop's own data. Examples:
  - "What's my revenue this week?"
  - "Who are my top customers?"
  - "How many bookings did I get last month?"
  - "What inventory is running low?"
  - "Show me my AI assistant's impact"
  - "What services are most popular?"

- **MARKETING** — drafting / sending / planning a marketing message. Examples:
  - "Create a Black Friday campaign"
  - "Email my lapsed customers a discount"
  - "Send a promo to customers who haven't booked in 30 days"
  - "Draft a slow-day offer"
  - "Win back inactive customers"

- **HELP** — how-to / where-is / what-is questions about the platform features. Examples:
  - "How do I add a service?"
  - "Where do I change my hours?"
  - "How do I export my customer list?"
  - "What is RCN?"
  - "How does the booking flow work?"

- **OUT_OF_SCOPE** — anything else. Examples:
  - "Book Alex Johnson for 2pm tomorrow" (booking actions aren't routed yet)
  - "Update the price of my screen-replacement service" (inventory / service edits aren't routed yet)
  - "What's the weather?"
  - "Tell me a joke"
  - Anything off-platform or about the user's personal life.

# Output rules

Respond with **exactly one** of these literal labels and **nothing else**:

INSIGHTS
MARKETING
HELP
OUT_OF_SCOPE

No prose. No "Domain: ". No punctuation. Just the label.

# Edge cases

- If the command mixes domains (e.g. "Show me top customers, then email them"), pick the domain that comes FIRST in the user's request — that's what they want to do now; follow-ups can be re-asked.
- If the command is ambiguous, prefer the domain whose tools could PARTIALLY answer it over OUT_OF_SCOPE. E.g. "Tell me about my customers" → INSIGHTS (top_customers / repeat_customer_analysis tools can handle it).
- If the command is genuinely off-platform or asks for an action no v1 panel supports (booking actions, inventory edits, customer support, payments), it's OUT_OF_SCOPE.`;
