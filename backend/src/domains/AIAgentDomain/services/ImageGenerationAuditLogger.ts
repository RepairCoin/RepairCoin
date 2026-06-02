// backend/src/domains/AIAgentDomain/services/ImageGenerationAuditLogger.ts
//
// One-row INSERT into ai_image_generations (migration 134). Mirrors
// VoiceAuditLogger / HelpAuditLogger — same always-write posture: a failed
// generation still writes a row (image_url=null + error_message) so cost,
// latency, and moderation flags are captured for debugging + abuse review.
//
// Covers BOTH generate and edit (operation_type) so Phase 6 reuses this logger.

import { Pool } from "pg";
import { getSharedPool } from "../../../utils/database-pool";
import { logger } from "../../../utils/logger";

export interface ImageGenerationAuditRecord {
  shopId: string;
  operationType: "generate" | "edit";
  vendor: "openai" | "stability";
  model: string;
  prompt: string;
  sourceImageUrl: string | null;
  imageUrl: string | null;
  imageKey: string | null;
  dimensions: string | null;
  useCase: string | null;
  costUsd: number;
  latencyMs: number | null;
  moderationFlagged: boolean;
  errorMessage: string | null;
}

export class ImageGenerationAuditLogger {
  constructor(private readonly pool: Pool = getSharedPool()) {}

  async log(record: ImageGenerationAuditRecord): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO ai_image_generations
           (shop_id, operation_type, vendor, model, prompt, source_image_url,
            image_url, image_key, dimensions, use_case, cost_usd, latency_ms,
            moderation_flagged, error_message)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          record.shopId,
          record.operationType,
          record.vendor,
          record.model,
          record.prompt,
          record.sourceImageUrl,
          record.imageUrl,
          record.imageKey,
          record.dimensions,
          record.useCase,
          record.costUsd,
          record.latencyMs,
          record.moderationFlagged,
          record.errorMessage,
        ]
      );
    } catch (err) {
      // Swallow — same posture as the other audit loggers. A missing audit
      // row is a soft failure we'd rather log than have block the user.
      logger.error("ImageGenerationAuditLogger.log failed", err);
    }
  }

  /**
   * Count a shop's generations since local midnight (daily rate-limit gate).
   * Counts ALL attempts incl. failures — a flood of failing calls still
   * indicates abuse/runaway and should be throttled.
   */
  async countToday(shopId: string): Promise<number> {
    try {
      const r = await this.pool.query<{ n: string }>(
        `SELECT COUNT(*)::int AS n
           FROM ai_image_generations
          WHERE shop_id = $1
            AND created_at >= date_trunc('day', now())`,
        [shopId]
      );
      return Number(r.rows[0]?.n ?? 0);
    } catch (err) {
      logger.error("ImageGenerationAuditLogger.countToday failed", err);
      return 0; // fail open on the count read; the spend cap is the hard gate
    }
  }
}

export const imageGenerationAuditLogger = new ImageGenerationAuditLogger();
