'use client';

import { useState, useEffect } from 'react';
import { adminApi } from '@/services/api/admin';

export default function EnhancedMetricsTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metricsData, setMetricsData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all metrics in one call for better performance
      const data = await adminApi.getMetricsOverview();

      if (data) {
        setMetricsData(data);
      } else {
        setError('Failed to load metrics data');
      }
    } catch (err: any) {
      console.error('Error loading metrics:', err);
      setError(err.message || 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMetrics();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading enhanced metrics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-red-800 font-semibold mb-2">Error Loading Metrics</h3>
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={loadMetrics}
          className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!metricsData) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No metrics data available</p>
      </div>
    );
  }

  const { shops, customers, revenue, tokens } = metricsData;

  return (
    <div className="space-y-6">
      {/* Header with refresh button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Enhanced Analytics Dashboard</h2>
          <p className="text-gray-600 text-sm mt-1">
            Last updated: {new Date(metricsData.timestamp).toLocaleString()}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {refreshing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Refreshing...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Refresh</span>
            </>
          )}
        </button>
      </div>

      {/* Shop Metrics */}
      {shops && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Shop Metrics
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-600 text-sm font-medium mb-1">Active Shops</p>
              <p className="text-3xl font-bold text-green-900">{shops.activeShops?.toLocaleString() || 0}</p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-600 text-sm font-medium mb-1">Pending Approval</p>
              <p className="text-3xl font-bold text-yellow-900">{shops.pendingShops?.toLocaleString() || 0}</p>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-600 text-sm font-medium mb-1">Suspended</p>
              <p className="text-3xl font-bold text-red-900">{shops.suspendedShops?.toLocaleString() || 0}</p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-600 text-sm font-medium mb-1">Total Shops</p>
              <p className="text-3xl font-bold text-blue-900">{shops.totalShops?.toLocaleString() || 0}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-gray-600 text-sm font-medium mb-1">Total Tokens Issued</p>
              <p className="text-2xl font-bold text-gray-900">{shops.totalTokensIssued?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || 0} RCN</p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-gray-600 text-sm font-medium mb-1">Total Redemptions</p>
              <p className="text-2xl font-bold text-gray-900">{shops.totalRedemptions?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || 0} RCN</p>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-gray-600 text-sm font-medium mb-1">RCN Purchased</p>
              <p className="text-2xl font-bold text-gray-900">{shops.totalRcnPurchased?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || 0} RCN</p>
            </div>
          </div>

          {/* RCG Tier Distribution */}
          <div className="mb-4">
            <h4 className="font-semibold text-gray-700 mb-3">RCG Tier Distribution</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-amber-600 text-sm font-medium mb-1">Standard Tier</p>
                <p className="text-2xl font-bold text-amber-900">{shops.tierDistribution?.standard || 0}</p>
                <p className="text-xs text-amber-600 mt-1">10K+ RCG</p>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-purple-600 text-sm font-medium mb-1">Premium Tier</p>
                <p className="text-2xl font-bold text-purple-900">{shops.tierDistribution?.premium || 0}</p>
                <p className="text-xs text-purple-600 mt-1">50K+ RCG</p>
              </div>

              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                <p className="text-indigo-600 text-sm font-medium mb-1">Elite Tier</p>
                <p className="text-2xl font-bold text-indigo-900">{shops.tierDistribution?.elite || 0}</p>
                <p className="text-xs text-indigo-600 mt-1">200K+ RCG</p>
              </div>
            </div>
          </div>

          {/* Growth Metrics */}
          <div>
            <h4 className="font-semibold text-gray-700 mb-3">Growth</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                <p className="text-teal-600 text-sm font-medium mb-1">Last 7 Days</p>
                <p className="text-2xl font-bold text-teal-900">+{shops.growth?.last7Days || 0} shops</p>
              </div>

              <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
                <p className="text-cyan-600 text-sm font-medium mb-1">Last 30 Days</p>
                <p className="text-2xl font-bold text-cyan-900">+{shops.growth?.last30Days || 0} shops</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Metrics */}
      {customers && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Customer Metrics
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-600 text-sm font-medium mb-1">Active Customers</p>
              <p className="text-3xl font-bold text-green-900">{customers.activeCustomers?.toLocaleString() || 0}</p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-600 text-sm font-medium mb-1">Total Customers</p>
              <p className="text-3xl font-bold text-blue-900">{customers.totalCustomers?.toLocaleString() || 0}</p>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-600 text-sm font-medium mb-1">Suspended</p>
              <p className="text-3xl font-bold text-red-900">{customers.suspendedCustomers?.toLocaleString() || 0}</p>
            </div>
          </div>

          {/* Tier Distribution */}
          <div className="mb-6">
            <h4 className="font-semibold text-gray-700 mb-3">Customer Tier Distribution</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-orange-600 text-sm font-medium mb-1">Bronze Tier</p>
                <p className="text-2xl font-bold text-orange-900">{customers.tierDistribution?.bronze || 0}</p>
                <p className="text-xs text-orange-600 mt-1">Base rewards</p>
              </div>

              <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                <p className="text-gray-600 text-sm font-medium mb-1">Silver Tier</p>
                <p className="text-2xl font-bold text-gray-900">{customers.tierDistribution?.silver || 0}</p>
                <p className="text-xs text-gray-600 mt-1">+2 RCN bonus</p>
              </div>

              <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
                <p className="text-yellow-700 text-sm font-medium mb-1">Gold Tier</p>
                <p className="text-2xl font-bold text-yellow-900">{customers.tierDistribution?.gold || 0}</p>
                <p className="text-xs text-yellow-700 mt-1">+5 RCN bonus</p>
              </div>
            </div>
          </div>

          {/* Earnings & Balance */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <p className="text-emerald-600 text-sm font-medium mb-1">Total Lifetime Earnings</p>
              <p className="text-2xl font-bold text-emerald-900">{customers.totalLifetimeEarnings?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || 0} RCN</p>
              <p className="text-xs text-emerald-600 mt-1">Avg: {customers.averages?.lifetimeEarnings?.toFixed(2) || 0} RCN per customer</p>
            </div>

            <div className="bg-sky-50 border border-sky-200 rounded-lg p-4">
              <p className="text-sky-600 text-sm font-medium mb-1">Total Current Balance</p>
              <p className="text-2xl font-bold text-sky-900">{customers.totalCurrentBalance?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || 0} RCN</p>
              <p className="text-xs text-sky-600 mt-1">Avg: {customers.averages?.currentBalance?.toFixed(2) || 0} RCN per customer</p>
            </div>
          </div>

          {/* Referrals */}
          <div className="mb-6">
            <h4 className="font-semibold text-gray-700 mb-3">Referral Statistics</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
                <p className="text-violet-600 text-sm font-medium mb-1">Customers with Referrals</p>
                <p className="text-2xl font-bold text-violet-900">{customers.referrals?.customersWithReferrals || 0}</p>
              </div>

              <div className="bg-fuchsia-50 border border-fuchsia-200 rounded-lg p-4">
                <p className="text-fuchsia-600 text-sm font-medium mb-1">Total Referrals</p>
                <p className="text-2xl font-bold text-fuchsia-900">{customers.referrals?.totalReferrals || 0}</p>
              </div>
            </div>
          </div>

          {/* Growth */}
          <div>
            <h4 className="font-semibold text-gray-700 mb-3">Customer Growth & Activity</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-lime-50 border border-lime-200 rounded-lg p-4">
                <p className="text-lime-600 text-sm font-medium mb-1">New (Last 7 Days)</p>
                <p className="text-2xl font-bold text-lime-900">+{customers.growth?.newLast7Days || 0}</p>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <p className="text-emerald-600 text-sm font-medium mb-1">New (Last 30 Days)</p>
                <p className="text-2xl font-bold text-emerald-900">+{customers.growth?.newLast30Days || 0}</p>
              </div>

              <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                <p className="text-teal-600 text-sm font-medium mb-1">Active (Last 7 Days)</p>
                <p className="text-2xl font-bold text-teal-900">{customers.growth?.activeLast7Days || 0}</p>
              </div>

              <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
                <p className="text-cyan-600 text-sm font-medium mb-1">Active (Last 30 Days)</p>
                <p className="text-2xl font-bold text-cyan-900">{customers.growth?.activeLast30Days || 0}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Revenue Metrics */}
      {revenue && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Revenue Metrics
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <p className="text-emerald-600 text-sm font-medium mb-1">Total Revenue (RCN Sales)</p>
              <p className="text-3xl font-bold text-emerald-900">${revenue.rcnSales?.totalRevenue?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || 0}</p>
              <p className="text-xs text-emerald-600 mt-1">{revenue.rcnSales?.totalRcnSold?.toLocaleString() || 0} RCN sold</p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-600 text-sm font-medium mb-1">Monthly Recurring Revenue</p>
              <p className="text-3xl font-bold text-blue-900">${revenue.subscriptions?.monthlyRecurringRevenue?.toLocaleString() || 0}</p>
              <p className="text-xs text-blue-600 mt-1">{revenue.subscriptions?.activeSubscriptions || 0} active subscriptions</p>
            </div>
          </div>

          {/* RCN Sales Breakdown */}
          <div className="mb-6">
            <h4 className="font-semibold text-gray-700 mb-3">RCN Sales Breakdown</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-600 text-sm font-medium mb-1">Today</p>
                <p className="text-2xl font-bold text-green-900">${revenue.rcnSales?.revenueToday?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || 0}</p>
              </div>

              <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                <p className="text-teal-600 text-sm font-medium mb-1">Last 7 Days</p>
                <p className="text-2xl font-bold text-teal-900">${revenue.rcnSales?.revenueLast7Days?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || 0}</p>
              </div>

              <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
                <p className="text-cyan-600 text-sm font-medium mb-1">Last 30 Days</p>
                <p className="text-2xl font-bold text-cyan-900">${revenue.rcnSales?.revenueLast30Days?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || 0}</p>
              </div>
            </div>
          </div>

          {/* Purchase Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <p className="text-purple-600 text-sm font-medium mb-1">Total Purchases</p>
              <p className="text-2xl font-bold text-purple-900">{revenue.rcnSales?.totalPurchases?.toLocaleString() || 0}</p>
            </div>

            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
              <p className="text-indigo-600 text-sm font-medium mb-1">Average Purchase Value</p>
              <p className="text-2xl font-bold text-indigo-900">${revenue.rcnSales?.avgPurchaseValue?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || 0}</p>
            </div>
          </div>
        </div>
      )}

      {/* Token Metrics */}
      {tokens && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Token Metrics
          </h3>

          {/* Circulation */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-600 text-sm font-medium mb-1">Total Minted</p>
              <p className="text-3xl font-bold text-blue-900">{tokens.tokens?.totalMinted?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || 0}</p>
              <p className="text-xs text-blue-600 mt-1">RCN</p>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-600 text-sm font-medium mb-1">Total Redeemed</p>
              <p className="text-3xl font-bold text-red-900">{tokens.tokens?.totalRedeemed?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || 0}</p>
              <p className="text-xs text-red-600 mt-1">RCN</p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-600 text-sm font-medium mb-1">In Circulation</p>
              <p className="text-3xl font-bold text-green-900">{tokens.tokens?.circulation?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || 0}</p>
              <p className="text-xs text-green-600 mt-1">RCN</p>
            </div>
          </div>

          {/* Today's Activity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <p className="text-emerald-600 text-sm font-medium mb-1">Minted Today</p>
              <p className="text-2xl font-bold text-emerald-900">{tokens.tokens?.mintedToday?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || 0} RCN</p>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="text-orange-600 text-sm font-medium mb-1">Redeemed Today</p>
              <p className="text-2xl font-bold text-orange-900">{tokens.tokens?.redeemedToday?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || 0} RCN</p>
            </div>
          </div>

          {/* Transaction Metrics */}
          <div className="mb-6">
            <h4 className="font-semibold text-gray-700 mb-3">Transaction Statistics</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-gray-600 text-sm font-medium mb-1">Total Transactions</p>
                <p className="text-2xl font-bold text-gray-900">{tokens.transactions?.total?.toLocaleString() || 0}</p>
              </div>

              <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
                <p className="text-violet-600 text-sm font-medium mb-1">Last 7 Days</p>
                <p className="text-2xl font-bold text-violet-900">{tokens.transactions?.last7Days?.toLocaleString() || 0}</p>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-purple-600 text-sm font-medium mb-1">Last 30 Days</p>
                <p className="text-2xl font-bold text-purple-900">{tokens.transactions?.last30Days?.toLocaleString() || 0}</p>
              </div>
            </div>
          </div>

          {/* Token Breakdown */}
          <div className="mb-6">
            <h4 className="font-semibold text-gray-700 mb-3">Token Distribution Breakdown</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-sky-50 border border-sky-200 rounded-lg p-4">
                <p className="text-sky-600 text-sm font-medium mb-1">Repair Rewards</p>
                <p className="text-2xl font-bold text-sky-900">{tokens.breakdown?.repairRewards?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || 0} RCN</p>
              </div>

              <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
                <p className="text-pink-600 text-sm font-medium mb-1">Referral Rewards</p>
                <p className="text-2xl font-bold text-pink-900">{tokens.breakdown?.referralRewards?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || 0} RCN</p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-amber-600 text-sm font-medium mb-1">Tier Bonuses</p>
                <p className="text-2xl font-bold text-amber-900">{tokens.breakdown?.tierBonuses?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || 0} RCN</p>
              </div>
            </div>
          </div>

          {/* Redemption Rate */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
            <p className="text-gray-700 font-medium mb-2">Overall Redemption Rate</p>
            <div className="flex items-end gap-4">
              <p className="text-4xl font-bold text-blue-900">{tokens.redemptionRate?.toFixed(2) || 0}%</p>
              <div className="flex-1">
                <div className="bg-gray-200 rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-purple-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(tokens.redemptionRate || 0, 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              {tokens.tokens?.totalRedeemed?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || 0} of {tokens.tokens?.totalMinted?.toLocaleString(undefined, { maximumFractionDigits: 2 }) || 0} RCN redeemed
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
