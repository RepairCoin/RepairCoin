// backend/src/domains/ServiceDomain/controllers/DisputeController.ts
import { Request, Response } from 'express';
import { getSharedPool } from '../../../utils/database-pool';
import { logger } from '../../../utils/logger';
import { EmailService } from '../../../services/EmailService';

const emailService = new EmailService();

interface AuthenticatedRequest extends Request {
  user?: {
    address: string;
    role: string;
    shopId?: string;
  };
}

interface DisputeRow {
  id: string;
  customer_address: string;
  order_id: string;
  service_id: string;
  shop_id: string;
  scheduled_time: Date;
  marked_no_show_at: Date;
  marked_by: string | null;
  notes: string | null;
  grace_period_minutes: number;
  customer_tier_at_time: string | null;
  disputed: boolean;
  dispute_status: string | null;
  dispute_reason: string | null;
  dispute_submitted_at: Date | null;
  dispute_resolved_at: Date | null;
  dispute_resolved_by: string | null;
  dispute_resolution_notes: string | null;
  created_at: Date;
  // Joined fields
  service_name?: string;
  shop_name?: string;
  customer_name?: string;
  customer_email?: string;
}

function mapDisputeRow(row: DisputeRow) {
  return {
    id: row.id,
    customerAddress: row.customer_address,
    orderId: row.order_id,
    serviceId: row.service_id,
    shopId: row.shop_id,
    scheduledTime: row.scheduled_time,
    markedNoShowAt: row.marked_no_show_at,
    markedBy: row.marked_by,
    notes: row.notes,
    gracePeriodMinutes: row.grace_period_minutes,
    customerTierAtTime: row.customer_tier_at_time,
    disputed: row.disputed,
    disputeStatus: row.dispute_status,
    disputeReason: row.dispute_reason,
    disputeSubmittedAt: row.dispute_submitted_at,
    disputeResolvedAt: row.dispute_resolved_at,
    disputeResolvedBy: row.dispute_resolved_by,
    disputeResolutionNotes: row.dispute_resolution_notes,
    createdAt: row.created_at,
    // Optional joined
    serviceName: row.service_name,
    shopName: row.shop_name,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
  };
}

/**
 * POST /api/services/orders/:orderId/dispute
 * Customer submits a dispute for a no-show record
 */
