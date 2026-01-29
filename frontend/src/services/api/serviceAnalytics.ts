// frontend/src/services/api/serviceAnalytics.ts
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

// Types
export interface ShopServiceMetrics {
  totalServices: number;
  activeServices: number;
  inactiveServices: number;
  totalOrders: number;
  completedOrders: number;
  totalRevenue: number;
  totalRcnRedeemed: number;
  totalRcnDiscountUsd: number;
  averageOrderValue: number;
  averageRating: number;
  totalReviews: number;
  totalFavorites: number;
}

export interface ServicePerformance {
  serviceId: string;
  serviceName: string;
  category: string;
  priceUsd: number;
  totalOrders: number;
  completedOrders: number;
  totalRevenue: number;
  averageRating: number;
  reviewCount: number;
  favoriteCount: number;
  rcnRedeemed: number;
  rcnDiscountUsd: number;
  conversionRate: number;
}

export interface OrderTrend {
  date: string;
  orderCount: number;
  revenue: number;
  rcnDiscountUsd: number;
}

export interface CategoryPerformance {
  category: string;
  serviceCount: number;
  totalOrders: number;
  totalRevenue: number;
  averageRating: number;
  averagePrice: number;
}

export interface ShopAnalyticsSummary {
  overview: ShopServiceMetrics;
  topServices: ServicePerformance[];
  orderTrends: OrderTrend[];
  categoryBreakdown: CategoryPerformance[];
}

export interface PlatformServiceMetrics {
  totalShopsWithServices: number;
  totalActiveServices: number;
  totalOrders: number;
  totalRevenue: number;
  totalRcnRedeemed: number;
  totalRcnDiscountUsd: number;
  averageServicePrice: number;
  averageOrderValue: number;
  topCategories: CategoryPerformance[];
}

export interface TopPerformingShop {
  shopId: string;
  shopName: string;
  activeServices: number;
  totalOrders: number;
  totalRevenue: number;
  averageRating: number;
}

export interface PlatformAnalyticsSummary {
  overview: PlatformServiceMetrics;
  topShops: TopPerformingShop[];
  orderTrends: OrderTrend[];
}

export interface MarketplaceHealthScore {
  score: number;
  metrics: {
    shopAdoptionRate: number;
    avgServicesPerShop: number;
    orderConversionRate: number;
    customerSatisfaction: number;
  };
  interpretation: string;
}

export interface GroupPerformanceAnalytics {
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
}

export interface BookingAnalytics {
  summary: {
    totalBookings: number;
    completed: number;
    noShows: number;
    cancelled: number;
    completionRate: number;
    noShowRate: number;
    cancellationRate: number;
    avgLeadTimeDays: number;
    rescheduledCount: number;
    avgRescheduleCount: number;
  };
  statusBreakdown: Array<{ status: string; count: number }>;
  busiestDays: Array<{ dayOfWeek: number; count: number }>;
  peakHours: Array<{ hour: number; count: number }>;
  cancellationReasons: Array<{ reason: string; count: number }>;
  bookingTrends: Array<{ date: string; count: number }>;
}

