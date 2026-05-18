// backend/src/domains/AIAgentDomain/types.ts
//
// Shared types for the AI Sales Agent domain. Kept domain-local rather than
// pushed to shared/interfaces because they're tightly coupled to the
// Anthropic SDK contract and only AIAgentDomain consumes them.

/**
 * Supported Claude models. Keep this in sync with what the Anthropic Console
 * exposes for the workspace and what the env vars
 * (ANTHROPIC_DEFAULT_MODEL / ANTHROPIC_FALLBACK_MODEL) actually point at.
 */
export type ClaudeModel =
  | "claude-sonnet-4-6"
  | "claude-haiku-4-5-20251001";

/**
 * One turn in the back-and-forth conversation. The system prompt is passed
 * separately as `PromptCacheable[]`, not as part of this messages array.
 */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * A block of system-prompt content. Set `cache=true` to attach
 * `cache_control: { type: 'ephemeral' }` so Anthropic caches the block for
 * ~5 minutes — drops cost ~90% on repeated calls with the same prefix.
 *
 * Per-call use:
 *   - System prompt + service catalog → `cache: true` (changes rarely)
 *   - Customer-specific context → `cache: false` (changes per customer)
 */
export interface PromptCacheable {
  text: string;
  cache?: boolean;
}

/**
 * Token usage breakdown per call. Maps directly to Anthropic's response
 * `usage` object plus our derived cost.
 *
 * - `inputTokens`: regular (non-cached) input tokens billed at the standard rate
 * - `cacheCreationInputTokens`: tokens written to the cache, billed at the higher rate
 * - `cacheReadInputTokens`: tokens read from a previous cache hit, billed at the lower rate
 *
 * Total input = inputTokens + cacheCreationInputTokens + cacheReadInputTokens
 */
export interface ResponseUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
}

/**
 * One tool call Claude made in its response. The model picked this tool by
 * name and provided a JSON `input` matching the tool's schema. Phase 3 fix-6
 * uses tool use to constrain booking-suggestion output (slot_iso must be
 * from a fixed enum, reply_text capped at maxLength) — replaces the fragile
 * fenced-JSON parser approach where Claude could ignore prompt rules.
 */
export interface ClaudeToolUseBlock {
  toolName: string;
  toolUseId: string;
  /** Already-parsed JSON object matching the tool's input_schema */
  input: Record<string, unknown>;
}

/**
 * What `AnthropicClient.complete()` returns. Stripped down from the raw SDK
 * response — callers shouldn't need to know about Anthropic's content-block
 * shape.
 */
export interface ClaudeResponse {
  text: string;
  model: string;
  stopReason: string;
  usage: ResponseUsage;
  costUsd: number;
  latencyMs: number;
  /** Tool calls Claude made. Empty when no tools were provided / used. */
  toolUses: ClaudeToolUseBlock[];
}

/**
 * One tool definition passed to `AnthropicClient.complete()`. Mirrors the
 * shape Anthropic's SDK expects (`{ name, description, input_schema }`)
 * minus snake_case — caller writes camelCase, client adapts at the SDK call
 * boundary.
 */
export interface ClaudeTool {
  name: string;
  description: string;
  /** JSON Schema. Anthropic accepts the standard subset. */
  inputSchema: Record<string, unknown>;
}

/**
 * Tool-choice control. Default = "auto" (Claude picks if to call any tool).
 * Use { type: "tool", name } to force Claude to call a specific tool — most
 * useful when you want a structured response on every call (e.g., booking
 * suggestion path always emits the tool).
 */
export type ClaudeToolChoice =
  | { type: "auto" }
  | { type: "any" }
  | { type: "tool"; name: string };

/**
 * Single options bag for `AnthropicClient.complete()`.
 */
export interface AnthropicCallOptions {
  systemPrompt: PromptCacheable[];
  messages: ChatMessage[];
  model: ClaudeModel;
  /** Default 1024. */
  maxTokens?: number;
  /** Default unset (Anthropic decides). Range 0-1. */
  temperature?: number;
  /** Tools Claude may use. Omit for plain text-only completion. */
  tools?: ClaudeTool[];
  /** How Claude should pick among tools. Default "auto" when tools are provided. */
  toolChoice?: ClaudeToolChoice;
}

// ============================================================================
// AgentContext — what ContextBuilder produces and PromptTemplates consume.
// Keeps the prompt-templating layer decoupled from raw DB rows.
// ============================================================================

export type AITone = "friendly" | "professional" | "urgent";

/**
 * Service info subset relevant to the AI sales conversation. Strips DB
 * internals (timestamps, group_id, etc.) the agent doesn't need to know about.
 */
