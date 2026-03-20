import { Router, Request, Response } from 'express';
import { ModerationRepository } from '../../../repositories/ModerationRepository';
import { logger } from '../../../utils/logger';

const router = Router();
const moderationRepo = new ModerationRepository();

interface AuthenticatedRequest extends Request {
  user?: {
    address: string;
    role: string;
    shopId?: string;
  };
  body: any;
  query: any;
}

// ==================== BLOCKED CUSTOMERS ====================

// Get all blocked customers for a shop
router.get('/blocked-customers', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const shopId = req.user?.shopId;

    if (!shopId) {
      return res.status(401).json({
        success: false,
        error: 'Shop authentication required'
      });
    }

    const blockedCustomers = await moderationRepo.getBlockedCustomers(shopId);

    res.json({
      success: true,
      data: blockedCustomers
    });
  } catch (error) {
    logger.error('Error fetching blocked customers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch blocked customers'
    });
  }
});

// Block a customer
router.post('/block-customer', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const shopId = req.user?.shopId;
    const { customerWalletAddress, reason } = req.body;
    const blockedBy = req.user?.address;

    if (!shopId) {
      return res.status(401).json({
        success: false,
        error: 'Shop authentication required'
      });
    }

    // Validate input
    if (!customerWalletAddress || !reason) {
      return res.status(400).json({
        success: false,
        error: 'Customer wallet address and reason are required'
      });
    }

    if (!blockedBy) {
      return res.status(401).json({
        success: false,
        error: 'User authentication failed'
      });
    }

    // Block the customer
    const blockedCustomer = await moderationRepo.blockCustomer({
      shopId,
      customerWalletAddress,
      reason,
      blockedBy
    });

    res.json({
      success: true,
      message: 'Customer blocked successfully',
      data: blockedCustomer
    });
  } catch (error: any) {
    logger.error('Error blocking customer:', error);

    if (error.message === 'Customer is already blocked') {
      return res.status(409).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to block customer'
    });
  }
});

// Unblock a customer
router.delete('/blocked-customers/:walletAddress', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const shopId = req.user?.shopId;
    const { walletAddress } = req.params;
    const unblockedBy = req.user?.address;

    if (!shopId) {
      return res.status(401).json({
        success: false,
        error: 'Shop authentication required'
      });
    }

    if (!unblockedBy) {
      return res.status(401).json({
        success: false,
        error: 'User authentication failed'
      });
    }

    // Unblock the customer
    await moderationRepo.unblockCustomer(shopId, walletAddress, unblockedBy);

    res.json({
      success: true,
      message: 'Customer unblocked successfully'
    });
  } catch (error: any) {
    logger.error('Error unblocking customer:', error);

    if (error.message === 'Customer block record not found or already unblocked') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to unblock customer'
    });
  }
});

// Check if a customer is blocked
router.get('/blocked-customers/:walletAddress/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const shopId = req.user?.shopId;
    const { walletAddress } = req.params;

    if (!shopId) {
      return res.status(401).json({
        success: false,
        error: 'Shop authentication required'
      });
    }

    const isBlocked = await moderationRepo.isCustomerBlocked(shopId, walletAddress);

    res.json({
      success: true,
      data: {
        isBlocked,
        walletAddress,
        shopId
      }
    });
  } catch (error) {
    logger.error('Error checking customer block status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check customer block status'
    });
  }
});

// ==================== REPORTS ====================

// Get all reports for a shop
router.get('/reports', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const shopId = req.user?.shopId;

    if (!shopId) {
      return res.status(401).json({
        success: false,
        error: 'Shop authentication required'
      });
    }

    const reports = await moderationRepo.getReports(shopId);

    res.json({
      success: true,
      data: reports
    });
  } catch (error) {
    logger.error('Error fetching reports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reports'
    });
  }
});

// Submit a new report
router.post('/reports', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const shopId = req.user?.shopId;
    const { category, description, severity, relatedEntityType, relatedEntityId } = req.body;

    if (!shopId) {
      return res.status(401).json({
        success: false,
        error: 'Shop authentication required'
      });
    }

    // Validate input
    if (!category || !description || !severity) {
      return res.status(400).json({
        success: false,
        error: 'Category, description, and severity are required'
      });
    }

    // Validate category
    const validCategories = ['spam', 'fraud', 'inappropriate_review', 'harassment', 'other'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid category'
      });
    }

    // Validate severity
    const validSeverities = ['low', 'medium', 'high'];
    if (!validSeverities.includes(severity)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid severity'
      });
    }

    // Validate related entity type if provided
    if (relatedEntityType) {
      const validEntityTypes = ['customer', 'review', 'order'];
      if (!validEntityTypes.includes(relatedEntityType)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid related entity type'
        });
      }
    }

    // Create the report
    const report = await moderationRepo.createReport({
      shopId,
      category,
      description,
      severity,
      relatedEntityType,
      relatedEntityId
    });

    res.json({
      success: true,
      message: 'Report submitted successfully',
      data: report
    });
  } catch (error) {
    logger.error('Error creating report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit report'
    });
  }
});

// ==================== FLAGGED REVIEWS ====================

// Get all flagged reviews for a shop
router.get('/flagged-reviews', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const shopId = req.user?.shopId;

    if (!shopId) {
      return res.status(401).json({
        success: false,
        error: 'Shop authentication required'
      });
    }

    const flaggedReviews = await moderationRepo.getFlaggedReviews(shopId);

    res.json({
      success: true,
      data: flaggedReviews
    });
  } catch (error) {
    logger.error('Error fetching flagged reviews:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch flagged reviews'
    });
  }
});

// Flag a review
router.post('/flag-review', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const shopId = req.user?.shopId;
    const { reviewId, reason } = req.body;

    if (!shopId) {
      return res.status(401).json({
        success: false,
        error: 'Shop authentication required'
      });
    }

    // Validate input
    if (!reviewId || !reason) {
      return res.status(400).json({
        success: false,
        error: 'Review ID and reason are required'
      });
    }

    // Flag the review
    const flaggedReview = await moderationRepo.flagReview(shopId, reviewId, reason);

    res.json({
      success: true,
      message: 'Review flagged successfully',
      data: flaggedReview
    });
  } catch (error: any) {
    logger.error('Error flagging review:', error);

    if (error.message === 'Review already flagged') {
      return res.status(409).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to flag review'
    });
  }
});

export default router;
