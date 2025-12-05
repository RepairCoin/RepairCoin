// frontend/src/components/shop/tabs/ServiceAnalyticsTab.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { serviceAnalyticsApi, ShopAnalyticsSummary } from '@/services/api/serviceAnalytics';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, DollarSign, Package, Star, ShoppingCart, Gift, Percent } from 'lucide-react';

export default function ServiceAnalyticsTab() {
  const [analytics, setAnalytics] = useState<ShopAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [trendDays, setTrendDays] = useState(30);

  useEffect(() => {
    loadAnalytics();
  }, [trendDays]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      console.log('Fetching shop analytics...');
      const data = await serviceAnalyticsApi.getShopAnalytics({
        topServicesLimit: 5,
        trendDays
      });
      console.log('Analytics data loaded successfully:', data);
      setAnalytics(data);
    } catch (error: any) {
      console.error('Failed to load analytics:', error);
      if (error.response) {
        console.error('Response error:', error.response.data);
        console.error('Status:', error.response.status);
      } else if (error.request) {
        console.error('No response received:', error.request);
      } else {
        console.error('Error message:', error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#FFCC00]" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Failed to load analytics</p>
        <button
          onClick={loadAnalytics}
          className="mt-4 px-6 py-2 bg-[#FFCC00] text-black font-semibold rounded-lg hover:bg-[#FFD700] transition-colors"
        >
          Retry
        </button>
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
          <h2 className="text-2xl font-bold text-white">Service Marketplace Analytics</h2>
          <p className="text-gray-400">Track your service performance and revenue</p>
        </div>

        {/* Time Range Selector */}
        <div className="flex gap-2">
          <button
            onClick={() => setTrendDays(7)}
            className={`px-4 py-2 rounded-lg font-semibold transition-all duration-200 ${
              trendDays === 7
                ? 'bg-[#FFCC00] text-black'
                : 'bg-[#1A1A1A] text-gray-400 border border-gray-800 hover:border-[#FFCC00]/50'
            }`}
          >
            7 Days
          </button>
          <button
            onClick={() => setTrendDays(30)}
            className={`px-4 py-2 rounded-lg font-semibold transition-all duration-200 ${
              trendDays === 30
                ? 'bg-[#FFCC00] text-black'
                : 'bg-[#1A1A1A] text-gray-400 border border-gray-800 hover:border-[#FFCC00]/50'
            }`}
          >
            30 Days
          </button>
          <button
            onClick={() => setTrendDays(90)}
            className={`px-4 py-2 rounded-lg font-semibold transition-all duration-200 ${
              trendDays === 90
                ? 'bg-[#FFCC00] text-black'
                : 'bg-[#1A1A1A] text-gray-400 border border-gray-800 hover:border-[#FFCC00]/50'
            }`}
          >
            90 Days
          </button>
        </div>
      </div>

      {/* Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-[#1A1A1A] border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Total Services</CardTitle>
            <Package className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{overview.totalServices}</div>
            <p className="text-xs text-gray-400">
              {overview.activeServices} active, {overview.inactiveServices} inactive
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#1A1A1A] border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">${overview.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-gray-400">
              From {overview.totalOrders} total orders
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#1A1A1A] border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Average Order Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">${overview.averageOrderValue.toFixed(2)}</div>
            <p className="text-xs text-gray-400">
              {completionRate}% completion rate
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#1A1A1A] border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Customer Rating</CardTitle>
            <Star className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#FFCC00]">{overview.averageRating.toFixed(1)} / 5.0</div>
            <p className="text-xs text-gray-400">
              From {overview.totalReviews} reviews
            </p>
          </CardContent>
        </Card>
      </div>

      {/* RCN Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-[#1A1A1A] border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">RCN Redeemed</CardTitle>
            <Gift className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#FFCC00]">{overview.totalRcnRedeemed.toLocaleString()} RCN</div>
            <p className="text-xs text-gray-400">
              ${overview.totalRcnDiscountUsd.toFixed(2)} in discounts
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#1A1A1A] border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">RCN Redemption Rate</CardTitle>
            <Percent className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{rcnRedemptionRate}%</div>
            <p className="text-xs text-gray-400">
              Of total revenue discounted
            </p>
          </CardContent>
        </Card>

        <Card className="bg-[#1A1A1A] border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Total Favorites</CardTitle>
            <Star className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{overview.totalFavorites}</div>
            <p className="text-xs text-gray-400">
              Customer saved services
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Services */}
      <Card className="bg-[#1A1A1A] border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Top Performing Services</CardTitle>
          <CardDescription className="text-gray-400">Your best services by revenue (last {trendDays} days)</CardDescription>
        </CardHeader>
        <CardContent>
          {topServices.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No services yet</p>
          ) : (
            <div className="space-y-4">
              {topServices.map((service, index) => (
                <div key={service.serviceId} className="flex items-center justify-between p-4 bg-[#2A2A2A] border border-gray-800 rounded-lg hover:border-[#FFCC00]/50 transition-colors">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex items-center justify-center w-8 h-8 bg-[#FFCC00] text-black rounded-full font-bold">
                      #{index + 1}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-white">{service.serviceName}</h4>
                      <div className="flex items-center gap-4 text-sm text-gray-400 mt-1">
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
                      <div className="text-xs text-gray-400">Orders</div>
                      <div className="font-semibold text-white">{service.totalOrders}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">Revenue</div>
                      <div className="font-semibold text-green-500">${service.totalRevenue.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">Conversion</div>
                      <div className="font-semibold text-white">{service.conversionRate.toFixed(1)}%</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      <Card className="bg-[#1A1A1A] border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Performance by Category</CardTitle>
          <CardDescription className="text-gray-400">How your services perform across different categories</CardDescription>
        </CardHeader>
        <CardContent>
          {categoryBreakdown.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No category data yet</p>
          ) : (
            <div className="space-y-3">
              {categoryBreakdown.map((category) => (
                <div key={category.category} className="flex items-center justify-between p-3 bg-[#2A2A2A] border border-gray-800 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium capitalize text-white">{category.category}</div>
                    <div className="text-sm text-gray-400">
                      {category.serviceCount} services • Avg ${category.averagePrice.toFixed(2)}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-6 text-center">
                    <div>
                      <div className="text-xs text-gray-400">Orders</div>
                      <div className="font-semibold text-white">{category.totalOrders}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">Revenue</div>
                      <div className="font-semibold text-green-500">${category.totalRevenue.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">Rating</div>
                      <div className="font-semibold flex items-center justify-center gap-1 text-white">
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
      <Card className="bg-[#1A1A1A] border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Order Trends</CardTitle>
          <CardDescription className="text-gray-400">Daily order activity for the last {trendDays} days</CardDescription>
        </CardHeader>
        <CardContent>
          {orderTrends.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No trend data yet</p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-4 text-sm font-semibold text-gray-400 pb-2 border-b border-gray-800">
                <div>Date</div>
                <div className="text-center">Orders</div>
                <div className="text-right">Revenue</div>
                <div className="text-right">RCN Discounts</div>
              </div>
              {orderTrends.slice(0, 10).map((trend) => (
                <div key={trend.date} className="grid grid-cols-4 gap-4 text-sm py-2 hover:bg-[#2A2A2A] rounded px-2 -mx-2">
                  <div className="text-white">
                    {new Date(trend.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                  <div className="text-center flex items-center justify-center gap-1 text-white">
                    <ShoppingCart className="h-3 w-3" />
                    {trend.orderCount}
                  </div>
                  <div className="text-right font-semibold text-green-500">${trend.revenue.toFixed(2)}</div>
                  <div className="text-right text-gray-400">${trend.rcnDiscountUsd.toFixed(2)}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
