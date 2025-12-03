// frontend/src/components/admin/ServiceMarketplaceAnalyticsSection.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { serviceAnalyticsApi, PlatformAnalyticsSummary, MarketplaceHealthScore } from '@/services/api/serviceAnalytics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, DollarSign, Package, Store, Users, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ServiceMarketplaceAnalyticsSection() {
  const { token } = useAuthStore();
  const [analytics, setAnalytics] = useState<PlatformAnalyticsSummary | null>(null);
  const [healthScore, setHealthScore] = useState<MarketplaceHealthScore | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [token]);

  const loadAnalytics = async () => {
    if (!token) return;

    try {
      setLoading(true);
      const [data, health] = await Promise.all([
        serviceAnalyticsApi.getPlatformAnalytics(token, { topShopsLimit: 5, trendDays: 30 }),
        serviceAnalyticsApi.getMarketplaceHealthScore(token)
      ]);
      setAnalytics(data);
      setHealthScore(health);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!analytics || !healthScore) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Failed to load marketplace analytics</p>
        <Button onClick={loadAnalytics} className="mt-4">Retry</Button>
      </div>
    );
  }

  const { overview, topShops, orderTrends } = analytics;

  // Get health score color
  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 60) return 'text-blue-600 bg-blue-50';
    if (score >= 40) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  return (
    <div className="space-y-6">
      {/* Health Score */}
      <Card className={`border-2 ${getHealthColor(healthScore.score)}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Marketplace Health Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-4xl font-bold">{healthScore.score}/100</div>
              <p className="text-sm mt-1">{healthScore.interpretation}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-600">Shop Adoption</div>
                <div className="font-semibold">{healthScore.metrics.shopAdoptionRate}%</div>
              </div>
              <div>
                <div className="text-gray-600">Avg Services/Shop</div>
                <div className="font-semibold">{healthScore.metrics.avgServicesPerShop}%</div>
              </div>
              <div>
                <div className="text-gray-600">Order Conversion</div>
                <div className="font-semibold">{healthScore.metrics.orderConversionRate}%</div>
              </div>
              <div>
                <div className="text-gray-600">Satisfaction</div>
                <div className="font-semibold">{healthScore.metrics.customerSatisfaction}%</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Platform Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Shops</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.totalShopsWithServices}</div>
            <p className="text-xs text-muted-foreground">
              {overview.totalActiveServices} active services
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${overview.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground">
              From {overview.totalOrders} orders
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${overview.averageOrderValue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Avg service: ${overview.averageServicePrice.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">RCN Redeemed</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.totalRcnRedeemed.toLocaleString()} RCN</div>
            <p className="text-xs text-muted-foreground">
              ${overview.totalRcnDiscountUsd.toFixed(2)} in discounts
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Shops */}
      <Card>
        <CardHeader>
          <CardTitle>Top Performing Shops</CardTitle>
          <CardDescription>Shops with highest service marketplace revenue</CardDescription>
        </CardHeader>
        <CardContent>
          {topShops.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No shops yet</p>
          ) : (
            <div className="space-y-3">
              {topShops.map((shop, index) => (
                <div key={shop.shopId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-6 h-6 bg-blue-600 text-white rounded-full text-sm font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-semibold">{shop.shopName}</div>
                      <div className="text-sm text-gray-600">{shop.activeServices} active services</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-6 text-center">
                    <div>
                      <div className="text-xs text-gray-500">Orders</div>
                      <div className="font-semibold">{shop.totalOrders}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Revenue</div>
                      <div className="font-semibold text-green-600">${shop.totalRevenue.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Rating</div>
                      <div className="font-semibold">{shop.averageRating.toFixed(1)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Categories */}
      <Card>
        <CardHeader>
          <CardTitle>Top Categories</CardTitle>
          <CardDescription>Most popular service categories by revenue</CardDescription>
        </CardHeader>
        <CardContent>
          {overview.topCategories.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No category data yet</p>
          ) : (
            <div className="space-y-3">
              {overview.topCategories.map((category, index) => (
                <div key={category.category} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium capitalize">{category.category}</div>
                    <div className="text-sm text-gray-600">
                      {category.serviceCount} services • {category.totalOrders} orders
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-green-600">${category.totalRevenue.toFixed(2)}</div>
                    <div className="text-sm text-gray-600">Avg ${category.averagePrice.toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