export interface AgentServiceContext {
  serviceId: string;
  serviceName: string;
  description: string;
  priceUsd: number;
  durationMinutes?: number;
  category: string;
  /** Whether the service has booking-assistance toggle enabled (Task 8/10 wiring) */
  bookingAssistance: boolean;
  /** Whether the service has upsell toggle enabled (drives includeUpsells decision in Task 5) */
  suggestUpsells: boolean;
  /**
   * Shop-authored Q&A FAQ entries for this service. Rendered to Claude as
   * a "Frequently asked questions for this service" block when non-empty.
   * The AI is told to reason across the description AND these entries
   * (description always rendered; FAQ entries are additive). Empty array
   * means the AI falls back to description-only context.
   */
  faqEntries: AgentServiceFaqEntry[];
}

/**
 * One Q&A pair the shop owner wrote for this service. The order in the
 * array preserves shop_services_ai_faq_entries.display_order so the prompt
 * renders the entries in the shop owner's chosen sequence.
 */
export interface AgentServiceFaqEntry {
  question: string;
  answer: string;
}

/**
 * Customer info subset relevant to personalization. Keep this lean — full
 * profile data leaks into the prompt and inflates token cost.
 */
export interface AgentCustomerContext {
  address: string;
  /** Full name from registration; used for first-reply greeting */
  name: string | null;
  tier: "BRONZE" | "SILVER" | "GOLD" | string;
  /** Current redeemable balance (RCN) */
  rcnBalance: number;
  /** Months/years on the platform — soft signal of regularity */
  joinedAt: Date | string | null;
  /**
   * No-show policy: false when the customer is suspended from booking.
   * When false the AI must not propose any slot. Optional — absent on
   * legacy/partial contexts; treated as "can book" when undefined.
   */
  canBook?: boolean;
  /**
   * Per-customer minimum advance-booking hours from the no-show tier
   * (0 = unrestricted, caution = 24, deposit_required = 48). Proposed
   * slots are already filtered to satisfy this; surfaced so the AI can
   * explain the rule if the customer asks for something sooner.
   */
  minAdvanceHours?: number;
  /**
   * Human-readable no-show restriction lines (advance notice, deposit,
   * RCN cap, suspension). Empty/absent for unrestricted customers.
   */
  bookingRestrictions?: string[];
}

/**
 * Shop info subset. Hours and category help the AI answer "are you open?" /
 * "what kind of work do you do?" without inventing facts.
 */
export interface AgentShopContext {
  shopId: string;
  shopName: string;
  category: string | null;
  /** Human-readable hours summary (e.g., "Mon-Fri 9am-6pm, Sat 10am-4pm"). May be null if shop hasn't configured hours. */
  hoursSummary: string | null;
  /** Local timezone used for the hours summary */
  timezone: string | null;
  /**
   * How far ahead a customer can book (from shop_time_slot_config). Surfaced
   * in the prompt so the AI can answer "can I book in 3 weeks?" honestly
   * instead of saying "no slots." Null when the shop hasn't configured a
   * time-slot config yet — in that case the prompt falls back to silence.
   */
  bookingAdvanceDays: number | null;
  /**
   * Minimum hours of notice required before a booking (from time-slot
   * config). Surfaced for the same reason as bookingAdvanceDays.
   */
  minBookingHours: number | null;
  /**
   * Whether the shop allows reschedules at all (shop_time_slot_config.
   * allow_reschedule). null when the config row is missing.
   */
  reschedulesAllowed: boolean | null;
  /**
   * Max number of reschedules per booking. null when reschedules are
   * disallowed or not configured.
   */
  maxReschedulesPerBooking: number | null;
  /**
   * Minimum hours of notice for a reschedule request. null when
   * reschedules are disallowed or not configured.
   */
  rescheduleMinHours: number | null;
  /**
   * Minimum hours of notice for a cancellation, from shop_no_show_policy.
   * null when the no-show policy is disabled or not configured for this
   * shop — in that case the AI should escalate cancel questions rather
   * than guessing.
   */
  cancellationMinHours: number | null;
  /**
   * Public-facing contact details surfaced so the AI can answer "what's
   * your address / phone / email?" honestly instead of saying "I don't
   * have that on hand." Null when the shop hasn't filled in the field;
   * the prompt renders only the populated lines.
   */
  address: string | null;
  phone: string | null;
  email: string | null;
  /** Marketing website URL, e.g. https://peanutshop.com */
  website: string | null;
}

/**
 * One conversation turn from the customer-shop chat thread.
 */
export interface AgentMessageContext {
  role: "user" | "assistant";
  content: string;
  createdAt: Date | string;
  /**
   * Raw `messages.metadata` JSON from the DB row, plumbed through unchanged.
   * Only read by the orchestrator's same-slot loop guard — it inspects the
   * previous AI message's `booking_suggestions` to drop duplicate tool calls.
   * NEVER passed to Anthropic (Claude only sees role + content).
   */
  metadata?: Record<string, any>;
}

