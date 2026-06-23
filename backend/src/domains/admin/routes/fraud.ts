// backend/src/domains/admin/routes/fraud.ts
//
// Fraud & Abuse Detection — Phase 2 (admin review queue API).
// See docs/FRAUD_DETECTION_SPEC.md.
//
// Auth: the parent admin router (admin.ts) already applies authMiddleware +
// requireAdmin before mounting this, so all routes here are admin-only.

import { Router, Request, Response } from 'express';
import { getSharedPool } from '../../../utils/database-pool';
import { logger } from '../../../utils/logger';

const router = Router();

const VALID_STATUSES = ['open', 'investigating', 'confirmed', 'dismissed'] as const;
type FindingStatus = (typeof VALID_STATUSES)[number];

// GET /api/admin/fraud/summary — counts for the dashboard badge + header.
router.get('/fraud/summary', async (_req: Request, res: Response) => {
  try {
    const pool = getSharedPool();
    const { rows } = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'open')                          AS open,
        COUNT(*) FILTER (WHERE status = 'investigating')                 AS investigating,
        COUNT(*) FILTER (WHERE status = 'confirmed')                     AS confirmed,
        COUNT(*) FILTER (WHERE status = 'dismissed')                     AS dismissed,
        COUNT(*) FILTER (WHERE status = 'open' AND severity >= 70)       AS open_high_severity
      FROM fraud_findings
    `);
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    logger.error('Error fetching fraud summary:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch fraud summary' });
  }
});

// GET /api/admin/fraud/findings — list with filters.
//   ?status=open  &minSeverity=70  &subjectType=shop  &ruleKey=...  &limit=50
router.get('/fraud/findings', async (req: Request, res: Response) => {
  try {
    const pool = getSharedPool();
    const conditions: string[] = [];
    const params: unknown[] = [];

    const status = req.query.status as string | undefined;
    if (status && (VALID_STATUSES as readonly string[]).includes(status)) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    const minSeverity = parseInt(req.query.minSeverity as string, 10);
    if (!Number.isNaN(minSeverity)) {
      params.push(minSeverity);
      conditions.push(`severity >= $${params.length}`);
    }
    const subjectType = req.query.subjectType as string | undefined;
    if (subjectType) {
      params.push(subjectType);
      conditions.push(`subject_type = $${params.length}`);
    }
    const ruleKey = req.query.ruleKey as string | undefined;
    if (ruleKey) {
      params.push(ruleKey);
      conditions.push(`rule_key = $${params.length}`);
    }

    let limit = parseInt(req.query.limit as string, 10);
    if (Number.isNaN(limit) || limit < 1 || limit > 200) limit = 100;
    params.push(limit);

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT id, rule_key, severity, status, subject_type, shop_id,
              customer_address, window_start, window_end, metrics, explanation,
              recommended_action, created_at, reviewed_by, reviewed_at, resolution_note
       FROM fraud_findings
       ${where}
       ORDER BY (status = 'open') DESC, severity DESC, created_at DESC
       LIMIT $${params.length}`,
      params
    );
    res.json({ success: true, data: rows, count: rows.length });
  } catch (error) {
    logger.error('Error listing fraud findings:', error);
    res.status(500).json({ success: false, error: 'Failed to list fraud findings' });
  }
});

// GET /api/admin/fraud/findings/:id — single finding detail.
router.get('/fraud/findings/:id', async (req: Request, res: Response) => {
  try {
    const pool = getSharedPool();
    const { rows } = await pool.query(
      `SELECT * FROM fraud_findings WHERE id = $1`,
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Finding not found' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    logger.error('Error fetching fraud finding:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch finding' });
  }
});

// POST /api/admin/fraud/findings/:id/status — { status, note }
// Records the reviewing admin + timestamp + optional resolution note.
router.post('/fraud/findings/:id/status', async (req: Request, res: Response) => {
  try {
    const { status, note } = req.body as { status?: string; note?: string };
    if (!status || !(VALID_STATUSES as readonly string[]).includes(status)) {
      return res.status(400).json({
        success: false,
        error: `status must be one of: ${VALID_STATUSES.join(', ')}`,
      });
    }
    const adminAddress = (req as Request & { user?: { address?: string } }).user?.address || null;
    const pool = getSharedPool();
    const { rows } = await pool.query(
      `UPDATE fraud_findings
       SET status = $1,
           resolution_note = COALESCE($2, resolution_note),
           reviewed_by = $3,
           reviewed_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [status as FindingStatus, note ?? null, adminAddress, req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Finding not found' });
    }
    logger.info('Fraud finding status updated', {
      id: req.params.id,
      status,
      by: adminAddress,
    });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    logger.error('Error updating fraud finding status:', error);
    res.status(500).json({ success: false, error: 'Failed to update finding status' });
  }
});

export default router;
