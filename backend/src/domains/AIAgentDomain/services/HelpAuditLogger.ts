// backend/src/domains/AIAgentDomain/services/HelpAuditLogger.ts
//
// Inserts one row per Claude call into ai_help_messages (migration 121).
// Sibling to AuditLogger — the existing audit table has NOT NULL columns
// (conversation_id, customer_address) the How-To Assistant doesn't have,
// see how-to-assistant-implementation.md Section 3.5.
//
// Non-throwing: a failed insert is logged and swallowed so the AI reply
// still reaches the shop owner even if audit DB writes fail.

import { Pool } from "pg";
import { getSharedPool } from "../../../utils/database-pool";
import { logger } from "../../../utils/logger";

export interface HelpAuditEntry {
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
  /** Wall-clock latency. NULL if we never got a response. */
  latencyMs: number | null;
  /** Populated when the Anthropic call failed; otherwise NULL. */
  errorMessage: string | null;
}

export class HelpAuditLogger {
  constructor(private readonly pool: Pool = getSharedPool()) {}

  /**
   * Insert one row. Returns the new row's UUID id, or null on failure.
   * Failure is logged but never thrown — the AI reply already happened.
   */
  async log(entry: HelpAuditEntry): Promise<string | null> {
    try {
      const result = await this.pool.query<{ id: string }>(
        `INSERT INTO ai_help_messages (
           shop_id, session_id,
           request_payload, response_payload,
           model, input_tokens, output_tokens, cached_input_tokens,
           cost_usd, latency_ms, error_message
         ) VALUES (
           $1, $2,
           $3::jsonb, $4::jsonb,
           $5, $6, $7, $8,
           $9, $10, $11
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
          entry.latencyMs,
          entry.errorMessage,
        ]
      );
      return result.rows[0]?.id ?? null;
    } catch (err) {
      logger.error("HelpAuditLogger insert failed", err);
      return null;
    }
  }
}

export const helpAuditLogger = new HelpAuditLogger();
