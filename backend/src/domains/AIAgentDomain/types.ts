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
}

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
  /** Honored when present — shop owner's free-form per-service guidance */
  customInstructions: string | null;
  /** Whether the service has booking-assistance toggle enabled (Task 8/10 wiring) */
  bookingAssistance: boolean;
  /** Whether the service has upsell toggle enabled (drives includeUpsells decision in Task 5) */
  suggestUpsells: boolean;
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
}

/**
 * One conversation turn from the customer-shop chat thread.
 */
export interface AgentMessageContext {
  role: "user" | "assistant";
  content: string;
  createdAt: Date | string;
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
}
