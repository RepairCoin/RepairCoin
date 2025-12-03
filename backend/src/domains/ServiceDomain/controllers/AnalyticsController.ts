// backend/src/domains/ServiceDomain/controllers/AnalyticsController.ts
import { Request, Response } from 'express';
import { ServiceAnalyticsService } from '../services/ServiceAnalyticsService';
import { logger } from '../../../utils/logger';

export class AnalyticsController {
  private analyticsService: ServiceAnalyticsService;

  constructor() {
    this.analyticsService = new ServiceAnalyticsService();
  }

  /**
   * Get comprehensive analytics for shop's services
   * GET /api/services/analytics/shop
   */
  getShopAnalytics = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const topServicesLimit = req.query.topServicesLimit
        ? parseInt(req.query.topServicesLimit as string)
        : undefined;
      const trendDays = req.query.trendDays
        ? parseInt(req.query.trendDays as string)
        : undefined;

      const analytics = await this.analyticsService.getShopAnalytics(shopId, {
        topServicesLimit,
        trendDays
      });

      res.json({
        success: true,
        data: analytics
      });
    } catch (error: unknown) {
      logger.error('Error in getShopAnalytics controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get shop analytics'
      });
    }
  };

  /**
   * Get shop overview metrics
   * GET /api/services/analytics/shop/overview
   */
  getShopOverview = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const overview = await this.analyticsService.getShopOverview(shopId);

      res.json({
        success: true,
        data: overview
      });
    } catch (error: unknown) {
      logger.error('Error in getShopOverview controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get shop overview'
      });
    }
  };

  /**
   * Get top performing services
   * GET /api/services/analytics/shop/top-services
   */
  getTopServices = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

      const topServices = await this.analyticsService.getTopServices(shopId, limit);

      res.json({
        success: true,
        data: topServices
      });
    } catch (error: unknown) {
      logger.error('Error in getTopServices controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get top services'
      });
    }
  };

  /**
   * Get order trends
   * GET /api/services/analytics/shop/trends
   */
  getShopOrderTrends = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const days = req.query.days ? parseInt(req.query.days as string) : 30;

      const trends = await this.analyticsService.getShopOrderTrends(shopId, days);

      res.json({
        success: true,
        data: trends
      });
    } catch (error: unknown) {
      logger.error('Error in getShopOrderTrends controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get order trends'
      });
    }
  };

  /**
   * Get category breakdown
   * GET /api/services/analytics/shop/categories
   */
  getShopCategoryBreakdown = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const categories = await this.analyticsService.getShopCategoryBreakdown(shopId);

      res.json({
        success: true,
        data: categories
      });
    } catch (error: unknown) {
      logger.error('Error in getShopCategoryBreakdown controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get category breakdown'
      });
    }
  };

  /**
   * Get platform-wide analytics (Admin only)
   * GET /api/services/analytics/platform
   */
  getPlatformAnalytics = async (req: Request, res: Response) => {
    try {
      const topShopsLimit = req.query.topShopsLimit
        ? parseInt(req.query.topShopsLimit as string)
        : undefined;
      const trendDays = req.query.trendDays
        ? parseInt(req.query.trendDays as string)
        : undefined;

      const analytics = await this.analyticsService.getPlatformAnalytics({
        topShopsLimit,
        trendDays
      });

      res.json({
        success: true,
        data: analytics
      });
    } catch (error: unknown) {
      logger.error('Error in getPlatformAnalytics controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get platform analytics'
      });
    }
  };

  /**
   * Get platform overview metrics (Admin only)
   * GET /api/services/analytics/platform/overview
   */
  getPlatformOverview = async (req: Request, res: Response) => {
    try {
      const overview = await this.analyticsService.getPlatformOverview();

      res.json({
        success: true,
        data: overview
      });
    } catch (error: unknown) {
      logger.error('Error in getPlatformOverview controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get platform overview'
      });
    }
  };

  /**
   * Get top performing shops (Admin only)
   * GET /api/services/analytics/platform/top-shops
   */
  getTopShops = async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

      const topShops = await this.analyticsService.getTopShops(limit);

      res.json({
        success: true,
        data: topShops
      });
    } catch (error: unknown) {
      logger.error('Error in getTopShops controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get top shops'
      });
    }
  };

  /**
   * Get platform order trends (Admin only)
   * GET /api/services/analytics/platform/trends
   */
  getPlatformOrderTrends = async (req: Request, res: Response) => {
    try {
      const days = req.query.days ? parseInt(req.query.days as string) : 30;

      const trends = await this.analyticsService.getPlatformOrderTrends(days);

      res.json({
        success: true,
        data: trends
      });
    } catch (error: unknown) {
      logger.error('Error in getPlatformOrderTrends controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get platform order trends'
      });
    }
  };

  /**
   * Get platform category performance (Admin only)
   * GET /api/services/analytics/platform/categories
   */
  getPlatformCategoryPerformance = async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

      const categories = await this.analyticsService.getPlatformCategoryPerformance(limit);

      res.json({
        success: true,
        data: categories
      });
    } catch (error: unknown) {
      logger.error('Error in getPlatformCategoryPerformance controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get platform category performance'
      });
    }
  };

  /**
   * Get marketplace health score (Admin only)
   * GET /api/services/analytics/platform/health
   */
  getMarketplaceHealthScore = async (req: Request, res: Response) => {
    try {
      const healthScore = await this.analyticsService.getMarketplaceHealthScore();

      res.json({
        success: true,
        data: healthScore
      });
    } catch (error: unknown) {
      logger.error('Error in getMarketplaceHealthScore controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get marketplace health score'
      });
    }
  };
}