// Shop Analytics API
export const serviceAnalyticsApi = {
  // Shop endpoints
  async getShopAnalytics(options?: { topServicesLimit?: number; trendDays?: number }): Promise<ShopAnalyticsSummary> {
    const params = new URLSearchParams();
    if (options?.topServicesLimit) params.append('topServicesLimit', options.topServicesLimit.toString());
    if (options?.trendDays) params.append('trendDays', options.trendDays.toString());

    const response = await axios.get<{ success: boolean; data: ShopAnalyticsSummary }>(
      `${API_URL}/services/analytics/shop${params.toString() ? '?' + params.toString() : ''}`,
      { withCredentials: true }
    );
    return response.data.data;
  },

  async getShopOverview(): Promise<ShopServiceMetrics> {
    const response = await axios.get<{ success: boolean; data: ShopServiceMetrics }>(
      `${API_URL}/services/analytics/shop/overview`,
      { withCredentials: true }
    );
    return response.data.data;
  },

  async getTopServices(limit: number = 10): Promise<ServicePerformance[]> {
    const response = await axios.get<{ success: boolean; data: ServicePerformance[] }>(
      `${API_URL}/services/analytics/shop/top-services?limit=${limit}`,
      { withCredentials: true }
    );
    return response.data.data;
  },

  async getShopOrderTrends(days: number = 30): Promise<OrderTrend[]> {
    const response = await axios.get<{ success: boolean; data: OrderTrend[] }>(
      `${API_URL}/services/analytics/shop/trends?days=${days}`,
      { withCredentials: true }
    );
    return response.data.data;
  },

  async getShopCategoryBreakdown(): Promise<CategoryPerformance[]> {
    const response = await axios.get<{ success: boolean; data: CategoryPerformance[] }>(
      `${API_URL}/services/analytics/shop/categories`,
      { withCredentials: true }
    );
    return response.data.data;
  },

  async getGroupPerformanceAnalytics(): Promise<GroupPerformanceAnalytics> {
    const response = await axios.get<{ success: boolean; data: GroupPerformanceAnalytics }>(
      `${API_URL}/services/analytics/shop/group-performance`,
      { withCredentials: true }
    );
    return response.data.data;
  },

  async getBookingAnalytics(trendDays: number = 30): Promise<BookingAnalytics> {
    const response = await axios.get<{ success: boolean; data: BookingAnalytics }>(
      `${API_URL}/services/analytics/shop/bookings?trendDays=${trendDays}`,
      { withCredentials: true }
    );
    return response.data.data;
  },

  // Admin endpoints
  async getPlatformAnalytics(options?: { topShopsLimit?: number; trendDays?: number }): Promise<PlatformAnalyticsSummary> {
    const params = new URLSearchParams();
    if (options?.topShopsLimit) params.append('topShopsLimit', options.topShopsLimit.toString());
    if (options?.trendDays) params.append('trendDays', options.trendDays.toString());

    const response = await axios.get<{ success: boolean; data: PlatformAnalyticsSummary }>(
      `${API_URL}/services/analytics/platform${params.toString() ? '?' + params.toString() : ''}`,
      { withCredentials: true }
    );
    return response.data.data;
  },

  async getPlatformOverview(): Promise<PlatformServiceMetrics> {
    const response = await axios.get<{ success: boolean; data: PlatformServiceMetrics }>(
      `${API_URL}/services/analytics/platform/overview`,
      { withCredentials: true }
    );
    return response.data.data;
  },

  async getTopShops(limit: number = 10): Promise<TopPerformingShop[]> {
    const response = await axios.get<{ success: boolean; data: TopPerformingShop[] }>(
      `${API_URL}/services/analytics/platform/top-shops?limit=${limit}`,
      { withCredentials: true }
    );
    return response.data.data;
  },

  async getPlatformOrderTrends(days: number = 30): Promise<OrderTrend[]> {
    const response = await axios.get<{ success: boolean; data: OrderTrend[] }>(
      `${API_URL}/services/analytics/platform/trends?days=${days}`,
      { withCredentials: true }
    );
    return response.data.data;
  },

  async getPlatformCategoryPerformance(limit: number = 10): Promise<CategoryPerformance[]> {
    const response = await axios.get<{ success: boolean; data: CategoryPerformance[] }>(
      `${API_URL}/services/analytics/platform/categories?limit=${limit}`,
      { withCredentials: true }
    );
    return response.data.data;
  },

  async getMarketplaceHealthScore(): Promise<MarketplaceHealthScore> {
    const response = await axios.get<{ success: boolean; data: MarketplaceHealthScore }>(
      `${API_URL}/services/analytics/platform/health`,
      { withCredentials: true }
    );
    return response.data.data;
  }
};
