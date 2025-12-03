// frontend/src/components/shop/tabs/ServiceAnalyticsTab.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { serviceAnalyticsApi, ShopAnalyticsSummary } from '@/services/api/serviceAnalytics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, DollarSign, Package, Star, ShoppingCart, Gift, Percent } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ServiceAnalyticsTab() {
  const { token } = useAuthStore();
  const [analytics, setAnalytics] = useState<ShopAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [trendDays, setTrendDays] = useState(30);

  useEffect(() => {
    loadAnalytics();
  }, [token, trendDays]);

  const loadAnalytics = async () => {
    if (!token) return;

    try {
      setLoading(true);
      const data = await serviceAnalyticsApi.getShopAnalytics(token, {
        topServicesLimit: 5,
        trendDays
      });
      setAnalytics(data);
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

  if (!analytics) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Failed to load analytics</p>
        <Button onClick={loadAnalytics} className="mt-4">Retry</Button>
      </div>
    );
  }

  const { overview, topServices, orderTrends, categoryBreakdown } = analytics;

  // Calculate metrics
  const completionRate = overview.totalOrders > 0
    ? ((overview.completedOrders / overview.totalOrders) * 100).toFixed(1)
    : '0.0';

  const rcnRedemptionRate = overview.totalRevenue > 0
    ? ((overview.totalRcnDiscountUsd / overview.totalRevenue) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Service Marketplace Analytics</h2>
          <p className="text-gray-500">Track your service performance and revenue</p>
        </div>

        {/* Time Range Selector */}
        <div className="flex gap-2">
          <Button
            variant={trendDays === 7 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTrendDays(7)}
          >
            7 Days
          </Button>
          <Button
            variant={trendDays === 30 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTrendDays(30)}
          >
            30 Days
          </Button>
          <Button
            variant={trendDays === 90 ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTrendDays(90)}
          >
            90 Days
          </Button>
        </div>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Services</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.totalServices}</div>
            <p className="text-xs text-muted-foreground">
              {overview.activeServices} active, {overview.inactiveServices} inactive
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
              From {overview.totalOrders} total orders
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Order Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${overview.averageOrderValue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {completionRate}% completion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customer Rating</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.averageRating.toFixed(1)} / 5.0</div>
            <p className="text-xs text-muted-foreground">
              From {overview.totalReviews} reviews
            </p>
          </CardContent>
        </Card>
      </div>

      {/* RCN Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">RCN Redeemed</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.totalRcnRedeemed.toLocaleString()} RCN</div>
            <p className="text-xs text-muted-foreground">
              ${overview.totalRcnDiscountUsd.toFixed(2)} in discounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">RCN Redemption Rate</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rcnRedemptionRate}%</div>
            <p className="text-xs text-muted-foreground">
              Of total revenue discounted
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Favorites</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview.totalFavorites}</div>
            <p className="text-xs text-muted-foreground">
              Customer saved services
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Services */}
      <Card>
        <CardHeader>
          <CardTitle>Top Performing Services</CardTitle>
          <CardDescription>Your best services by revenue (last {trendDays} days)</CardDescription>
        </CardHeader>
        <CardContent>
          {topServices.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No services yet</p>
          ) : (
            <div className="space-y-4">
              {topServices.map((service, index) => (
                <div key={service.serviceId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full font-bold">
                      #{index + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold">{service.serviceName}</h4>
                      <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                        <span>{service.category}</span>
                        <span>•</span>
                        <span>${service.priceUsd.toFixed(2)}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          {service.averageRating.toFixed(1)} ({service.reviewCount} reviews)
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-6 text-center">
                    <div>
                      <div className="text-xs text-gray-500">Orders</div>
                      <div className="font-semibold">{service.totalOrders}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Revenue</div>
                      <div className="font-semibold text-green-600">${service.totalRevenue.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Conversion</div>
                      <div className="font-semibold">{service.conversionRate.toFixed(1)}%</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Performance by Category</CardTitle>
          <CardDescription>How your services perform across different categories</CardDescription>
        </CardHeader>
        <CardContent>
          {categoryBreakdown.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No category data yet</p>
          ) : (
            <div className="space-y-3">
              {categoryBreakdown.map((category) => (
                <div key={category.category} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium capitalize">{category.category}</div>
                    <div className="text-sm text-gray-600">
                      {category.serviceCount} services • Avg ${category.averagePrice.toFixed(2)}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-6 text-center">
                    <div>
                      <div className="text-xs text-gray-500">Orders</div>
                      <div className="font-semibold">{category.totalOrders}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Revenue</div>
                      <div className="font-semibold text-green-600">${category.totalRevenue.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Rating</div>
                      <div className="font-semibold flex items-center justify-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        {category.averageRating.toFixed(1)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Trends */}
      <Card>
        <CardHeader>
          <CardTitle>Order Trends</CardTitle>
          <CardDescription>Daily order activity for the last {trendDays} days</CardDescription>
        </CardHeader>
        <CardContent>
          {orderTrends.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No trend data yet</p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-4 text-sm font-semibold text-gray-700 pb-2 border-b">
                <div>Date</div>
                <div className="text-center">Orders</div>
                <div className="text-right">Revenue</div>
                <div className="text-right">RCN Discounts</div>
              </div>
              {orderTrends.slice(0, 10).map((trend) => (
                <div key={trend.date} className="grid grid-cols-4 gap-4 text-sm py-2 hover:bg-gray-50 rounded">
                  <div className="text-gray-900">
                    {new Date(trend.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                  <div className="text-center flex items-center justify-center gap-1">
                    <ShoppingCart className="h-3 w-3" />
                    {trend.orderCount}
                  </div>
                  <div className="text-right font-semibold text-green-600">${trend.revenue.toFixed(2)}</div>
                  <div className="text-right text-gray-600">${trend.rcnDiscountUsd.toFixed(2)}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
