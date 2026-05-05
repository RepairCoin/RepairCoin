// backend/src/domains/AIAgentDomain/services/AnthropicClient.ts
//
// Single source of truth for Claude API calls. Wraps @anthropic-ai/sdk with:
//   - Retry/backoff on 429 (rate limit) and 5xx errors
//   - Prompt caching (cache_control: ephemeral) on the system prompt blocks
//   - Cost calculation per response, broken down by input / output / cache rates
//   - Typed input/output (PromptCacheable, ChatMessage, ClaudeResponse)
//
// Used by Task 5+ (AgentOrchestrator). Not yet wired to any HTTP route.
//
// Pricing constants are best-effort (verified at build time against Anthropic
// docs). If they drift, audit logs will show small cost rounding differences;
// not a correctness issue. See PRICING_USD_PER_MTOK comment for re-validation.

import Anthropic from "@anthropic-ai/sdk";
import { logger } from "../../../utils/logger";
import {
  ClaudeModel,
  AnthropicCallOptions,
  ClaudeResponse,
  ResponseUsage,
} from "../types";

/**
 * Per-million-token USD pricing as of 2026-05-05.
 *
 * Re-verify at deploy time against:
 *   https://www.anthropic.com/pricing#anthropic-api
 *
 * If pricing changes, update this table and let cost calculation re-run on
 * historical `ai_agent_messages` rows be expected to drift slightly. The cost
 * column is logged at request time, not recalculated, so historical rows
 * stay accurate to what they were charged.
 */
const PRICING_USD_PER_MTOK: Record<
  ClaudeModel,
  {
    input: number;
    output: number;
    cacheWrite: number;
    cacheRead: number;
  }
> = {
  "claude-sonnet-4-6": {
    input: 3.0,
    output: 15.0,
    cacheWrite: 3.75,
    cacheRead: 0.3,
  },
  "claude-haiku-4-5-20251001": {
    input: 0.8,
    output: 4.0,
    cacheWrite: 1.0,
    cacheRead: 0.08,
  },
};

const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 1000;
const DEFAULT_MAX_TOKENS = 1024;

export class AnthropicClient {
  private sdk: Anthropic;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error(
        "ANTHROPIC_API_KEY not set — AnthropicClient cannot be instantiated"
      );
    }
    this.sdk = new Anthropic({ apiKey: key });
  }

  /**
   * Call Claude with a system prompt + conversation history. Retries up to 3
   * times on 429/5xx (exponential backoff: 1s, 2s, 4s). Returns a normalized
   * `ClaudeResponse` including computed cost.
   *
   * 4xx errors other than 429 (auth, validation) are surfaced immediately
   * without retry — retrying won't help and just burns latency.
   */
  async complete(options: AnthropicCallOptions): Promise<ClaudeResponse> {
    const {
      systemPrompt,
      messages,
      model,
      maxTokens = DEFAULT_MAX_TOKENS,
      temperature,
    } = options;

    const start = Date.now();
    let lastError: any = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await this.sdk.messages.create({
          model,
          max_tokens: maxTokens,
          ...(temperature !== undefined ? { temperature } : {}),
          system: systemPrompt.map((block) => ({
            type: "text" as const,
            text: block.text,
            ...(block.cache
              ? { cache_control: { type: "ephemeral" as const } }
              : {}),
          })),
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        });

        const elapsed = Date.now() - start;
        const text = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n");

        const usage: ResponseUsage = {
          inputTokens: response.usage.input_tokens ?? 0,
          outputTokens: response.usage.output_tokens ?? 0,
          cacheCreationInputTokens:
            (response.usage as any).cache_creation_input_tokens ?? 0,
          cacheReadInputTokens:
            (response.usage as any).cache_read_input_tokens ?? 0,
        };

        return {
          text,
          model: response.model,
          stopReason: response.stop_reason || "unknown",
          usage,
          costUsd: AnthropicClient.calculateCost(usage, model),
          latencyMs: elapsed,
        };
      } catch (err: any) {
        lastError = err;
        const status: number | undefined = err?.status ?? err?.response?.status;
        const isRetryable =
          status === 429 || (typeof status === "number" && status >= 500 && status < 600);

        if (!isRetryable || attempt === MAX_RETRIES) {
          // Out of retries or non-retryable — surface as-is
          break;
        }

        const delay = BACKOFF_BASE_MS * Math.pow(2, attempt);
        logger.warn(
          `Anthropic call failed (status=${status}), retrying in ${delay}ms (attempt ${
            attempt + 1
          }/${MAX_RETRIES})`
        );
        await sleep(delay);
      }
    }

    // All retries exhausted
    throw lastError;
  }

  /**
   * Static cost calculator. Exposed publicly so callers can estimate costs
   * before making a call (e.g., spend cap pre-check), or recalculate
   * historical costs from stored usage data.
   *
   * Returns USD as a plain number (not a string or BigDecimal). For storage,
   * we round to 6 decimal places via the `cost_usd NUMERIC(10, 6)` column on
   * `ai_agent_messages`.
   */
  static calculateCost(usage: ResponseUsage, model: ClaudeModel): number {
    const pricing = PRICING_USD_PER_MTOK[model];
    if (!pricing) {
      // Unknown model — return 0 so we don't break callers, but log it
      logger.warn(`No pricing entry for model "${model}"; returning cost=0`);
      return 0;
    }

    const inputCost = (usage.inputTokens / 1_000_000) * pricing.input;
    const outputCost = (usage.outputTokens / 1_000_000) * pricing.output;
    const cacheWriteCost =
      (usage.cacheCreationInputTokens / 1_000_000) * pricing.cacheWrite;
    const cacheReadCost =
      (usage.cacheReadInputTokens / 1_000_000) * pricing.cacheRead;

    return inputCost + outputCost + cacheWriteCost + cacheReadCost;
  }

  /**
   * Expose the pricing table for testing / external reference. Read-only.
   */
  static getPricing(): Readonly<typeof PRICING_USD_PER_MTOK> {
    return PRICING_USD_PER_MTOK;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
