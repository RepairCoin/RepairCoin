// backend/src/domains/ServiceDomain/services/ServiceAnalyticsService.ts
import {
  ServiceAnalyticsRepository,
  ShopServiceMetrics,
  ServicePerformance,
  OrderTrend,
  CategoryPerformance,
  PlatformServiceMetrics,
  TopPerformingShop,
  BookingAnalytics
} from '../../../repositories/ServiceAnalyticsRepository';
import { logger } from '../../../utils/logger';

export interface ShopAnalyticsSummary {
  overview: ShopServiceMetrics;
  topServices: ServicePerformance[];
  orderTrends: OrderTrend[];
  categoryBreakdown: CategoryPerformance[];
}

export interface PlatformAnalyticsSummary {
  overview: PlatformServiceMetrics;
  topShops: TopPerformingShop[];
  orderTrends: OrderTrend[];
}

export class ServiceAnalyticsService {
  private analyticsRepository: ServiceAnalyticsRepository;

  constructor() {
    this.analyticsRepository = new ServiceAnalyticsRepository();
  }

  /**
   * Get comprehensive analytics for a shop's services
   */
  async getShopAnalytics(shopId: string, options?: {
    topServicesLimit?: number;
    trendDays?: number;
  }): Promise<ShopAnalyticsSummary> {
    try {
      const topServicesLimit = options?.topServicesLimit || 10;
      const trendDays = options?.trendDays || 30;

      logger.info('Fetching shop analytics', { shopId, topServicesLimit, trendDays });

      // Fetch all analytics in parallel
      const [overview, topServices, orderTrends, categoryBreakdown] = await Promise.all([
        this.analyticsRepository.getShopMetrics(shopId),
        this.analyticsRepository.getServicePerformance(shopId, topServicesLimit),
        this.analyticsRepository.getOrderTrends(shopId, trendDays),
        this.analyticsRepository.getShopCategoryPerformance(shopId)
      ]);

      return {
        overview,
        topServices,
        orderTrends,
        categoryBreakdown
      };
    } catch (error) {
      logger.error('Error getting shop analytics:', error);
      throw new Error('Failed to get shop analytics');
    }
  }

  /**
   * Get shop overview metrics only
   */
  async getShopOverview(shopId: string): Promise<ShopServiceMetrics> {
    try {
      return await this.analyticsRepository.getShopMetrics(shopId);
    } catch (error) {
      logger.error('Error getting shop overview:', error);
      throw new Error('Failed to get shop overview');
    }
  }

  /**
   * Get top performing services for a shop
   */
  async getTopServices(shopId: string, limit: number = 10): Promise<ServicePerformance[]> {
    try {
      return await this.analyticsRepository.getServicePerformance(shopId, limit);
    } catch (error) {
      logger.error('Error getting top services:', error);
      throw new Error('Failed to get top services');
    }
  }

  /**
   * Get order trends for a shop
   */
  async getShopOrderTrends(shopId: string, days: number = 30): Promise<OrderTrend[]> {
    try {
      return await this.analyticsRepository.getOrderTrends(shopId, days);
    } catch (error) {
      logger.error('Error getting shop order trends:', error);
      throw new Error('Failed to get shop order trends');
    }
  }

  /**
   * Get category performance for a shop
   */
  async getShopCategoryBreakdown(shopId: string): Promise<CategoryPerformance[]> {
    try {
      return await this.analyticsRepository.getShopCategoryPerformance(shopId);
    } catch (error) {
      logger.error('Error getting shop category breakdown:', error);
      throw new Error('Failed to get shop category breakdown');
    }
  }

  /**
   * Get comprehensive platform analytics (Admin only)
   */
  async getPlatformAnalytics(options?: {
    topShopsLimit?: number;
    trendDays?: number;
  }): Promise<PlatformAnalyticsSummary> {
    try {
      const topShopsLimit = options?.topShopsLimit || 10;
      const trendDays = options?.trendDays || 30;

      logger.info('Fetching platform analytics', { topShopsLimit, trendDays });

      // Fetch all analytics in parallel
      const [overview, topShops, orderTrends] = await Promise.all([
        this.analyticsRepository.getPlatformMetrics(),
        this.analyticsRepository.getTopPerformingShops(topShopsLimit),
        this.analyticsRepository.getPlatformOrderTrends(trendDays)
      ]);

      return {
        overview,
        topShops,
        orderTrends
      };
    } catch (error) {
      logger.error('Error getting platform analytics:', error);
      throw new Error('Failed to get platform analytics');
    }
  }

  /**
   * Get platform overview metrics only (Admin)
   */
  async getPlatformOverview(): Promise<PlatformServiceMetrics> {
    try {
      return await this.analyticsRepository.getPlatformMetrics();
    } catch (error) {
      logger.error('Error getting platform overview:', error);
      throw new Error('Failed to get platform overview');
    }
  }

