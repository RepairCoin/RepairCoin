// backend/src/domains/AffiliateShopGroupDomain/controllers/AnalyticsController.ts
import { Request, Response } from 'express';
import { AffiliateShopGroupService } from '../../../services/AffiliateShopGroupService';
import { logger } from '../../../utils/logger';

export class AnalyticsController {
  private service: AffiliateShopGroupService;

  constructor() {
    this.service = new AffiliateShopGroupService();
  }

  /**
   * Get group analytics overview
   */
  getGroupAnalytics = async (req: Request, res: Response) => {
    try {
      const { groupId } = req.params;

      const analytics = await this.service.getGroupAnalytics(groupId);

      res.json({
        success: true,
        data: analytics
      });
    } catch (error: unknown) {
      logger.error('Error in getGroupAnalytics controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch analytics'
      });
    }
  };

  /**
   * Get member activity statistics
   */
  getMemberActivityStats = async (req: Request, res: Response) => {
    try {
      const { groupId } = req.params;

      const stats = await this.service.getMemberActivityStats(groupId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error: unknown) {
      logger.error('Error in getMemberActivityStats controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch member activity stats'
      });
    }
  };

  /**
   * Get transaction trends
   */
  getTransactionTrends = async (req: Request, res: Response) => {
    try {
      const { groupId } = req.params;
      const days = parseInt(req.query.days as string) || 30;

      const trends = await this.service.getTransactionTrends(groupId, days);

      res.json({
        success: true,
        data: trends
      });
    } catch (error: unknown) {
      logger.error('Error in getTransactionTrends controller:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch transaction trends'
      });
    }
  };
}