export async function submitDispute(req: AuthenticatedRequest, res: Response): Promise<void> {
  const pool = getSharedPool();
  const { orderId } = req.params;
  const { reason } = req.body;
  const customerAddress = req.user?.address?.toLowerCase();

  if (!customerAddress) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
    res.status(400).json({
      success: false,
      error: 'Dispute reason is required and must be at least 10 characters'
    });
    return;
  }

  try {
    // Get the no-show record for this order
    const noShowResult = await pool.query<DisputeRow>(
      `SELECT nsh.*, s.service_name, sh.shop_name
       FROM no_show_history nsh
       LEFT JOIN services s ON s.service_id = nsh.service_id
       LEFT JOIN shops sh ON sh.shop_id = nsh.shop_id
       WHERE nsh.order_id = $1 AND LOWER(nsh.customer_address) = $2`,
      [orderId, customerAddress]
    );

    if (noShowResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'No-show record not found for this order' });
      return;
    }

    const noShow = noShowResult.rows[0];

    // Check if already disputed
    if (noShow.disputed) {
      res.status(409).json({
        success: false,
        error: `This no-show has already been disputed (status: ${noShow.dispute_status})`
      });
      return;
    }

    // Get shop policy to check if disputes are allowed and within window
    const policyResult = await pool.query(
      `SELECT allow_disputes, dispute_window_days, auto_approve_first_offense
       FROM shop_no_show_policy
       WHERE shop_id = $1`,
      [noShow.shop_id]
    );

    const policy = policyResult.rows[0];

    if (policy && !policy.allow_disputes) {
      res.status(403).json({
        success: false,
        error: 'This shop does not accept no-show disputes'
      });
      return;
    }

    // Check dispute window
    const disputeWindowDays = policy?.dispute_window_days ?? 7;
    const daysSinceNoShow = Math.floor(
      (Date.now() - new Date(noShow.marked_no_show_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceNoShow > disputeWindowDays) {
      res.status(403).json({
        success: false,
        error: `Dispute window has expired. Disputes must be submitted within ${disputeWindowDays} days of the no-show.`
      });
      return;
    }

    // Check auto-approve logic
    const autoApprove = policy?.auto_approve_first_offense ?? false;

    // Get customer's no-show count at this shop to check if this is first offense
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM no_show_history
       WHERE LOWER(customer_address) = $1 AND shop_id = $2`,
      [customerAddress, noShow.shop_id]
    );
    const totalNoShows = parseInt(countResult.rows[0].total, 10);
    const isFirstOffense = totalNoShows <= 1;

    const initialStatus = autoApprove && isFirstOffense ? 'approved' : 'pending';

    // Submit the dispute
    const updateResult = await pool.query<DisputeRow>(
      `UPDATE no_show_history
       SET disputed = TRUE,
           dispute_status = $1,
           dispute_reason = $2,
           dispute_submitted_at = NOW(),
           dispute_resolved_at = CASE WHEN $1 = 'approved' THEN NOW() ELSE NULL END,
           dispute_resolved_by = CASE WHEN $1 = 'approved' THEN 'system_auto' ELSE NULL END,
           dispute_resolution_notes = CASE WHEN $1 = 'approved' THEN 'Auto-approved: first offense policy' ELSE NULL END
       WHERE id = $3
       RETURNING *`,
      [initialStatus, reason.trim(), noShow.id]
    );

    const updatedDispute = updateResult.rows[0];

    // If auto-approved, reverse the no-show penalty
    if (initialStatus === 'approved') {
      await reverseNoShowPenalty(pool, noShow.customer_address, noShow.shop_id, noShow.id);
    }

    logger.info(`Dispute submitted for no-show ${noShow.id} by customer ${customerAddress} - status: ${initialStatus}`);

    // Send email notification (non-blocking)
    const customerResult = await pool.query(
      `SELECT email, name FROM customers WHERE LOWER(address) = LOWER($1)`,
      [customerAddress]
    );
    const customer = customerResult.rows[0];
    if (customer?.email) {
      emailService.sendDisputeSubmitted({
        customerEmail: customer.email,
        customerName: customer.name || 'Customer',
        shopName: noShow.shop_name || 'the shop',
        appointmentDate: new Date(noShow.scheduled_time),
        disputeReason: reason.trim(),
        autoApproved: initialStatus === 'approved',
      }).catch(err => logger.error('Failed to send dispute submission email:', err));
    }

    res.status(201).json({
      success: true,
      data: mapDisputeRow({ ...updatedDispute, service_name: noShow.service_name, shop_name: noShow.shop_name }),
      autoApproved: initialStatus === 'approved',
      message: initialStatus === 'approved'
        ? 'Your dispute has been automatically approved. The no-show penalty has been reversed.'
        : 'Your dispute has been submitted and is pending shop review.'
    });
  } catch (error) {
    logger.error('Error submitting dispute:', error);
    res.status(500).json({ success: false, error: 'Failed to submit dispute' });
  }
}

/**
 * GET /api/services/orders/:orderId/dispute
 * Get dispute status for an order (customer or shop)
 */
export async function getDisputeStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  const pool = getSharedPool();
  const { orderId } = req.params;
  const userAddress = req.user?.address?.toLowerCase();
  const userRole = req.user?.role;

  if (!userAddress) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }

  try {
    let query: string;
    let params: (string | undefined)[];

    if (userRole === 'admin') {
      query = `SELECT nsh.*, s.service_name, sh.shop_name
               FROM no_show_history nsh
               LEFT JOIN services s ON s.service_id = nsh.service_id
               LEFT JOIN shops sh ON sh.shop_id = nsh.shop_id
               WHERE nsh.order_id = $1`;
      params = [orderId];
    } else if (userRole === 'shop') {
      query = `SELECT nsh.*, s.service_name, sh.shop_name
               FROM no_show_history nsh
               LEFT JOIN services s ON s.service_id = nsh.service_id
               LEFT JOIN shops sh ON sh.shop_id = nsh.shop_id
               WHERE nsh.order_id = $1 AND nsh.shop_id = $2`;
      params = [orderId, req.user?.shopId];
    } else {
      query = `SELECT nsh.*, s.service_name, sh.shop_name
               FROM no_show_history nsh
               LEFT JOIN services s ON s.service_id = nsh.service_id
               LEFT JOIN shops sh ON sh.shop_id = nsh.shop_id
               WHERE nsh.order_id = $1 AND LOWER(nsh.customer_address) = $2`;
      params = [orderId, userAddress];
    }

    const result = await pool.query<DisputeRow>(query, params);

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'No-show record not found for this order' });
      return;
    }

    res.json({ success: true, data: mapDisputeRow(result.rows[0]) });
  } catch (error) {
    logger.error('Error getting dispute status:', error);
    res.status(500).json({ success: false, error: 'Failed to get dispute status' });
  }
}

/**
 * GET /api/services/shops/:shopId/disputes
 * List disputes for a shop
 */
export async function getShopDisputes(req: AuthenticatedRequest, res: Response): Promise<void> {
  const pool = getSharedPool();
  const { shopId } = req.params;
  const { status, limit = '20', offset = '0' } = req.query;

  // Verify shop ownership
  if (req.user?.role !== 'admin' && req.user?.shopId !== shopId) {
    res.status(403).json({ success: false, error: 'Access denied' });
    return;
  }

  try {
    let whereClause = 'WHERE nsh.shop_id = $1 AND nsh.disputed = TRUE';
    const params: (string | number)[] = [shopId];
    let paramIndex = 2;

    if (status && status !== 'all') {
      whereClause += ` AND nsh.dispute_status = $${paramIndex}`;
      params.push(status as string);
      paramIndex++;
    }

    const result = await pool.query<DisputeRow>(
      `SELECT nsh.*, s.service_name, sh.shop_name,
              c.name as customer_name, c.email as customer_email
       FROM no_show_history nsh
       LEFT JOIN services s ON s.service_id = nsh.service_id
       LEFT JOIN shops sh ON sh.shop_id = nsh.shop_id
       LEFT JOIN customers c ON LOWER(c.address) = LOWER(nsh.customer_address)
       ${whereClause}
       ORDER BY nsh.dispute_submitted_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, parseInt(limit as string, 10), parseInt(offset as string, 10)]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) as total,
              COUNT(CASE WHEN dispute_status = 'pending' THEN 1 END) as pending_count
       FROM no_show_history
       WHERE shop_id = $1 AND disputed = TRUE`,
      [shopId]
    );

    res.json({
      success: true,
      data: {
        disputes: result.rows.map(row => mapDisputeRow(row)),
        total: parseInt(countResult.rows[0].total, 10),
        pendingCount: parseInt(countResult.rows[0].pending_count, 10)
      }
    });
  } catch (error) {
    logger.error('Error getting shop disputes:', error);
    res.status(500).json({ success: false, error: 'Failed to get shop disputes' });
  }
}

/**
 * PUT /api/services/shops/:shopId/disputes/:id/approve
 * Shop approves a dispute
 */
export async function approveDispute(req: AuthenticatedRequest, res: Response): Promise<void> {
  const pool = getSharedPool();
  const { shopId, id } = req.params;
  const { resolutionNotes } = req.body;

  // Verify shop ownership
  if (req.user?.role !== 'admin' && req.user?.shopId !== shopId) {
    res.status(403).json({ success: false, error: 'Access denied' });
    return;
  }

  try {
    const noShowResult = await pool.query<DisputeRow>(
      `SELECT * FROM no_show_history WHERE id = $1 AND shop_id = $2`,
      [id, shopId]
    );

    if (noShowResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Dispute not found' });
      return;
    }

    const noShow = noShowResult.rows[0];

    if (!noShow.disputed) {
      res.status(400).json({ success: false, error: 'This record has no active dispute' });
      return;
    }

    if (noShow.dispute_status !== 'pending') {
      res.status(409).json({
        success: false,
        error: `Dispute is already ${noShow.dispute_status}. Only pending disputes can be approved.`
      });
      return;
    }

    // Approve the dispute
    const updateResult = await pool.query<DisputeRow>(
      `UPDATE no_show_history
       SET dispute_status = 'approved',
           dispute_resolved_at = NOW(),
           dispute_resolved_by = $1,
           dispute_resolution_notes = $2
       WHERE id = $3
       RETURNING *`,
      [req.user?.address?.toLowerCase(), resolutionNotes?.trim() || null, id]
    );

    // Reverse no-show penalty
    await reverseNoShowPenalty(pool, noShow.customer_address, noShow.shop_id, noShow.id);

    logger.info(`Dispute ${id} approved by shop ${shopId}`);

    // Send email notification to customer (non-blocking)
    const customerResult = await pool.query(
      `SELECT c.email, c.name, sh.shop_name
       FROM customers c, shops sh
       WHERE LOWER(c.address) = LOWER($1) AND sh.shop_id = $2`,
      [noShow.customer_address, noShow.shop_id]
    );
    const customerData = customerResult.rows[0];
    if (customerData?.email) {
      emailService.sendDisputeResolved({
        customerEmail: customerData.email,
        customerName: customerData.name || 'Customer',
        shopName: customerData.shop_name || 'the shop',
        appointmentDate: new Date(noShow.scheduled_time),
        resolution: 'approved',
        resolutionNotes: resolutionNotes?.trim(),
      }).catch(err => logger.error('Failed to send dispute resolution email:', err));
    }

    res.json({
      success: true,
      data: mapDisputeRow(updateResult.rows[0]),
      message: 'Dispute approved. The no-show penalty has been reversed.'
    });
  } catch (error) {
    logger.error('Error approving dispute:', error);
    res.status(500).json({ success: false, error: 'Failed to approve dispute' });
  }
}

/**
 * PUT /api/services/shops/:shopId/disputes/:id/reject
 * Shop rejects a dispute
 */
export async function rejectDispute(req: AuthenticatedRequest, res: Response): Promise<void> {
  const pool = getSharedPool();
  const { shopId, id } = req.params;
  const { resolutionNotes } = req.body;

  // Verify shop ownership
  if (req.user?.role !== 'admin' && req.user?.shopId !== shopId) {
    res.status(403).json({ success: false, error: 'Access denied' });
    return;
  }

  if (!resolutionNotes || resolutionNotes.trim().length < 10) {
    res.status(400).json({
      success: false,
      error: 'A rejection reason is required (minimum 10 characters)'
    });
    return;
  }

  try {
    const noShowResult = await pool.query<DisputeRow>(
      `SELECT * FROM no_show_history WHERE id = $1 AND shop_id = $2`,
      [id, shopId]
    );

    if (noShowResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Dispute not found' });
      return;
    }

    const noShow = noShowResult.rows[0];

    if (!noShow.disputed) {
      res.status(400).json({ success: false, error: 'This record has no active dispute' });
      return;
    }

    if (noShow.dispute_status !== 'pending') {
      res.status(409).json({
        success: false,
        error: `Dispute is already ${noShow.dispute_status}. Only pending disputes can be rejected.`
      });
      return;
    }

    const updateResult = await pool.query<DisputeRow>(
      `UPDATE no_show_history
       SET dispute_status = 'rejected',
           dispute_resolved_at = NOW(),
           dispute_resolved_by = $1,
           dispute_resolution_notes = $2
       WHERE id = $3
       RETURNING *`,
      [req.user?.address?.toLowerCase(), resolutionNotes.trim(), id]
    );

    logger.info(`Dispute ${id} rejected by shop ${shopId}`);

    // Send email notification to customer (non-blocking)
    const rejectCustomerResult = await pool.query(
      `SELECT c.email, c.name, sh.shop_name
       FROM customers c, shops sh
       WHERE LOWER(c.address) = LOWER($1) AND sh.shop_id = $2`,
      [noShow.customer_address, noShow.shop_id]
    );
    const rejectCustomerData = rejectCustomerResult.rows[0];
    if (rejectCustomerData?.email) {
      emailService.sendDisputeResolved({
        customerEmail: rejectCustomerData.email,
        customerName: rejectCustomerData.name || 'Customer',
        shopName: rejectCustomerData.shop_name || 'the shop',
        appointmentDate: new Date(noShow.scheduled_time),
        resolution: 'rejected',
        resolutionNotes: resolutionNotes?.trim(),
      }).catch(err => logger.error('Failed to send dispute rejection email:', err));
    }

    res.json({
      success: true,
      data: mapDisputeRow(updateResult.rows[0]),
      message: 'Dispute rejected. The no-show penalty remains in effect.'
    });
  } catch (error) {
    logger.error('Error rejecting dispute:', error);
    res.status(500).json({ success: false, error: 'Failed to reject dispute' });
  }
}

/**
 * GET /api/admin/disputes
 * Admin view all disputes across platform
 */
export async function getAdminDisputes(req: AuthenticatedRequest, res: Response): Promise<void> {
  const pool = getSharedPool();
  const { status, shopId, limit = '50', offset = '0' } = req.query;

  try {
    let whereClause = 'WHERE nsh.disputed = TRUE';
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (status && status !== 'all') {
      whereClause += ` AND nsh.dispute_status = $${paramIndex}`;
      params.push(status as string);
      paramIndex++;
    }

    if (shopId) {
      whereClause += ` AND nsh.shop_id = $${paramIndex}`;
      params.push(shopId as string);
      paramIndex++;
    }

    const result = await pool.query<DisputeRow>(
      `SELECT nsh.*, s.service_name, sh.shop_name,
              c.name as customer_name, c.email as customer_email
       FROM no_show_history nsh
       LEFT JOIN services s ON s.service_id = nsh.service_id
       LEFT JOIN shops sh ON sh.shop_id = nsh.shop_id
       LEFT JOIN customers c ON LOWER(c.address) = LOWER(nsh.customer_address)
       ${whereClause}
       ORDER BY nsh.dispute_submitted_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, parseInt(limit as string, 10), parseInt(offset as string, 10)]
    );

    const statsResult = await pool.query(
      `SELECT
         COUNT(*) as total,
         COUNT(CASE WHEN dispute_status = 'pending' THEN 1 END) as pending,
         COUNT(CASE WHEN dispute_status = 'approved' THEN 1 END) as approved,
         COUNT(CASE WHEN dispute_status = 'rejected' THEN 1 END) as rejected
       FROM no_show_history
       WHERE disputed = TRUE`
    );

    res.json({
      success: true,
      data: {
        disputes: result.rows.map(row => mapDisputeRow(row)),
        stats: {
          total: parseInt(statsResult.rows[0].total, 10),
          pending: parseInt(statsResult.rows[0].pending, 10),
          approved: parseInt(statsResult.rows[0].approved, 10),
          rejected: parseInt(statsResult.rows[0].rejected, 10)
        }
      }
    });
  } catch (error) {
    logger.error('Error getting admin disputes:', error);
    res.status(500).json({ success: false, error: 'Failed to get disputes' });
  }
}

