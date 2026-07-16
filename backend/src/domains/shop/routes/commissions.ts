// backend/src/domains/shop/routes/commissions.ts
//
// Shop-facing staff-commission settings: opt-in toggle + default rate. The per-member
// override rides PUT /api/shops/team/:memberId. Track-and-report only; see
// docs/STAFF_COMMISSIONS_PLAN.md.
//
// Mounted at /api/shops/commissions (auth + shop role + teamManagement tier applied at mount).
import { Router, Request, Response } from 'express';
import { logger } from '../../../utils/logger';
import { getSharedPool } from '../../../utils/database-pool';

const router = Router();
const pool = getSharedPool();

router.get('/settings', async (req: Request, res: Response) => {
  try {
    const shopId = req.user?.shopId;
    if (!shopId) {
      return res.status(400).json({ success: false, error: 'Shop ID not found' });
    }

    const result = await pool.query(
      `SELECT commissions_enabled, default_commission_percent FROM shops WHERE shop_id = $1`,
      [shopId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }

    const row = result.rows[0];
    return res.json({
      success: true,
      data: {
        enabled: row.commissions_enabled === true,
        defaultPercent: parseFloat(row.default_commission_percent ?? 0),
      },
    });
  } catch (error: any) {
    logger.error('Error fetching commission settings:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch commission settings' });
  }
});

router.put('/settings', async (req: Request, res: Response) => {
  try {
    const shopId = req.user?.shopId;
    if (!shopId) {
      return res.status(400).json({ success: false, error: 'Shop ID not found' });
    }

    const { enabled, defaultPercent } = req.body ?? {};

    if (enabled !== undefined && typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, error: 'enabled must be a boolean' });
    }

    let percentProvided = false;
    let percentValue = 0;
    if (defaultPercent !== undefined) {
      percentProvided = true;
      const n = Number(defaultPercent);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        return res.status(400).json({ success: false, error: 'defaultPercent must be between 0 and 100' });
      }
      percentValue = n;
    }

    const result = await pool.query(
      `UPDATE shops
          SET commissions_enabled = COALESCE($2, commissions_enabled),
              default_commission_percent = CASE WHEN $3 THEN $4 ELSE default_commission_percent END,
              updated_at = CURRENT_TIMESTAMP
        WHERE shop_id = $1
        RETURNING commissions_enabled, default_commission_percent`,
      [shopId, enabled === undefined ? null : enabled, percentProvided, percentValue]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }

    const row = result.rows[0];
    logger.info('Commission settings updated', {
      shopId,
      enabled: row.commissions_enabled,
      defaultPercent: row.default_commission_percent,
    });

    return res.json({
      success: true,
      data: {
        enabled: row.commissions_enabled === true,
        defaultPercent: parseFloat(row.default_commission_percent ?? 0),
      },
    });
  } catch (error: any) {
    logger.error('Error updating commission settings:', error);
    return res.status(500).json({ success: false, error: 'Failed to update commission settings' });
  }
});

// GET /api/shops/commissions?from&to&memberId&status — ledger rows + per-member totals.
router.get('/', async (req: Request, res: Response) => {
  try {
    const shopId = req.user?.shopId;
    if (!shopId) {
      return res.status(400).json({ success: false, error: 'Shop ID not found' });
    }

    const { from, to, memberId, status } = req.query as {
      from?: string; to?: string; memberId?: string; status?: string;
    };

    const result = await pool.query(
      `SELECT sc.id, sc.order_id, sc.member_id,
              tm.name AS member_name, tm.email AS member_email,
              sc.base_amount, sc.rate_percent, sc.amount, sc.status, sc.created_at, sc.paid_at
         FROM staff_commissions sc
         LEFT JOIN shop_team_members tm ON tm.id = sc.member_id
        WHERE sc.shop_id = $1
          AND ($2::date IS NULL OR sc.created_at >= $2::date)
          AND ($3::date IS NULL OR sc.created_at < ($3::date + INTERVAL '1 day'))
          AND ($4::uuid IS NULL OR sc.member_id = $4::uuid)
          AND ($5::text IS NULL OR sc.status = $5)
        ORDER BY sc.created_at DESC`,
      [shopId, from || null, to || null, memberId || null, status || null]
    );

    const rows = result.rows.map((r) => ({
      id: r.id,
      orderId: r.order_id,
      memberId: r.member_id,
      memberName: r.member_name || r.member_email || 'Unknown',
      baseAmount: parseFloat(r.base_amount),
      ratePercent: parseFloat(r.rate_percent),
      amount: parseFloat(r.amount),
      status: r.status,
      createdAt: r.created_at,
      paidAt: r.paid_at,
    }));

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const byMember = new Map<string, {
      memberId: string; memberName: string;
      accruedAmount: number; paidAmount: number; totalAmount: number; count: number;
    }>();
    for (const row of rows) {
      let s = byMember.get(row.memberId);
      if (!s) {
        s = { memberId: row.memberId, memberName: row.memberName, accruedAmount: 0, paidAmount: 0, totalAmount: 0, count: 0 };
        byMember.set(row.memberId, s);
      }
      s.count += 1;
      if (row.status === 'accrued') s.accruedAmount += row.amount;
      if (row.status === 'paid') s.paidAmount += row.amount;
      if (row.status !== 'voided') s.totalAmount += row.amount;
    }
    const summary = Array.from(byMember.values()).map((s) => ({
      ...s,
      accruedAmount: round2(s.accruedAmount),
      paidAmount: round2(s.paidAmount),
      totalAmount: round2(s.totalAmount),
    }));

    return res.json({ success: true, data: { summary, rows } });
  } catch (error: any) {
    logger.error('Error fetching commissions:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch commissions' });
  }
});

// POST /api/shops/commissions/mark-paid — flip accrued → paid over a range, stamping paid_by.
router.post('/mark-paid', async (req: Request, res: Response) => {
  try {
    const shopId = req.user?.shopId;
    if (!shopId) {
      return res.status(400).json({ success: false, error: 'Shop ID not found' });
    }
    const paidBy = req.user?.address ?? null;
    const { from, to, memberId, payoutNote } = req.body ?? {};

    const result = await pool.query(
      `UPDATE staff_commissions
          SET status = 'paid', paid_at = NOW(), paid_by = $2,
              payout_note = COALESCE($6, payout_note)
        WHERE shop_id = $1 AND status = 'accrued'
          AND ($3::date IS NULL OR created_at >= $3::date)
          AND ($4::date IS NULL OR created_at < ($4::date + INTERVAL '1 day'))
          AND ($5::uuid IS NULL OR member_id = $5::uuid)
        RETURNING amount`,
      [shopId, paidBy, from || null, to || null, memberId || null, payoutNote || null]
    );

    const count = result.rowCount ?? 0;
    const totalPaid = Math.round(result.rows.reduce((sum, r) => sum + parseFloat(r.amount), 0) * 100) / 100;
    logger.info('Commissions marked paid', { shopId, count, totalPaid, paidBy });

    return res.json({ success: true, data: { count, totalPaid } });
  } catch (error: any) {
    logger.error('Error marking commissions paid:', error);
    return res.status(500).json({ success: false, error: 'Failed to mark commissions paid' });
  }
});

export default router;
