// backend/src/domains/ServiceDomain/controllers/AnalyticsController.ts
import { Request, Response } from 'express';
import { ServiceAnalyticsService } from '../services/ServiceAnalyticsService';
import { logger } from '../../../utils/logger';
import { CSVExportService, CSVColumn } from '../../../utils/csvExport';

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

  /**
   * Export shop analytics to CSV
   * GET /api/services/analytics/shop/export
   */
  exportShopAnalytics = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const analytics = await this.analyticsService.getShopAnalytics(shopId, {});

      // Export top performing services
      const servicesColumns: CSVColumn[] = [
        { key: 'serviceName', label: 'Service Name' },
        { key: 'totalRevenue', label: 'Total Revenue', format: CSVExportService.formatCurrency },
        { key: 'totalOrders', label: 'Total Orders' },
        { key: 'averageOrderValue', label: 'Average Order Value', format: CSVExportService.formatCurrency },
        { key: 'conversionRate', label: 'Conversion Rate (%)', format: CSVExportService.formatPercentage },
        { key: 'avgRating', label: 'Average Rating', format: CSVExportService.formatNumber(2) },
        { key: 'totalReviews', label: 'Total Reviews' },
        { key: 'rcnRedeemed', label: 'RCN Redeemed', format: CSVExportService.formatNumber(2) }
      ];

      const filename = `shop-analytics-${shopId}-${new Date().toISOString().split('T')[0]}.csv`;
      CSVExportService.sendCSV(res, analytics.topServices, servicesColumns, filename);
    } catch (error: unknown) {
      logger.error('Error in exportShopAnalytics controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export shop analytics'
      });
    }
  };

  /**
   * Export shop category breakdown to CSV
   * GET /api/services/analytics/categories/export
   */
  exportCategoryBreakdown = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const categories = await this.analyticsService.getShopCategoryBreakdown(shopId);

      const columns: CSVColumn[] = [
        { key: 'category', label: 'Category' },
        { key: 'totalServices', label: 'Total Services' },
        { key: 'totalOrders', label: 'Total Orders' },
        { key: 'totalRevenue', label: 'Total Revenue', format: CSVExportService.formatCurrency },
        { key: 'averageOrderValue', label: 'Average Order Value', format: CSVExportService.formatCurrency },
        { key: 'conversionRate', label: 'Conversion Rate (%)', format: CSVExportService.formatPercentage }
      ];

      const filename = `category-breakdown-${shopId}-${new Date().toISOString().split('T')[0]}.csv`;
      CSVExportService.sendCSV(res, categories, columns, filename);
    } catch (error: unknown) {
      logger.error('Error in exportCategoryBreakdown controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export category breakdown'
      });
    }
  };

  /**
   * Export order trends to CSV
   * GET /api/services/analytics/trends/export
   */
  exportOrderTrends = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const days = req.query.days ? parseInt(req.query.days as string) : 30;
      const trends = await this.analyticsService.getShopOrderTrends(shopId, days);

      const columns: CSVColumn[] = [
        { key: 'date', label: 'Date' },
        { key: 'totalOrders', label: 'Total Orders' },
        { key: 'totalRevenue', label: 'Total Revenue', format: CSVExportService.formatCurrency },
        { key: 'averageOrderValue', label: 'Average Order Value', format: CSVExportService.formatCurrency }
      ];

      const filename = `order-trends-${shopId}-${days}days-${new Date().toISOString().split('T')[0]}.csv`;
      CSVExportService.sendCSV(res, trends, columns, filename);
    } catch (error: unknown) {
      logger.error('Error in exportOrderTrends controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export order trends'
      });
    }
  };

  /**
   * Export platform analytics to CSV (Admin only)
   * GET /api/services/analytics/platform/export
   */
  exportPlatformAnalytics = async (req: Request, res: Response) => {
    try {
      const analytics = await this.analyticsService.getPlatformAnalytics({});

      const columns: CSVColumn[] = [
        { key: 'shopName', label: 'Shop Name' },
        { key: 'totalRevenue', label: 'Total Revenue', format: CSVExportService.formatCurrency },
        { key: 'totalOrders', label: 'Total Orders' },
        { key: 'averageOrderValue', label: 'Average Order Value', format: CSVExportService.formatCurrency },
        { key: 'avgRating', label: 'Average Rating', format: CSVExportService.formatNumber(2) },
        { key: 'totalReviews', label: 'Total Reviews' }
      ];

      const filename = `platform-analytics-${new Date().toISOString().split('T')[0]}.csv`;
      CSVExportService.sendCSV(res, analytics.topShops, columns, filename);
    } catch (error: unknown) {
      logger.error('Error in exportPlatformAnalytics controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export platform analytics'
      });
    }
  };

  /**
   * Export platform category performance to CSV (Admin only)
   * GET /api/services/analytics/platform/categories/export
   */
  exportPlatformCategories = async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const categories = await this.analyticsService.getPlatformCategoryPerformance(limit);

      const columns: CSVColumn[] = [
        { key: 'category', label: 'Category' },
        { key: 'totalServices', label: 'Total Services' },
        { key: 'totalOrders', label: 'Total Orders' },
        { key: 'totalRevenue', label: 'Total Revenue', format: CSVExportService.formatCurrency },
        { key: 'averageOrderValue', label: 'Average Order Value', format: CSVExportService.formatCurrency },
        { key: 'conversionRate', label: 'Conversion Rate (%)', format: CSVExportService.formatPercentage }
      ];

      const filename = `platform-categories-${new Date().toISOString().split('T')[0]}.csv`;
      CSVExportService.sendCSV(res, categories, columns, filename);
    } catch (error: unknown) {
      logger.error('Error in exportPlatformCategories controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export platform categories'
      });
    }
  };

  /**
   * Export platform order trends to CSV (Admin only)
   * GET /api/services/analytics/platform/trends/export
   */
  exportPlatformTrends = async (req: Request, res: Response) => {
    try {
      const days = req.query.days ? parseInt(req.query.days as string) : 30;
      const trends = await this.analyticsService.getPlatformOrderTrends(days);

      const columns: CSVColumn[] = [
        { key: 'date', label: 'Date' },
        { key: 'totalOrders', label: 'Total Orders' },
        { key: 'totalRevenue', label: 'Total Revenue', format: CSVExportService.formatCurrency },
        { key: 'averageOrderValue', label: 'Average Order Value', format: CSVExportService.formatCurrency }
      ];

      const filename = `platform-trends-${days}days-${new Date().toISOString().split('T')[0]}.csv`;
      CSVExportService.sendCSV(res, trends, columns, filename);
    } catch (error: unknown) {
      logger.error('Error in exportPlatformTrends controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to export platform trends'
      });
    }
  };

  /**
   * Get group performance analytics for shop
   * GET /api/services/analytics/shop/group-performance
   */
  getGroupPerformance = async (req: Request, res: Response) => {
    try {
      const shopId = req.user?.shopId;
      if (!shopId) {
        return res.status(401).json({ success: false, error: 'Shop authentication required' });
      }

      const analytics = await this.analyticsService.getGroupPerformanceAnalytics(shopId);

      res.json({
        success: true,
        data: analytics
      });
    } catch (error: unknown) {
      logger.error('Error in getGroupPerformance controller:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get group performance analytics'
      });
    }
  };
}
