// backend/src/domains/AIAgentDomain/services/AISalesFollowUpDetector.ts
//
// Polling detector for the AI sales follow-up nudge. Every 5 minutes it
// does ONE cheap scan of the conversations table for candidates — chats
// that look quiet — and hands each to AISalesFollowUpHandler, which is the
// authoritative gate (re-checks every guard, may skip).
//
// This is deliberately a thin "find candidates" filter, not the decision
// maker: keeping all the real logic in the handler means there is a single
// place where "should a follow-up go out?" is decided. The scan just keeps
// the handler from being invoked on every conversation in the database.
//
// Registered as a setInterval service in AIAgentDomain — the same pattern
// the backend uses for SuspensionLiftService, AutoNoShowDetectionService,
// etc. (see app.ts). Stopped via AIAgentDomain.cleanup().

import { Pool } from "pg";
import { getSharedPool } from "../../../utils/database-pool";
import { logger } from "../../../utils/logger";
import { AISalesFollowUpHandler } from "./AISalesFollowUpHandler";

const DEFAULT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
/**
 * Lower bound of the scan window. The per-shop delay
 * (ai_followup_delay_minutes) ranges 15-30; the scan uses the 15-minute
 * floor so it never misses a candidate, and the handler enforces the
 * shop's actual delay.
 */
const SCAN_MIN_QUIET_MINUTES = 15;
/** Conversations quieter than this are cold — not this feature's job. */
const SCAN_MAX_QUIET_HOURS = 6;
/** Safety bound on candidates evaluated per tick. */
const MAX_CANDIDATES_PER_TICK = 200;

export class AISalesFollowUpDetector {
  private timer: NodeJS.Timeout | null = null;
  /** Guards against a slow tick overlapping the next one. */
  private running = false;

  constructor(
    private readonly handler: AISalesFollowUpHandler,
    private readonly pool: Pool = getSharedPool()
  ) {}

  /** Begin the polling loop. Idempotent — a second call is a no-op. */
  start(intervalMs: number = DEFAULT_INTERVAL_MS): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, intervalMs);
    logger.info(
      `AISalesFollowUpDetector started (every ${Math.round(intervalMs / 60000)} min)`
    );
  }

  /** Stop the polling loop. Called from AIAgentDomain.cleanup(). */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info("AISalesFollowUpDetector stopped");
    }
  }

  /**
   * One sweep: find candidate conversations and hand each to the handler.
   * The handler swallows its own errors, so one bad conversation never
   * aborts the sweep. The whole tick is wrapped too — a scan failure just
   * skips this round.
   */
  async tick(): Promise<void> {
    if (this.running) {
      logger.warn("AISalesFollowUpDetector: previous tick still running, skipping");
      return;
    }
    this.running = true;
    try {
      const candidateIds = await this.findCandidates();
      if (candidateIds.length === 0) return;
      logger.debug("AISalesFollowUpDetector: evaluating candidates", {
        count: candidateIds.length,
      });
      for (const conversationId of candidateIds) {
        await this.handler.processFollowUp(conversationId);
      }
    } catch (err) {
      logger.error("AISalesFollowUpDetector: tick failed", {
        error: (err as Error)?.message,
      });
    } finally {
      this.running = false;
    }
  }

  /**
   * Cheap broad scan: open conversations, not under human takeover, whose
   * last activity is between 15 minutes and 6 hours ago. This is a filter,
   * not a decision — the handler re-checks everything (last message is AI,
   * customer engaged, per-shop delay, idempotency, spend cap, quiet hours).
   */
  private async findCandidates(): Promise<string[]> {
    const res = await this.pool.query<{ conversation_id: string }>(
      `SELECT conversation_id
       FROM conversations
       WHERE status = 'open'
         AND (ai_paused_until IS NULL OR ai_paused_until <= NOW())
         AND last_message_at IS NOT NULL
         AND last_message_at <= NOW() - ($1 || ' minutes')::interval
         AND last_message_at >= NOW() - ($2 || ' hours')::interval
       ORDER BY last_message_at ASC
       LIMIT ${MAX_CANDIDATES_PER_TICK}`,
      [SCAN_MIN_QUIET_MINUTES, SCAN_MAX_QUIET_HOURS]
    );
    return res.rows.map((r) => r.conversation_id);
  }
}
