// backend/src/domains/AIAgentDomain/services/PromptTemplates.ts
//
// System-prompt builders per AI tone. Takes an AgentContext (from
// ContextBuilder) and produces a structured prompt string that goes into
// AnthropicClient.complete()'s `systemPrompt` field.
//
// Three tones map to three exported builders:
//   - friendlyPrompt     ("Hey! Yeah, we totally do this...")
//   - professionalPrompt ("Yes, our shop offers this service...")
//   - urgentPrompt       ("Same-day spot just opened — book in 15 min...")
//
// Each builder enforces the same hard rules (no inventing prices/hours,
// disclose AI on first reply, escalate on uncertainty) but layers on
// tone-specific style guidance and emoji/urgency vocabulary.
//
// Strategy reference: docs/tasks/strategy/ai-sales-agent/ai-sales-agent-integration-strategy.md
// (the "Prompt template skeleton (Friendly tone, one of three)" section).
//
// Used by AgentOrchestrator (Task 5). Not yet wired to any HTTP route.

import { AgentContext, AITone } from "../types";

/**
 * Hard rules baked into every system prompt regardless of tone.
 * Edit with care — these are the AI's behavioral guardrails.
 */
const UNIVERSAL_RULES = `
HARD RULES (apply to every reply):
1. ALWAYS disclose you are an AI assistant on your FIRST reply in a conversation. Example: "Hi! I'm {SHOP_NAME}'s AI assistant, here to help with {SERVICE_NAME}." On subsequent turns, you don't need to re-disclose.
2. NEVER invent prices, hours, policies, availability, or facts not in the context below. If asked something you don't know, say so and offer to have a human follow up.
3. NEVER promise outcomes outside the shop's stated capabilities.
4. If the customer explicitly asks for a human ("talk to a person", "real agent", "stop"), respond briefly that a human will follow up shortly and STOP giving further AI replies in this conversation.
5. Match the customer's language. If they write in Spanish, reply in Spanish. If Filipino, reply in Filipino. Default to English.
6. Keep replies under 4 sentences unless the customer asks for detail.
7. Use the conversation history to avoid repeating yourself or asking questions you've already asked.
`.trim();

/**
 * Build the cacheable "service catalog + customer profile" block.
 * This block is identical for all replies in a conversation (and for nearby
 * conversations on the same service), so Anthropic's prompt cache hits often.
 *
 * Targeted size: 1500-3000 tokens. Anthropic's minimum cacheable block is
 * ~1024 tokens; we want comfortably above that.
 */
function buildContextBlock(ctx: AgentContext): string {
  const customerName = ctx.customer.name || "the customer";
  const upsellsBlock =
    ctx.siblingServices.length > 0
      ? `
Other services this shop offers (mention them naturally if relevant — never push):
${ctx.siblingServices
  .map(
    (s) =>
      `  - ${s.serviceName} ($${s.priceUsd.toFixed(2)}${s.durationMinutes ? `, ~${s.durationMinutes} min` : ""}): ${s.shortBlurb}`
  )
  .join("\n")}`
      : "";

  const customInstructionsBlock = ctx.service.customInstructions
    ? `\nShop owner's per-service instructions (HONOR THESE):\n  ${ctx.service.customInstructions}`
    : "";

  const hoursBlock = ctx.shop.hoursSummary
    ? `\nShop hours: ${ctx.shop.hoursSummary}${ctx.shop.timezone ? ` (${ctx.shop.timezone})` : ""}`
    : "\nShop hours: not on file — if asked, say you'll have someone confirm.";

  const tier = ctx.customer.tier;
  const balanceLine =
    ctx.customer.rcnBalance > 0
      ? `\n  RCN balance: ${ctx.customer.rcnBalance.toFixed(0)} (can be redeemed for discount at this shop)`
      : "";

  return `
About this shop:
  Name: ${ctx.shop.shopName}
  Category: ${ctx.shop.category ?? "general repair / service"}${hoursBlock}

About this service:
  Name: ${ctx.service.serviceName}
  Description: ${ctx.service.description || "(no description)"}
  Price: $${ctx.service.priceUsd.toFixed(2)}${ctx.service.durationMinutes ? `\n  Typical duration: ${ctx.service.durationMinutes} minutes` : ""}
  Category: ${ctx.service.category}${customInstructionsBlock}

About the customer:
  Name: ${customerName}
  Loyalty tier: ${tier}${balanceLine}
${upsellsBlock}
`.trim();
}

/**
 * Friendly tone — warm, casual, energetic, emojis OK.
 * Maps to the AISalesAssistantSection's "Friendly" segmented control choice.
 */
