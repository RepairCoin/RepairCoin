// backend/src/domains/AIAgentDomain/services/AuditLogger.ts
//
// Single insert into ai_agent_messages per Claude call. Keeps the orchestrator
// clean — it just calls AuditLogger.log(entry) and forgets.
//
// Cheap (~10ms typical insert), but always awaited so failures bubble up to
// the orchestrator's error path. The audit log is the system of record for
// AI behavior + cost tracking; we'd rather an orchestrator failure than a
// silently-missing audit row.

import { Pool } from "pg";
import { getSharedPool } from "../../../utils/database-pool";
import { logger } from "../../../utils/logger";
import { AIAgentMessageInsert } from "../types";

export class AuditLogger {
  constructor(private readonly pool: Pool = getSharedPool()) {}

  /**
   * Insert one row into ai_agent_messages. Does not throw; logs DB errors
   * via the project logger and resolves to a no-op so the calling
   * orchestrator can continue posting the AI reply even if audit fails.
   *
   * Returns the new row's UUID id, or null if the insert failed.
   */
  async log(entry: AIAgentMessageInsert): Promise<string | null> {
    try {
      const result = await this.pool.query<{ id: string }>(
        `INSERT INTO ai_agent_messages (
           conversation_id, service_id, shop_id, customer_address,
           request_payload, response_payload, model,
           input_tokens, output_tokens, cached_input_tokens, cost_usd,
           tool_calls, latency_ms, escalated_to_human, error_message
         ) VALUES (
           $1, $2, $3, $4,
           $5::jsonb, $6::jsonb, $7,
           $8, $9, $10, $11,
           $12::jsonb, $13, $14, $15
         )
         RETURNING id`,
        [
          entry.conversationId,
          entry.serviceId ?? null,
          entry.shopId,
          entry.customerAddress,
          JSON.stringify(entry.requestPayload),
          entry.responsePayload === null ? null : JSON.stringify(entry.responsePayload),
          entry.model,
          entry.inputTokens,
          entry.outputTokens,
          entry.cachedInputTokens,
          entry.costUsd,
          JSON.stringify(entry.toolCalls ?? []),
          entry.latencyMs,
          entry.escalatedToHuman ?? false,
          entry.errorMessage ?? null,
        ]
      );
      return result.rows[0]?.id ?? null;
    } catch (err) {
      logger.error("AuditLogger insert failed", err);
      return null;
    }
  }
}

export const auditLogger = new AuditLogger();