  /**
   * Get top performing shops (Admin)
   */
  async getTopShops(limit: number = 10): Promise<TopPerformingShop[]> {
    try {
      return await this.analyticsRepository.getTopPerformingShops(limit);
    } catch (error) {
      logger.error('Error getting top shops:', error);
      throw new Error('Failed to get top shops');
    }
  }

  /**
   * Get platform order trends (Admin)
   */
  async getPlatformOrderTrends(days: number = 30): Promise<OrderTrend[]> {
    try {
      return await this.analyticsRepository.getPlatformOrderTrends(days);
    } catch (error) {
      logger.error('Error getting platform order trends:', error);
      throw new Error('Failed to get platform order trends');
    }
  }

  /**
   * Get platform category performance (Admin)
   */
  async getPlatformCategoryPerformance(limit: number = 10): Promise<CategoryPerformance[]> {
    try {
      return await this.analyticsRepository.getPlatformCategoryPerformance(limit);
    } catch (error) {
      logger.error('Error getting platform category performance:', error);
      throw new Error('Failed to get platform category performance');
    }
  }

  /**
   * Calculate service marketplace health score (Admin)
   */
  async getMarketplaceHealthScore(): Promise<{
    score: number;
    metrics: {
      shopAdoptionRate: number;
      avgServicesPerShop: number;
      orderConversionRate: number;
      customerSatisfaction: number;
    };
    interpretation: string;
  }> {
    try {
      const overview = await this.analyticsRepository.getPlatformMetrics();

      // Calculate individual metrics (0-100 scale)
      const shopAdoptionRate = Math.min((overview.totalShopsWithServices / 100) * 100, 100); // Target: 100 shops
      const avgServicesPerShop = overview.totalShopsWithServices > 0
        ? Math.min((overview.totalActiveServices / overview.totalShopsWithServices / 10) * 100, 100) // Target: 10 services/shop
        : 0;

      const orderConversionRate = overview.totalActiveServices > 0
        ? Math.min((overview.totalOrders / overview.totalActiveServices / 5) * 100, 100) // Target: 5 orders/service
        : 0;

      // Customer satisfaction based on avg rating across categories
      const avgRating = overview.topCategories.length > 0
        ? overview.topCategories.reduce((sum, cat) => sum + cat.averageRating, 0) / overview.topCategories.length
        : 0;
      const customerSatisfaction = (avgRating / 5) * 100;

      // Calculate overall health score (weighted average)
      const score = (
        (shopAdoptionRate * 0.25) +
        (avgServicesPerShop * 0.25) +
        (orderConversionRate * 0.30) +
        (customerSatisfaction * 0.20)
      );

      // Determine interpretation
      let interpretation: string;
      if (score >= 80) {
        interpretation = 'Excellent - Service marketplace is thriving';
      } else if (score >= 60) {
        interpretation = 'Good - Marketplace is growing steadily';
      } else if (score >= 40) {
        interpretation = 'Fair - Room for improvement in engagement';
      } else if (score >= 20) {
        interpretation = 'Poor - Needs attention to drive adoption';
      } else {
        interpretation = 'Critical - Immediate action required';
      }

      return {
        score: Math.round(score),
        metrics: {
          shopAdoptionRate: Math.round(shopAdoptionRate),
          avgServicesPerShop: Math.round(avgServicesPerShop),
          orderConversionRate: Math.round(orderConversionRate),
          customerSatisfaction: Math.round(customerSatisfaction)
        },
        interpretation
      };
    } catch (error) {
      logger.error('Error calculating marketplace health score:', error);
      throw new Error('Failed to calculate marketplace health score');
    }
  }

  /**
   * Get group performance analytics for a shop
   * Shows which affiliate groups are driving bookings and token issuance
   */
  async getGroupPerformanceAnalytics(shopId: string): Promise<{
    summary: {
      totalServicesLinked: number;
      totalGroupsActive: number;
      totalGroupTokensIssued: number;
      totalBookingsFromGroups: number;
    };
    groupBreakdown: Array<{
      groupId: string;
      groupName: string;
      customTokenSymbol: string;
      icon: string;
      servicesLinked: number;
      totalBookings: number;
      totalRevenue: number;
      tokensIssued: number;
      conversionRate: number;
    }>;
    servicesLinked: Array<{
      serviceId: string;
      serviceName: string;
      groups: Array<{
        groupId: string;
        groupName: string;
        customTokenSymbol: string;
        tokenRewardPercentage: number;
        bonusMultiplier: number;
      }>;
      bookings: number;
      revenue: number;
    }>;
  }> {
    try {
      return await this.analyticsRepository.getGroupPerformanceAnalytics(shopId);
    } catch (error) {
      logger.error('Error getting group performance analytics:', error);
      throw new Error('Failed to get group performance analytics');
    }
  }

  /**
   * Get booking analytics for a shop
   */
  async getBookingAnalytics(shopId: string, trendDays: number = 30): Promise<BookingAnalytics> {
    try {
      return await this.analyticsRepository.getBookingAnalytics(shopId, trendDays);
    } catch (error) {
      logger.error('Error getting booking analytics:', error);
      throw new Error('Failed to get booking analytics');
    }
  }
}
