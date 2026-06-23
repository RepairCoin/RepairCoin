// backend/src/services/InsightsAnomalyScheduler.ts
//
// Phase 7.2.12 — nightly cron that drives the anomaly-detection
// pipeline. Mirrors the LowStockAlertScheduler pattern (node-cron,
// env-gated start, idempotent start/stop).
//
// Order per run:
//   1. AnomalyDetector.runForAllShops() — walks every AI-enabled
//      shop, computes week-over-week deltas across the 5 starter
//      metrics, inserts flagged rows into ai_insights_anomalies.
//   2. AnomalyPhraser.phraseAllPending() — picks up any row with
//      claude_phrasing = NULL and produces a one-sentence summary
//      + follow-up question via a short Sonnet call.
//
// Both steps are non-throwing internally — per-shop / per-metric /
// per-anomaly failures get logged and skipped without sinking the
// rest of the batch.
//
// Env gate: NODE_ENV === 'production' OR
// INSIGHTS_ANOMALY_DETECTION_ENABLED === 'true'. Dev sessions don't
// fire the nightly job unless explicitly opted in.

import cron from "node-cron";
import { logger } from "../utils/logger";
import { AnomalyDetector } from "../domains/AIAgentDomain/services/insights/anomalies/AnomalyDetector";
import { AnomalyPhraser } from "../domains/AIAgentDomain/services/insights/anomalies/AnomalyPhraser";
import { getAiMemoryService } from "../domains/AIAgentDomain/services/AiMemoryService";

// 03:00 UTC = off-peak for both PH and US time zones the shops
// operate in. Per-cron syntax: minute hour day month weekday.
const NIGHTLY_CRON = "0 3 * * *";
const TIMEZONE = "UTC";

export class InsightsAnomalyScheduler {
  private cronJob: cron.ScheduledTask | null = null;
  private isRunning = false;
  private lastRunAt: Date | null = null;
  private lastRunResult: { shopsProcessed: number; anomaliesFlagged: number; shopErrors: number; phrased: number; phrasingSkipped: number; memoriesPurged: number } | null = null;

  start(): void {
    if (this.cronJob) {
      logger.warn("InsightsAnomalyScheduler is already running");
      return;
    }
    this.cronJob = cron.schedule(
      NIGHTLY_CRON,
      async () => {
        await this.runNightlyDetection();
      },
      { timezone: TIMEZONE }
    );
    logger.info(
      `InsightsAnomalyScheduler started — nightly at ${NIGHTLY_CRON} ${TIMEZONE}`
    );
  }

  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info("InsightsAnomalyScheduler stopped");
    }
  }

  /**
   * Run the detection + phrasing batch. Exposed so we can trigger
   * manually for the Phase 7.2 dry-run period (e.g. via a one-shot
   * script) without waiting for 03:00.
   */
  async runNightlyDetection(): Promise<void> {
    if (this.isRunning) {
      logger.warn(
        "InsightsAnomalyScheduler: previous run still in flight, skipping"
      );
      return;
    }
    this.isRunning = true;
    const startedAt = Date.now();

    try {
      const detector = new AnomalyDetector();
      const detectorResult = await detector.runForAllShops();

      const phraser = new AnomalyPhraser();
      const { phrased, skipped } = await phraser.phraseAllPending();

      // AI Memory aging (Phase 6 slice): soft-delete auto + unpinned, never-
      // referenced memories past the window (AI_MEMORY_STALE_DAYS). No-op when
      // ENABLE_AI_MEMORY is off. Non-throwing so it never sinks the batch.
      let memoriesPurged = 0;
      try {
        memoriesPurged = await getAiMemoryService().purgeStale();
      } catch (err) {
        logger.warn("InsightsAnomalyScheduler: AI memory purge skipped", {
          error: err instanceof Error ? err.message : String(err),
        });
      }

      this.lastRunAt = new Date();
      this.lastRunResult = {
        ...detectorResult,
        phrased,
        phrasingSkipped: skipped,
        memoriesPurged,
      };

      logger.info("InsightsAnomalyScheduler: nightly run complete", {
        ...this.lastRunResult,
        elapsedMs: Date.now() - startedAt,
      });
    } catch (err) {
      // Should be unreachable — both detector + phraser are
      // designed to be non-throwing at the top level. But if
      // something escapes, log and keep the process alive.
      logger.error("InsightsAnomalyScheduler: nightly run threw", err);
    } finally {
      this.isRunning = false;
    }
  }

  getStatus() {
    return {
      isScheduled: this.cronJob !== null,
      isRunning: this.isRunning,
      lastRunAt: this.lastRunAt,
      lastRunResult: this.lastRunResult,
    };
  }
}

// Lazy-singleton — same shape as the other domain-level schedulers.
let _instance: InsightsAnomalyScheduler | null = null;
export function getInsightsAnomalyScheduler(): InsightsAnomalyScheduler {
  if (!_instance) _instance = new InsightsAnomalyScheduler();
  return _instance;
}
