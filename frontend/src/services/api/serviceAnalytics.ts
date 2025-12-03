// frontend/src/services/api/serviceAnalytics.ts
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

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

// Shop Analytics API
export const serviceAnalyticsApi = {
  // Shop endpoints
  async getShopAnalytics(token: string, options?: { topServicesLimit?: number; trendDays?: number }): Promise<ShopAnalyticsSummary> {
    const params = new URLSearchParams();
    if (options?.topServicesLimit) params.append('topServicesLimit', options.topServicesLimit.toString());
    if (options?.trendDays) params.append('trendDays', options.trendDays.toString());

    const response = await axios.get<{ success: boolean; data: ShopAnalyticsSummary }>(
      `${API_URL}/api/services/analytics/shop${params.toString() ? '?' + params.toString() : ''}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.data;
  },

  async getShopOverview(token: string): Promise<ShopServiceMetrics> {
    const response = await axios.get<{ success: boolean; data: ShopServiceMetrics }>(
      `${API_URL}/api/services/analytics/shop/overview`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.data;
  },

  async getTopServices(token: string, limit: number = 10): Promise<ServicePerformance[]> {
    const response = await axios.get<{ success: boolean; data: ServicePerformance[] }>(
      `${API_URL}/api/services/analytics/shop/top-services?limit=${limit}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.data;
  },

  async getShopOrderTrends(token: string, days: number = 30): Promise<OrderTrend[]> {
    const response = await axios.get<{ success: boolean; data: OrderTrend[] }>(
      `${API_URL}/api/services/analytics/shop/trends?days=${days}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.data;
  },

  async getShopCategoryBreakdown(token: string): Promise<CategoryPerformance[]> {
    const response = await axios.get<{ success: boolean; data: CategoryPerformance[] }>(
      `${API_URL}/api/services/analytics/shop/categories`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.data;
  },

  // Admin endpoints
  async getPlatformAnalytics(token: string, options?: { topShopsLimit?: number; trendDays?: number }): Promise<PlatformAnalyticsSummary> {
    const params = new URLSearchParams();
    if (options?.topShopsLimit) params.append('topShopsLimit', options.topShopsLimit.toString());
    if (options?.trendDays) params.append('trendDays', options.trendDays.toString());

    const response = await axios.get<{ success: boolean; data: PlatformAnalyticsSummary }>(
      `${API_URL}/api/services/analytics/platform${params.toString() ? '?' + params.toString() : ''}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.data;
  },

  async getPlatformOverview(token: string): Promise<PlatformServiceMetrics> {
    const response = await axios.get<{ success: boolean; data: PlatformServiceMetrics }>(
      `${API_URL}/api/services/analytics/platform/overview`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.data;
  },

  async getTopShops(token: string, limit: number = 10): Promise<TopPerformingShop[]> {
    const response = await axios.get<{ success: boolean; data: TopPerformingShop[] }>(
      `${API_URL}/api/services/analytics/platform/top-shops?limit=${limit}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.data;
  },

  async getPlatformOrderTrends(token: string, days: number = 30): Promise<OrderTrend[]> {
    const response = await axios.get<{ success: boolean; data: OrderTrend[] }>(
      `${API_URL}/api/services/analytics/platform/trends?days=${days}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.data;
  },

  async getPlatformCategoryPerformance(token: string, limit: number = 10): Promise<CategoryPerformance[]> {
    const response = await axios.get<{ success: boolean; data: CategoryPerformance[] }>(
      `${API_URL}/api/services/analytics/platform/categories?limit=${limit}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.data;
  },

  async getMarketplaceHealthScore(token: string): Promise<MarketplaceHealthScore> {
    const response = await axios.get<{ success: boolean; data: MarketplaceHealthScore }>(
      `${API_URL}/api/services/analytics/platform/health`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data.data;
  }
};
