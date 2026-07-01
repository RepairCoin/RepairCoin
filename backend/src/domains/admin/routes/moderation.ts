import { Router, Request, Response } from 'express';
import { ModerationRepository } from '../../../repositories/ModerationRepository';
import { logger } from '../../../utils/logger';

// Admin auth (authMiddleware + requireAdmin) is applied globally in admin.ts,
// so these routes are admin-only without extra middleware.
const router = Router();
const moderationRepo = new ModerationRepository();

interface AuthenticatedRequest extends Request {
  user?: {
    address: string;
    role: string;
    shopId?: string;
  };
}

// ==================== ISSUE REPORTS ====================

// GET /api/admin/moderation/reports
router.get('/reports', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status, severity } = req.query;
    const reports = await moderationRepo.getAllReports(
      status as any,
      severity as any
    );
    res.json({ success: true, data: reports });
  } catch (error) {
    logger.error('Admin: error fetching reports:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch reports' });
  }
});

// POST /api/admin/moderation/reports/:id/status
router.post('/reports/:id/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, adminNotes, resolutionDetails } = req.body;
    const adminWallet = req.user?.address || 'admin';

    if (!status) {
      return res.status(400).json({ success: false, error: 'status is required' });
    }

    await moderationRepo.updateReportStatus(
      id,
      status,
      adminWallet,
      adminNotes,
      resolutionDetails
    );
    res.json({ success: true, message: 'Report updated' });
  } catch (error) {
    logger.error('Admin: error updating report:', error);
    res.status(500).json({ success: false, error: 'Failed to update report' });
  }
});

// ==================== FLAGGED REVIEWS ====================

// GET /api/admin/moderation/flagged-reviews
router.get('/flagged-reviews', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status } = req.query;
    const reviews = await moderationRepo.getAllFlaggedReviews(status as any);
    res.json({ success: true, data: reviews });
  } catch (error) {
    logger.error('Admin: error fetching flagged reviews:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch flagged reviews' });
  }
});

// POST /api/admin/moderation/flagged-reviews/:id/status
router.post('/flagged-reviews/:id/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;
    const adminWallet = req.user?.address || 'admin';

    if (!status) {
      return res.status(400).json({ success: false, error: 'status is required' });
    }

    await moderationRepo.updateFlaggedReviewStatus(id, status, adminWallet, adminNotes);
    res.json({ success: true, message: 'Flagged review updated' });
  } catch (error) {
    logger.error('Admin: error updating flagged review:', error);
    res.status(500).json({ success: false, error: 'Failed to update flagged review' });
  }
});

export default router;
