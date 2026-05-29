// backend/src/domains/AIAgentDomain/services/VoiceDispatchAuditLogger.ts
//
// One-row INSERT into ai_dispatch_audit (migration 130). Mirrors
// VoiceAuditLogger / HelpAuditLogger — same always-write posture so
// failures still capture cost + latency for debugging.

import { Pool } from "pg";
import { getSharedPool } from "../../../utils/database-pool";
import { logger } from "../../../utils/logger";

export type DispatchTranscriptSource = "voice" | "inline_mic";
export type DispatchRouterDecision =
  | "insights"
  | "marketing"
  | "help"
  | "out_of_scope"
  | "error";

export interface VoiceDispatchAuditRecord {
  shopId: string;
  sessionId: string;
  transcript: string;
  transcriptSource: DispatchTranscriptSource;
  routerDecision: DispatchRouterDecision;
  routerInputTokens: number;
  routerOutputTokens: number;
  routerCostUsd: number;
  latencyMs: number;
  errorMessage: string | null;
}

export class VoiceDispatchAuditLogger {
  constructor(private readonly pool: Pool = getSharedPool()) {}

  async log(record: VoiceDispatchAuditRecord): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO ai_dispatch_audit
           (shop_id, session_id, transcript, transcript_source,
            router_decision, router_input_tokens, router_output_tokens,
            router_cost_usd, latency_ms, error_message)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          record.shopId,
          record.sessionId,
          record.transcript,
          record.transcriptSource,
          record.routerDecision,
          record.routerInputTokens,
          record.routerOutputTokens,
          record.routerCostUsd,
          record.latencyMs,
          record.errorMessage,
        ]
      );
    } catch (err) {
      // Swallow — same as the other audit loggers. The user response
      // already happened; missing audit row is a soft failure.
      logger.error("VoiceDispatchAuditLogger.log failed", err);
    }
  }
}

export const voiceDispatchAuditLogger = new VoiceDispatchAuditLogger();
