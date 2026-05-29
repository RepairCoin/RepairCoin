// backend/src/domains/AIAgentDomain/services/VoiceAuditLogger.ts
//
// One-row INSERT into ai_voice_transcriptions (migration 129). Mirrors
// HelpAuditLogger / MarketingAuditLogger / InsightsAuditLogger so per-
// surface audit logging shares the same shape.
//
// Always-write: a failure path passes transcript=null + errorMessage so
// cost (0) and latency are still captured for debugging.

import { Pool } from "pg";
import { getSharedPool } from "../../../utils/database-pool";
import { logger } from "../../../utils/logger";

export interface VoiceAuditRecord {
  shopId: string;
  sessionId: string;
  durationMs: number;
  audioSizeBytes: number;
  costUsd: number;
  transcript: string | null;
  latencyMs: number;
  errorMessage: string | null;
}

export class VoiceAuditLogger {
  constructor(private readonly pool: Pool = getSharedPool()) {}

  async log(record: VoiceAuditRecord): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO ai_voice_transcriptions
           (shop_id, session_id, duration_ms, audio_size_bytes,
            cost_usd, transcript, latency_ms, error_message)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          record.shopId,
          record.sessionId,
          record.durationMs,
          record.audioSizeBytes,
          record.costUsd,
          record.transcript,
          record.latencyMs,
          record.errorMessage,
        ]
      );
    } catch (err) {
      // Swallow — same posture as the other audit loggers. The user
      // response already happened (or failed); a missing audit row is
      // a soft failure we'd rather see in the logs than have block
      // the user.
      logger.error("VoiceAuditLogger.log failed", err);
    }
  }
}

export const voiceAuditLogger = new VoiceAuditLogger();
