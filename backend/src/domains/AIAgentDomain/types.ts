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
