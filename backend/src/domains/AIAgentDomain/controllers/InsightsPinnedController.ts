// backend/src/domains/AIAgentDomain/controllers/InsightsPinnedController.ts
//
// Phase 7.3 — saved queries (CRUD).
//
//   GET    /api/ai/insights/pinned         — list this shop's pins
//   POST   /api/ai/insights/pinned         — create a pin
//   DELETE /api/ai/insights/pinned/:id     — unpin
//   PUT    /api/ai/insights/pinned/:id/run — record a fresh tap-to-run
//
// Shop-scoped via the JWT (`req.user.shopId`) on every operation —
// the URL :id never determines scope, so a shop owner can't tamper
// with another shop's pins by guessing UUIDs.

import { Request, Response } from "express";
import { Pool } from "pg";
import { logger } from "../../../utils/logger";
import { getSharedPool } from "../../../utils/database-pool";

export interface PinnedQueryDto {
  id: string;
  questionText: string;
  pinnedAt: string;
  lastRunAt: string | null;
  lastResponseExcerpt: string | null;
  displayOrder: number;
}

const MAX_QUESTION_CHARS = 2000;
const MAX_EXCERPT_CHARS = 500; // 200 in scope-doc; allow a bit more for tables.
const MAX_PINS_PER_SHOP = 50;

function rowToDto(r: {
  id: string;
  question_text: string;
  pinned_at: Date;
  last_run_at: Date | null;
  last_response_excerpt: string | null;
  display_order: number;
}): PinnedQueryDto {
  return {
    id: r.id,
    questionText: r.question_text,
    pinnedAt: r.pinned_at.toISOString(),
    lastRunAt: r.last_run_at ? r.last_run_at.toISOString() : null,
    lastResponseExcerpt: r.last_response_excerpt,
    displayOrder: r.display_order,
  };
}

export interface InsightsPinnedControllerDeps {
  pool?: Pool;
}

