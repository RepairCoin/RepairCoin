// backend/src/domains/shop/routes/welcomeRcn.ts
//
// Shop-facing settings for "Welcome RCN on claim" — the one-time RCN reward a shop grants when
// an imported/migrated customer claims their account (Square→FixFlow win-back incentive).
// Shop-funded + opt-in; off-chain credit. See
// docs/tasks/strategy/customer-migration/welcome-rcn-on-claim-scope.md.
//
// Mounted at /api/shops/welcome-rcn (auth + shop role applied at mount).
import { Router, Request, Response } from 'express';
import { logger } from '../../../utils/logger';
import { getSharedPool } from '../../../utils/database-pool';
import { isWelcomeRcnEnabled, resolveWelcomeRcnAmount } from '../../../config/welcomeRcn';

const router = Router();
const pool = getSharedPool();

/**
 * GET /api/shops/welcome-rcn
 * Returns this shop's welcome-RCN config + context the UI needs to render honestly:
 *   - featureEnabled: platform kill-switch (ENABLE_WELCOME_RCN). When false the shop's toggle
 *     has no effect; the UI should say so.
 *   - enabled / amount: the shop's own opt-in + optional override (amount null = use default).
 *   - defaultAmount: the global default applied when amount is blank.
 *   - effectiveAmount: what a grant would actually be right now.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const shopId = req.user?.shopId;
    if (!shopId) {
      return res.status(400).json({ success: false, error: 'Shop ID not found' });
    }

    const result = await pool.query(
      `SELECT welcome_rcn_enabled, welcome_rcn_amount FROM shops WHERE shop_id = $1`,
      [shopId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }

    const row = result.rows[0];
    const amount = row.welcome_rcn_amount != null ? parseFloat(row.welcome_rcn_amount) : null;

    return res.json({
      success: true,
      data: {
        featureEnabled: isWelcomeRcnEnabled(),
        enabled: row.welcome_rcn_enabled === true,
        amount, // null = use default
        defaultAmount: resolveWelcomeRcnAmount(null),
        effectiveAmount: resolveWelcomeRcnAmount(amount),
      },
    });
  } catch (error: any) {
    logger.error('Error fetching welcome-RCN settings:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch welcome-RCN settings' });
  }
});

/**
 * PUT /api/shops/welcome-rcn
 * Body: { enabled?: boolean, amount?: number | null }
 *   - enabled: opt this shop in/out.
 *   - amount: per-shop override (positive number); null/omitted-with-explicit-null clears it to
 *     fall back on the global default. A non-positive amount is rejected.
 */
router.put('/', async (req: Request, res: Response) => {
  try {
    const shopId = req.user?.shopId;
    if (!shopId) {
      return res.status(400).json({ success: false, error: 'Shop ID not found' });
    }

    const { enabled, amount } = req.body ?? {};

    if (enabled !== undefined && typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, error: 'enabled must be a boolean' });
    }

    // amount: undefined = leave unchanged; null = clear (use default); number > 0 = set override.
    let amountProvided = false;
    let amountValue: number | null = null;
    if (amount !== undefined) {
      amountProvided = true;
      if (amount === null) {
        amountValue = null;
      } else {
        const n = Number(amount);
        if (!Number.isFinite(n) || n <= 0) {
          return res.status(400).json({ success: false, error: 'amount must be a positive number or null' });
        }
        amountValue = n;
      }
    }

    const result = await pool.query(
      `UPDATE shops
          SET welcome_rcn_enabled = COALESCE($2, welcome_rcn_enabled),
              welcome_rcn_amount  = CASE WHEN $3 THEN $4 ELSE welcome_rcn_amount END,
              updated_at = CURRENT_TIMESTAMP
        WHERE shop_id = $1
        RETURNING welcome_rcn_enabled, welcome_rcn_amount`,
      [shopId, enabled === undefined ? null : enabled, amountProvided, amountValue]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Shop not found' });
    }

    const row = result.rows[0];
    const newAmount = row.welcome_rcn_amount != null ? parseFloat(row.welcome_rcn_amount) : null;
    logger.info('Welcome-RCN settings updated', { shopId, enabled: row.welcome_rcn_enabled, amount: newAmount });

    return res.json({
      success: true,
      data: {
        featureEnabled: isWelcomeRcnEnabled(),
        enabled: row.welcome_rcn_enabled === true,
        amount: newAmount,
        defaultAmount: resolveWelcomeRcnAmount(null),
        effectiveAmount: resolveWelcomeRcnAmount(newAmount),
      },
    });
  } catch (error: any) {
    logger.error('Error updating welcome-RCN settings:', error);
    return res.status(500).json({ success: false, error: 'Failed to update welcome-RCN settings' });
  }
});

export default router;