/**
 * PUT /api/admin/disputes/:id/resolve
 * Admin resolves a dispute (override shop decision)
 */
export async function adminResolveDispute(req: AuthenticatedRequest, res: Response): Promise<void> {
  const pool = getSharedPool();
  const { id } = req.params;
  const { resolution, resolutionNotes } = req.body;

  if (!resolution || !['approved', 'rejected'].includes(resolution)) {
    res.status(400).json({
      success: false,
      error: 'Resolution must be "approved" or "rejected"'
    });
    return;
  }

  if (!resolutionNotes || resolutionNotes.trim().length < 10) {
    res.status(400).json({
      success: false,
      error: 'Admin resolution notes are required (minimum 10 characters)'
    });
    return;
  }

  try {
    const noShowResult = await pool.query<DisputeRow>(
      `SELECT * FROM no_show_history WHERE id = $1`,
      [id]
    );

    if (noShowResult.rows.length === 0) {
      res.status(404).json({ success: false, error: 'No-show record not found' });
      return;
    }

    const noShow = noShowResult.rows[0];

    if (!noShow.disputed) {
      res.status(400).json({ success: false, error: 'This record has no active dispute' });
      return;
    }

    const previousStatus = noShow.dispute_status;

    // Admin resolve
    const updateResult = await pool.query<DisputeRow>(
      `UPDATE no_show_history
       SET dispute_status = $1,
           dispute_resolved_at = NOW(),
           dispute_resolved_by = $2,
           dispute_resolution_notes = $3
       WHERE id = $4
       RETURNING *`,
      [resolution, `admin:${req.user?.address?.toLowerCase()}`, resolutionNotes.trim(), id]
    );

    // If approving (and not already approved), reverse penalty
    if (resolution === 'approved' && previousStatus !== 'approved') {
      await reverseNoShowPenalty(pool, noShow.customer_address, noShow.shop_id, noShow.id);
    }

    logger.info(`Dispute ${id} resolved by admin as ${resolution}`);

    res.json({
      success: true,
      data: mapDisputeRow(updateResult.rows[0]),
      message: resolution === 'approved'
        ? 'Dispute approved by admin. No-show penalty reversed.'
        : 'Dispute rejected by admin. No-show penalty upheld.'
    });
  } catch (error) {
    logger.error('Error resolving dispute as admin:', error);
    res.status(500).json({ success: false, error: 'Failed to resolve dispute' });
  }
}