/**
 * One sibling service the AI may suggest as an upsell. Smaller field set than
 * full ServiceContext — the AI only needs enough to mention them in passing.
 */
export interface AgentSiblingService {
  serviceId: string;
  serviceName: string;
  priceUsd: number;
  durationMinutes?: number;
  shortBlurb: string;
}

/**
 * One AI-enabled service from the shop's catalog — surfaced to the AI in a
 * "menu" block so it knows the full set of services it can talk about
 * (Phase 1 of multi-service architecture). Distinct from AgentSiblingService:
 *
 * - AgentSiblingService is gated by the focused service's `aiSuggestUpsells`
 *   toggle (a per-service "actively recommend" signal).
 * - AgentShopServiceMenuItem is always populated for every AI-enabled
 *   service at the shop, regardless of any per-service upsell preference.
 *   The AI can answer "what other services do you offer?" honestly without
 *   the focused service explicitly opting in.
 *
 * Capped at MAX_SHOP_SERVICES_IN_PROMPT in ContextBuilder to bound prompt
 * size on shops with very large catalogs.
 */
export interface AgentShopServiceMenuItem {
  serviceId: string;
  serviceName: string;
  priceUsd: number;
  durationMinutes?: number;
  category: string;
  /** First sentence-ish of the description, truncated to ~120 chars. Null when description is empty. */
  shortBlurb: string | null;
  /**
   * Per-service `ai_booking_assistance` flag. Used by ContextBuilder to
   * decide whether to fetch slots for this menu item (Phase 2 follow-up).
   * When false, the AI may DESCRIBE this service but cannot book it here —
   * the prompt menu block flags it as describe-only and slot fetching skips
   * it. Independent of the menu item's mere presence, which is gated by
   * `ai_sales_enabled`.
   */
  bookingAssistance: boolean;
  /**
   * Q&A pairs for this menu item (NOT the focused service — that's on
   * AgentServiceContext.faqEntries above). Empty array when the shop owner
   * hasn't authored FAQ for this service. When non-empty, the prompt
   * renders a nested "Frequently asked questions for {serviceName}" block
   * directly under the menu item so Claude has detailed answers when the
   * customer asks about non-focused services.
   *
   * Without this, the AI knew menu items existed but could only quote
   * price/duration/short-blurb — when asked "what's included in Newly
   * Baker?" while anchored to I Robot, it would honestly admit "I only
   * have full FAQ info for I Robot here." Plumbing the FAQ through the
   * menu item closes that gap.
   */
  faqEntries: AgentServiceFaqEntry[];
}

/**
 * One available booking slot the AI may surface as a tappable suggestion card
 * (Phase 3 Task 10). The orchestrator queries the existing AppointmentService
 * for real availability before each Claude call, so the AI can only suggest
 * slots that are actually bookable.
 *
 * Phase 2 of multi-service architecture: each slot now carries its
 * serviceId + serviceName. Slots from different services can coexist in
 * a single AgentContext.availabilitySlots array. The tool's serviceId
 * enum + slot_iso enum are both built from this tagged list; the
 * orchestrator validates that the AI's chosen (serviceId, slot_iso)
 * pair matches the same source slot before rendering the booking card.
 */
export interface AgentAvailabilitySlot {
  /** YYYY-MM-DD in the shop's timezone */
  date: string;
  /** HH:MM 24-hour, in shop's timezone */
  time: string;
  /** Combined ISO 8601 string the AI must echo back verbatim in its booking_suggestion JSON block */
  slotIso: string;
  /** Human-readable label for prompt readability — e.g. "Thursday, May 8 at 2:30 PM" */
  humanLabel: string;
  /**
   * Which service this slot is for. Phase 2 — added so the AI can book
   * any AI-enabled service at the shop, not just the focused one.
   * Required.
   */
  serviceId: string;
  /**
   * Display name of the service. Used by PromptTemplates to render the
   * slot list as "AQua Tech, Thursday May 14 at 9:00 AM (slot_iso: ...)".
   * Falls back to serviceId if missing.
   */
  serviceName: string;
}

/**
 * Complete per-request context passed to PromptTemplates. Returned by
 * ContextBuilder.build(). All fields populated; missing data shows up as null
 * or empty array, never undefined.
 */
export interface AgentContext {
  service: AgentServiceContext;
  customer: AgentCustomerContext;
  shop: AgentShopContext;
  /** Last 20 messages, oldest-first, for the conversation Claude is replying to */
  conversationHistory: AgentMessageContext[];
  /** Empty array if includeUpsells=false or no eligible siblings exist */
  siblingServices: AgentSiblingService[];
  /**
   * Multi-service menu (Phase 1 of multi-service architecture): all
   * AI-enabled services for the shop, regardless of any per-service upsell
   * preference. Lets the AI answer "what other services do you offer?"
   * accurately even when the focused service has aiSuggestUpsells=false.
   * Always excludes the current focused service (already in `service`).
   * Capped in ContextBuilder.
   */
  shopServiceMenu: AgentShopServiceMenuItem[];
  /**
   * Empty array when service.aiBookingAssistance=false, or when no slots are
   * bookable in the lookahead window. AI only surfaces booking-suggestion
   * cards when this is non-empty.
   */
  availabilitySlots: AgentAvailabilitySlot[];
}

