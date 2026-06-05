// backend/src/domains/AIAgentDomain/services/OrchestrateAuditLogger.ts
//
// Inserts one row per Unified Assistant (orchestrator) Claude call into
// ai_orchestrate_messages (migration 132). Sibling to InsightsAuditLogger;
// the tool_calls JSONB here can span BOTH the insights and marketing
// registries in a single turn (the orchestrator's whole point).
//
// Non-throwing: a failed audit insert is logged and swallowed so the AI reply
// still reaches the owner even when the audit write fails (e.g. the table
// hasn't been migrated yet on a given environment).

import { Pool } from "pg";
import { getSharedPool } from "../../../utils/database-pool";
import { logger } from "../../../utils/logger";

/** Slim per-tool record (matches the controller's UnifiedToolCallSummary). */
export interface OrchestrateToolCallRecord {
  tool: string;
  args: Record<string, unknown>;
  display?: unknown;
}

export interface OrchestrateAuditEntry {
  shopId: string;
  /** Client-generated session id grouping multi-turn rows. */
  sessionId: string;
  /** Validated request body verbatim (messages array). */
  requestPayload: unknown;
  /** Last Claude response shape. NULL when the call errored. */
  responsePayload: unknown | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** Anthropic cache_read_input_tokens — billed at the cached rate. */
  cachedInputTokens: number;
  costUsd: number;
  /** Cross-domain tools invoked this turn. Empty when answered without tools. */
  toolCalls: OrchestrateToolCallRecord[];
  /** Wall-clock latency. NULL if we never got a response. */
  latencyMs: number | null;
  /** Populated when the Anthropic call failed; otherwise NULL. */
  errorMessage: string | null;
}

export class OrchestrateAuditLogger {
  constructor(private readonly pool: Pool = getSharedPool()) {}

  /** Insert one row. Returns the new row's UUID id, or null on failure. */
  async log(entry: OrchestrateAuditEntry): Promise<string | null> {
    try {
      const result = await this.pool.query<{ id: string }>(
        `INSERT INTO ai_orchestrate_messages (
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
      logger.error("OrchestrateAuditLogger insert failed", err);
      return null;
    }
  }
}

export const orchestrateAuditLogger = new OrchestrateAuditLogger();