/**
 * Helper: Reverse a no-show penalty by decrementing the customer's no-show count
 * and recalculating their tier
 */
async function reverseNoShowPenalty(
  pool: ReturnType<typeof getSharedPool>,
  customerAddress: string,
  shopId: string,
  noShowHistoryId: string
): Promise<void> {
  try {
    // Mark this no-show as reversed so it's not counted
    await pool.query(
      `UPDATE no_show_history SET notes = COALESCE(notes || ' ', '') || '[DISPUTE_REVERSED]'
       WHERE id = $1`,
      [noShowHistoryId]
    );

    // Recalculate effective no-show count (excluding reversed ones)
    const countResult = await pool.query(
      `SELECT COUNT(*) as effective_count
       FROM no_show_history
       WHERE LOWER(customer_address) = LOWER($1)
         AND shop_id = $2
         AND (notes IS NULL OR notes NOT LIKE '%[DISPUTE_REVERSED]%')`,
      [customerAddress, shopId]
    );

    const effectiveCount = parseInt(countResult.rows[0].effective_count, 10);

    // Recalculate tier based on effective count
    let newTier = 'normal';
    const policyResult = await pool.query(
      `SELECT caution_threshold, deposit_threshold, suspension_threshold
       FROM shop_no_show_policy WHERE shop_id = $1`,
      [shopId]
    );

    if (policyResult.rows.length > 0) {
      const policy = policyResult.rows[0];
      if (effectiveCount >= policy.suspension_threshold) {
        newTier = 'suspended';
      } else if (effectiveCount >= policy.deposit_threshold) {
        newTier = 'deposit_required';
      } else if (effectiveCount >= policy.caution_threshold) {
        newTier = 'caution';
      } else if (effectiveCount >= 1) {
        newTier = 'warning';
      }
    }

    // Update customer no-show stats
    await pool.query(
      `UPDATE customers
       SET no_show_count = GREATEST(0, no_show_count - 1),
           no_show_tier = $1,
           updated_at = NOW()
       WHERE LOWER(address) = LOWER($2)`,
      [newTier, customerAddress]
    );

    logger.info(`Reversed no-show penalty for ${customerAddress} at shop ${shopId}. New tier: ${newTier}`);
  } catch (error) {
    logger.error('Error reversing no-show penalty:', error);
    throw error;
  }
}
