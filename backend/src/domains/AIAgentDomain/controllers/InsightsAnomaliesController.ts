// backend/src/domains/AIAgentDomain/controllers/InsightsAnomaliesController.ts
//
// Phase 7.2.14 + 7.2.15 — read + dismiss endpoints for the
// insights anomaly banner.
//
//   GET  /api/ai/insights/anomalies          — list active (un-dismissed,
//                                               un-expired) for this shop
//   POST /api/ai/insights/anomalies/:id/dismiss — soft-dismiss one row
//
// Active set = max 3 most-recently-detected. Shop-scoped via JWT
// (ctx.user.shopId) — never trusts the URL or body for scope.
//
// Frontend banner (Phase 7.2.16/7.2.17) consumes GET on panel mount;
// taps "Dismiss" on a banner → POST → row's `dismissed_at` set →
// next mount no longer surfaces it.

import { Request, Response } from "express";
import { Pool } from "pg";
import { logger } from "../../../utils/logger";
import { getSharedPool } from "../../../utils/database-pool";

export interface AnomalyDto {
  id: string;
  metricKey: string;
  detectedAt: string;
  severity: "low" | "medium" | "high";
  currentValue: number;
  priorValue: number;
  deltaPct: number | null;
  /** Claude-phrased one-sentence summary, OR null if phrasing
   *  failed — banner falls back to a template phrase. */
  phrasing: string | null;
  followUpQuestion: string | null;
}

export interface InsightsAnomaliesControllerDeps {
  pool?: Pool;
}

export function makeInsightsAnomaliesController(
  deps: InsightsAnomaliesControllerDeps = {}
) {
  const pool = deps.pool ?? getSharedPool();

  return {
    listAnomalies: async (req: Request, res: Response): Promise<void> => {
      try {
        const shopId = (req as any).user?.shopId;
        if (!shopId) {
          res.status(401).json({ success: false, error: "Shop ID required" });
          return;
        }
        const rows = await pool.query<{
          id: string;
          metric_key: string;
          detected_at: Date;
          severity: "low" | "medium" | "high";
          current_value: string;
          prior_value: string;
          delta_pct: string | null;
          claude_phrasing: string | null;
          follow_up_question: string | null;
        }>(
          `SELECT id, metric_key, detected_at, severity,
                  current_value, prior_value, delta_pct,
                  claude_phrasing, follow_up_question
           FROM ai_insights_anomalies
           WHERE shop_id = $1
             AND dismissed_at IS NULL
             AND expires_at > NOW()
           ORDER BY detected_at DESC
           LIMIT 3`,
          [shopId]
        );

        const anomalies: AnomalyDto[] = rows.rows.map((r) => ({
          id: r.id,
          metricKey: r.metric_key,
          detectedAt: r.detected_at.toISOString(),
          severity: r.severity,
          currentValue: Number(r.current_value),
          priorValue: Number(r.prior_value),
          deltaPct: r.delta_pct === null ? null : Number(r.delta_pct),
          phrasing: r.claude_phrasing,
          followUpQuestion: r.follow_up_question,
        }));

        res.json({ success: true, data: { anomalies } });
      } catch (err) {
        logger.error("InsightsAnomaliesController.listAnomalies failed", err);
        res
          .status(500)
          .json({ success: false, error: "Failed to load anomalies" });
      }
    },

    dismissAnomaly: async (req: Request, res: Response): Promise<void> => {
      try {
        const shopId = (req as any).user?.shopId;
        if (!shopId) {
          res.status(401).json({ success: false, error: "Shop ID required" });
          return;
        }
        const id = req.params.id;
        if (!id || typeof id !== "string") {
          res.status(400).json({ success: false, error: "id required" });
          return;
        }
        // Shop-scope the UPDATE — owner can only dismiss their own
        // anomalies. Failed dismiss = 404 to avoid leaking existence.
        const result = await pool.query(
          `UPDATE ai_insights_anomalies
           SET dismissed_at = NOW()
           WHERE id = $1 AND shop_id = $2 AND dismissed_at IS NULL`,
          [id, shopId]
        );
        if (result.rowCount === 0) {
          res
            .status(404)
            .json({ success: false, error: "Anomaly not found" });
          return;
        }
        res.json({ success: true });
      } catch (err) {
        logger.error("InsightsAnomaliesController.dismissAnomaly failed", err);
        res
          .status(500)
          .json({ success: false, error: "Failed to dismiss anomaly" });
      }
    },
  };
}

let _defaultController: ReturnType<
  typeof makeInsightsAnomaliesController
> | null = null;
function getDefaults() {
  if (!_defaultController) {
    _defaultController = makeInsightsAnomaliesController();
  }
  return _defaultController;
}

export function listAnomalies(req: Request, res: Response): Promise<void> {
  return getDefaults().listAnomalies(req, res);
}
export function dismissAnomaly(req: Request, res: Response): Promise<void> {
  return getDefaults().dismissAnomaly(req, res);
}
