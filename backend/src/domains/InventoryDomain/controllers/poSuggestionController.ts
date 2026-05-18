// backend/src/domains/InventoryDomain/controllers/poSuggestionController.ts
import { Request, Response } from 'express';
import { logger } from '../../../utils/logger';
import { getPOSuggestionService } from '../../../services/POSuggestionService';

/**
 * Generate PO suggestions for a shop
 * POST /api/inventory/suggestions/:shopId/generate
 */
export async function generateSuggestions(req: Request, res: Response): Promise<void> {
  try {
    const { shopId } = req.params;

    const poSuggestionService = getPOSuggestionService();
    const suggestions = await poSuggestionService.generateSuggestions(shopId);

    res.json({
      success: true,
      message: `Generated ${suggestions.length} purchase order suggestions`,
      data: {
        suggestions,
        count: suggestions.length,
      },
    });

    logger.info(`Generated ${suggestions.length} PO suggestions for shop ${shopId}`);
  } catch (error) {
    logger.error('Error generating PO suggestions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate purchase order suggestions',
    });
  }
}

/**
 * Get PO suggestions for a shop with optional filtering
 * GET /api/inventory/suggestions/:shopId
 */
export async function getSuggestions(req: Request, res: Response): Promise<void> {
  try {
    const { shopId } = req.params;
    const { urgency, status, minPriority } = req.query;

    const filters: any = {};

    if (urgency) {
      filters.urgency = urgency as string;
    }

    if (status) {
      filters.status = status as string;
    }

    if (minPriority) {
      filters.minPriority = parseInt(minPriority as string);
    }

    const poSuggestionService = getPOSuggestionService();
    const suggestions = await poSuggestionService.getSuggestions(shopId, filters);

    res.json({
      success: true,
      data: {
        suggestions,
        count: suggestions.length,
        filters,
      },
    });
  } catch (error) {
    logger.error('Error fetching PO suggestions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch purchase order suggestions',
    });
  }
}

/**
 * Approve a PO suggestion
 * POST /api/inventory/suggestions/:id/approve
 */
export async function approveSuggestion(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { autoCreatePO = false } = req.body;
    const userId = (req as any).user?.address || 'unknown';

    const poSuggestionService = getPOSuggestionService();
    const result = await poSuggestionService.approveSuggestion(id, userId, autoCreatePO);

    res.json({
      success: true,
      message: 'Purchase order suggestion approved successfully',
      data: result,
    });

    logger.info(`PO suggestion ${id} approved by ${userId}`);
  } catch (error) {
    logger.error('Error approving PO suggestion:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const statusCode = errorMessage.includes('not found') ? 404 : 500;

    res.status(statusCode).json({
      success: false,
      message: errorMessage.includes('not found')
        ? 'Suggestion not found or already processed'
        : 'Failed to approve purchase order suggestion',
    });
  }
}

/**
 * Reject a PO suggestion
 * POST /api/inventory/suggestions/:id/reject
 */
export async function rejectSuggestion(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = (req as any).user?.address || 'unknown';

    if (!reason) {
      res.status(400).json({
        success: false,
        message: 'Rejection reason is required',
      });
      return;
    }

    const poSuggestionService = getPOSuggestionService();
    const suggestion = await poSuggestionService.rejectSuggestion(id, reason, userId);

    res.json({
      success: true,
      message: 'Purchase order suggestion rejected successfully',
      data: { suggestion },
    });

    logger.info(`PO suggestion ${id} rejected by ${userId}: ${reason}`);
  } catch (error) {
    logger.error('Error rejecting PO suggestion:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const statusCode = errorMessage.includes('not found') ? 404 : 500;

    res.status(statusCode).json({
      success: false,
      message: errorMessage.includes('not found')
        ? 'Suggestion not found or already processed'
        : 'Failed to reject purchase order suggestion',
    });
  }
}

/**
 * Expire old suggestions (admin/scheduler endpoint)
 * POST /api/inventory/suggestions/expire
 */
export async function expireOldSuggestions(req: Request, res: Response): Promise<void> {
  try {
    const poSuggestionService = getPOSuggestionService();
    const count = await poSuggestionService.expireOldSuggestions();

    res.json({
      success: true,
      message: `Expired ${count} old suggestions`,
      data: { count },
    });

    logger.info(`Expired ${count} old PO suggestions`);
  } catch (error) {
    logger.error('Error expiring old suggestions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to expire old suggestions',
    });
  }
}
