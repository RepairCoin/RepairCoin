// backend/src/domains/AIAgentDomain/services/MarketingAuditLogger.ts
//
// Inserts one row per AI Marketing Assistant Claude call into
// ai_marketing_messages (migration 128). Sibling to InsightsAuditLogger;
// only meaningful difference is the destination table.
//
// Non-throwing: a failed audit insert is logged and swallowed so the
// AI reply still reaches the shop owner even when audit DB writes fail.

import { Pool } from "pg";
import { getSharedPool } from "../../../utils/database-pool";
import { logger } from "../../../utils/logger";
import { MarketingToolInvocationRecord } from "./marketing/types";

export interface MarketingAuditEntry {
  shopId: string;
  /** Client-generated session id grouping multi-turn rows. */
  sessionId: string;
  /** Validated request body verbatim (messages array). */
  requestPayload: unknown;
  /** Claude response shape. NULL when the call errored. */
  responsePayload: unknown | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** Anthropic cache_read_input_tokens — billed at the cached rate. */
  cachedInputTokens: number;
  costUsd: number;
  /** Slim per-tool records. Empty when Claude answered without tool use. */
  toolCalls: MarketingToolInvocationRecord[];
  /** Wall-clock latency. NULL if we never got a response. */
  latencyMs: number | null;
  /** Populated when the Anthropic call failed; otherwise NULL. */
  errorMessage: string | null;
}

export class MarketingAuditLogger {
  constructor(private readonly pool: Pool = getSharedPool()) {}

  async log(entry: MarketingAuditEntry): Promise<string | null> {
    try {
      const result = await this.pool.query<{ id: string }>(
        `INSERT INTO ai_marketing_messages (
           shop_id, session_id,
           request_payload, response_payload,
           model, input_tokens, output_tokens, cached_input_tokens,
           cost_usd, tool_calls,
           latency_ms, error_message
         ) VALUES (
           $1, $2,
           $3::jsonb, $4::jsonb,
           $5, $6, $7, $8,
           $9, $10::jsonb,
           $11, $12
         )
         RETURNING id`,
        [
          entry.shopId,
          entry.sessionId,
          JSON.stringify(entry.requestPayload),
          entry.responsePayload === null
            ? null
            : JSON.stringify(entry.responsePayload),
          entry.model,
          entry.inputTokens,
          entry.outputTokens,
          entry.cachedInputTokens,
          entry.costUsd,
          JSON.stringify(entry.toolCalls ?? []),
          entry.latencyMs,
          entry.errorMessage,
        ]
      );
      return result.rows[0]?.id ?? null;
    } catch (err) {
      logger.error("MarketingAuditLogger insert failed", err);
      return null;
    }
  }
}

export const marketingAuditLogger = new MarketingAuditLogger();