/**
 * Validated booking suggestion extracted from a Claude reply
 * (Phase 3 Task 10). Persisted to messages.metadata.booking_suggestions for
 * the frontend to render as a tappable card.
 */
export interface BookingSuggestion {
  serviceId: string;
  /**
   * Human-readable service name (Phase 5 of multi-service architecture).
   * Sourced from the matching availability slot's serviceName so each tap
   * card can render its own service label without the frontend needing a
   * separate service lookup. Critical for multi-service responses (Phase 3)
   * where two cards may belong to different services — without this each
   * card would otherwise fall back to a shared message-level fallback name.
   */
  serviceName: string;
  /** ISO 8601 — must match a slot present in the availability set sent to Claude */
  slotIso: string;
  /** Echoed for display so the frontend doesn't need to recompute */
  humanLabel?: string;
  depositUsd?: number;
}

// ============================================================================
// Task 5 — AgentOrchestrator inputs/outputs + supporting types
// ============================================================================

/**
 * Input to AgentOrchestrator.handleCustomerMessage(). The caller (Task 8's
 * MessageService hook) is responsible for resolving these from the customer
 * message and conversation metadata. Decoupling this from message-row loading
 * keeps the orchestrator focused on AI logic and easy to test.
 */
export interface HandleCustomerMessageInput {
  /** Message ID of the customer message Claude should respond to */
  messageId: string;
  conversationId: string;
  customerAddress: string;
  shopId: string;
  /** Which service the conversation is about (e.g., the service the customer was viewing when they sent the message) */
  serviceId: string;
  /** The customer message text — passed explicitly so orchestrator doesn't have to re-query */
  customerMessageText: string;
}

/**
 * Discriminated union of outcomes for a handleCustomerMessage call. Lets
 * the caller (Task 8 hook) decide what to do based on the result —
 * silent skip vs error vs success vs escalate.
 */
export type HandleCustomerMessageResult =
  | { outcome: "ai_replied"; aiMessageId: string; costUsd: number; latencyMs: number; model: string }
  | { outcome: "skipped"; reason: SkipReason }
  | { outcome: "escalated"; reason: string }
  | { outcome: "failed"; error: string };

export type SkipReason =
  | "service_ai_disabled" // service.ai_sales_enabled = false
  | "shop_ai_disabled" // ai_shop_settings.ai_global_enabled = false
  | "spend_cap_exceeded" // hit monthly_budget_usd
  | "no_shop_settings" // no ai_shop_settings row for this shop (shouldn't happen post-migration 110 backfill, but guard anyway)
  | "service_shop_mismatch" // serviceId belongs to a different shop than conversation.shopId — defends against spoofed metadata.serviceId
  | "ai_paused"; // conversations.ai_paused_until is in the future — either the 30s auto race window from a recent non-AI shop message, or an explicit "Take Over" hold set via the shop dashboard. See docs/tasks/strategy/ai-human-handoff-clash.md Phase 2.

// ============================================================================
// AuditLogger — what gets persisted into ai_agent_messages
// ============================================================================

/**
 * Insert payload for the audit log. One row per Claude API call (success
 * or failure). Mirrors the columns of `ai_agent_messages` directly.
 */
export interface AIAgentMessageInsert {
  conversationId: string;
  serviceId?: string;
  shopId: string;
  customerAddress: string;
  /** What we sent to Anthropic (system prompt + messages, model, params) */
  requestPayload: object;
  /** What Anthropic returned (or null if the call failed) */
  responsePayload: object | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  costUsd: number;
  toolCalls?: object[];
  latencyMs: number | null;
  escalatedToHuman?: boolean;
  errorMessage?: string | null;
}

// ============================================================================
// SpendCapEnforcer
// ============================================================================

export interface SpendCheckResult {
  allowed: boolean;
  /** True when current spend ≥ 70% of monthly budget — caller should pick Haiku to extend runway */
  useCheaperModel: boolean;
  currentSpendUsd: number;
  monthlyBudgetUsd: number;
  percentUsed: number;
  /** Set when allowed=false — explains why (cap reached, no row found, etc.) */
  blockReason?: string;
}

// ============================================================================
// EscalationDetector
// ============================================================================

export interface EscalationDecision {
  shouldEscalate: boolean;
  /** Set when shouldEscalate=true — explains which signal triggered (keyword, threshold, etc.) */
  reason?: string;
}
