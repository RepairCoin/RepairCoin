// backend/src/domains/AIAgentDomain/services/InsightsAuditLogger.ts
//
// Inserts one row per Business-Data Insights Claude call into
// ai_insights_messages (migration 122). Sibling to HelpAuditLogger;
// only meaningful difference is the `tool_calls` JSONB column, which
// captures the tools Claude invoked while answering this request +
// their args + display hint + latency + (on failure) error.
//
// Non-throwing: a failed audit insert is logged and swallowed so the
// AI reply still reaches the shop owner even when audit DB writes fail.

import { Pool } from "pg";
import { getSharedPool } from "../../../utils/database-pool";
import { logger } from "../../../utils/logger";
import { ToolInvocationRecord } from "./insights/types";

export interface InsightsAuditEntry {
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
  /**
   * Slim per-tool records for the request. Empty when Claude answered
   * without calling any tool (e.g., a decline message). Each record's
   * shape is enforced by ToolInvocationRecord; deliberately excludes
   * result.data to keep audit rows compact.
   */
  toolCalls: ToolInvocationRecord[];
  /** Wall-clock latency. NULL if we never got a response. */
  latencyMs: number | null;
  /** Populated when the Anthropic call failed; otherwise NULL. */
  errorMessage: string | null;
}

export class InsightsAuditLogger {
  constructor(private readonly pool: Pool = getSharedPool()) {}

  /**
   * Insert one row. Returns the new row's UUID id, or null on failure.
   * Failure is logged but never thrown — the AI reply already happened.
   */
  async log(entry: InsightsAuditEntry): Promise<string | null> {
    try {
      const result = await this.pool.query<{ id: string }>(
        `INSERT INTO ai_insights_messages (
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
      logger.error("InsightsAuditLogger insert failed", err);
      return null;
    }
  }
}

export const insightsAuditLogger = new InsightsAuditLogger();