export function makeInsightsPinnedController(
  deps: InsightsPinnedControllerDeps = {}
) {
  const pool = deps.pool ?? getSharedPool();

  return {
    /** GET /api/ai/insights/pinned */
    listPinned: async (req: Request, res: Response): Promise<void> => {
      try {
        const shopId = (req as any).user?.shopId;
        if (!shopId) {
          res.status(401).json({ success: false, error: "Shop ID required" });
          return;
        }
        const result = await pool.query(
          `SELECT id, question_text, pinned_at, last_run_at,
                  last_response_excerpt, display_order
           FROM ai_insights_pinned_queries
           WHERE shop_id = $1
           ORDER BY display_order ASC, pinned_at DESC`,
          [shopId]
        );
        const pinned = result.rows.map(rowToDto);
        res.json({ success: true, data: { pinned } });
      } catch (err) {
        logger.error("InsightsPinnedController.listPinned failed", err);
        res
          .status(500)
          .json({ success: false, error: "Failed to load pinned queries" });
      }
    },

    /**
     * POST /api/ai/insights/pinned
     * Body: { questionText: string }
     *
     * Idempotent on (shop_id, question_text) — if the shop has already
     * pinned this exact question, return the existing row instead of
     * creating a duplicate. Avoids the "I pinned this twice" footgun.
     */
    createPinned: async (req: Request, res: Response): Promise<void> => {
      try {
        const shopId = (req as any).user?.shopId;
        if (!shopId) {
          res.status(401).json({ success: false, error: "Shop ID required" });
          return;
        }
        const raw = (req.body as { questionText?: unknown })?.questionText;
        if (typeof raw !== "string") {
          res
            .status(400)
            .json({ success: false, error: "`questionText` must be a string" });
          return;
        }
        const questionText = raw.trim();
        if (questionText.length === 0) {
          res
            .status(400)
            .json({ success: false, error: "`questionText` must not be empty" });
          return;
        }
        if (questionText.length > MAX_QUESTION_CHARS) {
          res.status(400).json({
            success: false,
            error: `\`questionText\` exceeds ${MAX_QUESTION_CHARS} chars`,
          });
          return;
        }

        // Cap pins per shop so a runaway client can't OOM the table.
        const countRes = await pool.query<{ n: string }>(
          `SELECT COUNT(*)::text AS n
           FROM ai_insights_pinned_queries WHERE shop_id = $1`,
          [shopId]
        );
        if (Number(countRes.rows[0]?.n ?? 0) >= MAX_PINS_PER_SHOP) {
          res.status(409).json({
            success: false,
            error: `Pin limit reached (${MAX_PINS_PER_SHOP}). Unpin one before adding another.`,
          });
          return;
        }

        // Dedupe: if (shop, text) already exists, return that row.
        const existing = await pool.query(
          `SELECT id, question_text, pinned_at, last_run_at,
                  last_response_excerpt, display_order
           FROM ai_insights_pinned_queries
           WHERE shop_id = $1 AND question_text = $2
           LIMIT 1`,
          [shopId, questionText]
        );
        if (existing.rows.length > 0) {
          res.json({ success: true, data: rowToDto(existing.rows[0]) });
          return;
        }

        const inserted = await pool.query(
          `INSERT INTO ai_insights_pinned_queries (shop_id, question_text)
           VALUES ($1, $2)
           RETURNING id, question_text, pinned_at, last_run_at,
                     last_response_excerpt, display_order`,
          [shopId, questionText]
        );
        res.status(201).json({ success: true, data: rowToDto(inserted.rows[0]) });
      } catch (err) {
        logger.error("InsightsPinnedController.createPinned failed", err);
        res
          .status(500)
          .json({ success: false, error: "Failed to pin question" });
      }
    },

    /** DELETE /api/ai/insights/pinned/:id */
    deletePinned: async (req: Request, res: Response): Promise<void> => {
      try {
        const shopId = (req as any).user?.shopId;
        if (!shopId) {
          res.status(401).json({ success: false, error: "Shop ID required" });
          return;
        }
        const id = req.params.id;
        if (!id) {
          res.status(400).json({ success: false, error: "id required" });
          return;
        }
        const result = await pool.query(
          `DELETE FROM ai_insights_pinned_queries
           WHERE id = $1 AND shop_id = $2`,
          [id, shopId]
        );
        if (result.rowCount === 0) {
          res.status(404).json({ success: false, error: "Pinned query not found" });
          return;
        }
        res.json({ success: true });
      } catch (err) {
        logger.error("InsightsPinnedController.deletePinned failed", err);
        res
          .status(500)
          .json({ success: false, error: "Failed to unpin question" });
      }
    },

    /**
     * PUT /api/ai/insights/pinned/:id/run
     * Body: { excerpt: string }
     *
     * Called by the panel after a pinned-tap submit returns a reply,
     * so the Pinned tab can show a "last run" timestamp + preview.
     */
    recordRun: async (req: Request, res: Response): Promise<void> => {
      try {
        const shopId = (req as any).user?.shopId;
        if (!shopId) {
          res.status(401).json({ success: false, error: "Shop ID required" });
          return;
        }
        const id = req.params.id;
        const excerptRaw = (req.body as { excerpt?: unknown })?.excerpt;
        if (typeof excerptRaw !== "string") {
          res
            .status(400)
            .json({ success: false, error: "`excerpt` must be a string" });
          return;
        }
        const excerpt = excerptRaw.slice(0, MAX_EXCERPT_CHARS);

        const result = await pool.query(
          `UPDATE ai_insights_pinned_queries
           SET last_run_at = NOW(), last_response_excerpt = $1
           WHERE id = $2 AND shop_id = $3`,
          [excerpt, id, shopId]
        );
        if (result.rowCount === 0) {
          res.status(404).json({ success: false, error: "Pinned query not found" });
          return;
        }
        res.json({ success: true });
      } catch (err) {
        logger.error("InsightsPinnedController.recordRun failed", err);
        res
          .status(500)
          .json({ success: false, error: "Failed to record run" });
      }
    },
  };
}

let _defaultController: ReturnType<typeof makeInsightsPinnedController> | null = null;
function getDefaults() {
  if (!_defaultController) {
    _defaultController = makeInsightsPinnedController();
  }
  return _defaultController;
}

export function listPinned(req: Request, res: Response): Promise<void> {
  return getDefaults().listPinned(req, res);
}
export function createPinned(req: Request, res: Response): Promise<void> {
  return getDefaults().createPinned(req, res);
}
export function deletePinned(req: Request, res: Response): Promise<void> {
  return getDefaults().deletePinned(req, res);
}
export function recordPinnedRun(req: Request, res: Response): Promise<void> {
  return getDefaults().recordRun(req, res);
}