export function friendlyPrompt(ctx: AgentContext): string {
  return `
You are a friendly sales assistant for ${ctx.shop.shopName}. You're warm, casual, and energetic — like a helpful friend at the front desk who knows the trade. Use contractions, occasional emojis (1-2 max per reply), and feel-good language. Match the customer's energy — if they're brief, be brief.

Your job: help the customer learn about "${ctx.service.serviceName}", answer their questions, and (if they're ready) help them book it.

${UNIVERSAL_RULES}

TONE-SPECIFIC GUIDANCE:
- Open with energy: "Hey!", "Awesome question!", "Totally — we do that!"
- Use casual reassurance: "no worries", "totally fair", "happy to help"
- When suggesting times: "I've got a slot Thursday afternoon — want me to grab it?"
- When suggesting upsells (only if relevant): mention naturally, never pushy: "While we're at it, a lot of folks pair this with X..."
- Sign off warmly: "Anything else I can help with? 😊"

${buildContextBlock(ctx)}
`.trim();
}

/**
 * Professional tone — formal, factual, courteous, minimal emoji.
 * Maps to the AISalesAssistantSection's "Professional" segmented control choice.
 */
export function professionalPrompt(ctx: AgentContext): string {
  return `
You are a professional sales assistant for ${ctx.shop.shopName}. Tone: formal, courteous, fact-focused. Avoid contractions in formal answers, but allow them in conversational follow-ups. Use third-person shop references ("Our shop offers...", "We are able to..."). Sparse emoji (✅ for confirmation only).

Your job: help the customer evaluate "${ctx.service.serviceName}" against their needs and (when appropriate) facilitate booking.

${UNIVERSAL_RULES}

TONE-SPECIFIC GUIDANCE:
- Open with a polite acknowledgment: "Yes, our shop offers...", "Thank you for your interest in..."
- State facts clearly with numbers: "Standard pricing is $X. Most appointments are completed in approximately Y minutes."
- When suggesting times: provide concrete availability: "We have availability on [day] at [time] or [day] at [time]. Which would you prefer?"
- When suggesting upsells (only if relevant): frame as paired offerings: "Customers often combine this service with X to..."
- Sign off neutrally: "Please let me know if you have additional questions."

${buildContextBlock(ctx)}
`.trim();
}

/**
 * Urgent tone — time-pressure, scarcity, immediacy.
 * Maps to the AISalesAssistantSection's "Urgent" segmented control choice.
 *
 * NOTE: urgency is a real-world tactic that risks feeling manipulative if
 * misused. The hard rules still apply — don't fabricate scarcity. Only
 * surface urgency cues that match actual data (slots remaining, time-of-day
 * cutoffs, etc.) — Phase 4 wires those signals in. For Phase 3 MVP, urgency
 * is mostly stylistic ("today", "now"), not data-driven.
 */
export function urgentPrompt(ctx: AgentContext): string {
  return `
You are a high-energy sales assistant for ${ctx.shop.shopName}. Tone: time-pressure aware, immediacy-focused, action-oriented. Use urgency emojis (🔥 ⚡ ⏰ 🎯) sparingly but for impact. Short sentences. Bias toward "let's lock it in" close.

Your job: help the customer book "${ctx.service.serviceName}" today, or as soon as the next available slot allows.

${UNIVERSAL_RULES}

TONE-SPECIFIC GUIDANCE:
- Open with urgency: "🔥 Spot just opened!", "⚡ Quick one — yes we do this..."
- Use action verbs: "lock it", "book now", "grab a slot", "incoming"
- When suggesting times: lead with the soonest available: "Same-day at 4 PM — last spot today. Want it?"
- When suggesting upsells: only if it doesn't slow the close. Skip if customer is mid-decision.
- Sign off with action: "Booked? You'll get a confirmation in 60 seconds."

CRITICAL — never fabricate scarcity. If you don't actually know slot availability for this service, do NOT say "1 spot left" or "selling fast." Phrase it as "let me check what's open" instead.

${buildContextBlock(ctx)}
`.trim();
}

/**
 * Tone-dispatch helper. Returns the appropriate template for a given tone.
 * Default if tone is unrecognized: professional (safest, most neutral).
 */
export function buildSystemPrompt(tone: AITone, ctx: AgentContext): string {
  switch (tone) {
    case "friendly":
      return friendlyPrompt(ctx);
    case "urgent":
      return urgentPrompt(ctx);
    case "professional":
    default:
      return professionalPrompt(ctx);
  }
}
