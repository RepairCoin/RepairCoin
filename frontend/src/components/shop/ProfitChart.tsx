"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
  ReferenceLine,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Calendar, RefreshCw } from 'lucide-react';
import { useShopProfitStore } from '@/stores/shopProfitStore';

interface ProfitData {
  date: string;
  revenue: number;
  costs: number;
  profit: number;
  rcnPurchased: number;
  rcnIssued: number;
  profitMargin: number;
}

interface ProfitMetrics {
  totalProfit: number;
  totalRevenue: number;
  totalCosts: number;
  averageProfitMargin: number;
  profitTrend: 'up' | 'down' | 'flat';
}

interface ProfitChartProps {
  shopId: string;
}

/**
 * ProfitChart Component - Full featured profit analysis
 * Uses Zustand store with localStorage persistence and 5-minute polling
 */
export const ProfitChart: React.FC<ProfitChartProps> = ({ shopId }) => {
  const [timeRange, setTimeRange] = useState<'day' | 'month' | 'year'>('month');

  // Get store state and actions
  const {
    dataByShop,
    isRefreshing,
    error,
    fetchProfitData,
    startPolling,
    stopPolling,
  } = useShopProfitStore();

  // Get shop-specific data
  const shopData = dataByShop[shopId];
  const rawTransactions = shopData?.transactions || [];
  const rawPurchases = shopData?.purchases || [];

  // Initial fetch + start polling
  useEffect(() => {
    fetchProfitData(shopId);
    startPolling(shopId);
    return () => stopPolling();
  }, [shopId, fetchProfitData, startPolling, stopPolling]);

  const formatDateByRange = useCallback((date: Date, range: 'day' | 'month' | 'year'): string => {
    switch (range) {
      case 'day':
        return date.toISOString().split('T')[0];
      case 'month':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      case 'year':
        return String(date.getFullYear());
    }
  }, []);

  const processRawDataToProfit = useCallback((
    transactions: any[],
    purchases: any[],
    range: 'day' | 'month' | 'year'
  ): ProfitData[] => {
    const dataMap = new Map<string, {
      revenue: number;
      costs: number;
      rcnPurchased: number;
      rcnIssued: number;
    }>();

    const safeTransactions = Array.isArray(transactions) ? transactions : [];
    const safePurchases = Array.isArray(purchases) ? purchases : [];

    safePurchases.forEach((purchase: any) => {
      if (purchase.status === 'completed' || !purchase.status) {
        const date = formatDateByRange(new Date(purchase.created_at || purchase.createdAt), range);
        const existing = dataMap.get(date) || { revenue: 0, costs: 0, rcnPurchased: 0, rcnIssued: 0 };
        const purchaseCost = parseFloat(purchase.total_cost || purchase.totalCost || 0);
        const purchaseAmount = parseFloat(purchase.amount || 0);

        dataMap.set(date, {
          ...existing,
          costs: existing.costs + purchaseCost,
          rcnPurchased: existing.rcnPurchased + purchaseAmount
        });
      }
    });

    safeTransactions.forEach((transaction: any) => {
      if (transaction.type === 'reward' || transaction.type === 'mint') {
        const date = formatDateByRange(new Date(transaction.createdAt || transaction.timestamp), range);
        const existing = dataMap.get(date) || { revenue: 0, costs: 0, rcnPurchased: 0, rcnIssued: 0 };

        let repairRevenue = 0;
        if (transaction.metadata?.repairAmount) {
          repairRevenue = transaction.metadata.repairAmount;
        } else if (transaction.repairAmount) {
          repairRevenue = transaction.repairAmount;
        } else {
          const rcnAmount = parseFloat(transaction.amount || 0);
          repairRevenue = rcnAmount * 10;
        }

        dataMap.set(date, {
          ...existing,
          revenue: existing.revenue + repairRevenue,
          rcnIssued: existing.rcnIssued + parseFloat(transaction.amount || 0)
        });
      }
    });

    const result = Array.from(dataMap.entries())
      .map(([date, data]) => ({
        date,
        revenue: data.revenue,
        costs: data.costs,
        profit: data.revenue - data.costs,
        rcnPurchased: data.rcnPurchased,
        rcnIssued: data.rcnIssued,
        profitMargin: data.revenue > 0 ? ((data.revenue - data.costs) / data.revenue) * 100 : 0
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return result;
  }, [formatDateByRange]);

  const calculateMetrics = useCallback((data: ProfitData[]): ProfitMetrics => {
    if (data.length === 0) {
      return {
        totalProfit: 0,
        totalRevenue: 0,
        totalCosts: 0,
        averageProfitMargin: 0,
        profitTrend: 'flat',
      };
    }

    const totalProfit = data.reduce((sum, item) => sum + item.profit, 0);
    const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);
    const totalCosts = data.reduce((sum, item) => sum + item.costs, 0);
    const averageProfitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    const midPoint = Math.floor(data.length / 2);
    const firstHalf = data.slice(0, midPoint);
    const secondHalf = data.slice(midPoint);

    const firstHalfAvg = firstHalf.length > 0 ? firstHalf.reduce((sum, item) => sum + item.profit, 0) / firstHalf.length : 0;
    const secondHalfAvg = secondHalf.length > 0 ? secondHalf.reduce((sum, item) => sum + item.profit, 0) / secondHalf.length : 0;

    let profitTrend: 'up' | 'down' | 'flat' = 'flat';
    if (secondHalfAvg > firstHalfAvg * 1.05) profitTrend = 'up';
    else if (secondHalfAvg < firstHalfAvg * 0.95) profitTrend = 'down';

    return {
      totalProfit,
      totalRevenue,
      totalCosts,
      averageProfitMargin,
      profitTrend,
    };
  }, []);

  // Compute filtered profit data based on time range
  const filteredProfitData = useMemo(() => {
    if (rawTransactions.length === 0 && rawPurchases.length === 0) {
      return [];
    }

    const endDate = new Date();
    const startDate = new Date();

    switch (timeRange) {
      case 'day':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case 'month':
        startDate.setMonth(endDate.getMonth() - 12);
        break;
      case 'year':
        startDate.setFullYear(endDate.getFullYear() - 5);
        break;
    }

    const filteredTransactions = rawTransactions.filter((t: any) => {
      const date = new Date(t.createdAt || t.timestamp);
      return date >= startDate && date <= endDate;
    });

    const filteredPurchases = rawPurchases.filter((p: any) => {
      const date = new Date(p.created_at || p.createdAt);
      return date >= startDate && date <= endDate;
    });

    return processRawDataToProfit(filteredTransactions, filteredPurchases, timeRange);
  }, [rawTransactions, rawPurchases, timeRange, processRawDataToProfit]);

  // Compute metrics from filtered data
  const metrics = useMemo(() => {
    return filteredProfitData.length > 0 ? calculateMetrics(filteredProfitData) : null;
  }, [filteredProfitData, calculateMetrics]);

  const formatCurrency = useCallback((value: number) => `$${value.toFixed(2)}`, []);

  const formatXAxisLabel = useCallback((value: string) => {
    switch (timeRange) {
      case 'day':
        return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      case 'month':
        return new Date(value + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      case 'year':
        return value;
      default:
        return value;
    }
  }, [timeRange]);

  const CustomTooltip = useCallback(({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-lg">
          <p className="text-gray-300 font-medium mb-2">{formatXAxisLabel(label)}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.name.includes('Margin') ? `${entry.value.toFixed(1)}%` : formatCurrency(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  }, [formatXAxisLabel, formatCurrency]);

  // Only show skeleton on first load (no cached data exists)
  const isFirstLoad = !shopData && isRefreshing;

  if (isFirstLoad) {
    return (
      <div className="bg-[#101010] rounded-[20px] p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-700 rounded w-48 mb-4"></div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-700 rounded-lg"></div>
            ))}
          </div>
          <div className="h-[300px] bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (error && !shopData) {
    return (
      <div className="bg-[#101010] rounded-[20px] p-6">
        <div className="text-center text-red-400">
          <p className="text-lg font-semibold mb-2">Error Loading Profit Data</p>
          <p className="text-sm">{error}</p>
          <button
            onClick={() => fetchProfitData(shopId, true)}
            className="mt-4 px-4 py-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#101010] rounded-[20px] overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 px-4 sm:px-6 py-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[#FFCC00]" />
          <h3 className="text-[#FFCC00] text-base font-medium">Profit Analysis</h3>
          {/* Subtle refresh indicator */}
          {isRefreshing && (
            <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />
          )}
        </div>

        {/* Time Range Selector */}
        <div className="flex bg-[#1e1f22] rounded-lg p-1 w-full sm:w-auto">
          {(['day', 'month', 'year'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                timeRange === range
                  ? 'bg-[#FFCC00] text-[#101010]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {range === 'day' ? 'Daily' : range === 'month' ? 'Monthly' : 'Yearly'}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics Cards */}
      {metrics && (
        <div className="px-4 sm:px-6 pb-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
            <div className="bg-[#1e1f22] rounded-lg p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] sm:text-xs text-gray-400">Total Profit</p>
                  <p className={`text-sm sm:text-lg font-bold ${metrics.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatCurrency(metrics.totalProfit)}
                  </p>
                </div>
                {metrics.profitTrend === 'up' ? (
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-green-400 flex-shrink-0 ml-1" />
                ) : metrics.profitTrend === 'down' ? (
                  <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 text-red-400 flex-shrink-0 ml-1" />
                ) : (
                  <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0 ml-1" />
                )}
              </div>
            </div>

            <div className="bg-[#1e1f22] rounded-lg p-3 sm:p-4">
              <p className="text-[10px] sm:text-xs text-gray-400">Revenue</p>
              <p className="text-sm sm:text-lg font-bold text-blue-400">
                {formatCurrency(metrics.totalRevenue)}
              </p>
            </div>

            <div className="bg-[#1e1f22] rounded-lg p-3 sm:p-4">
              <p className="text-[10px] sm:text-xs text-gray-400">Costs</p>
              <p className="text-sm sm:text-lg font-bold text-orange-400">
                {formatCurrency(metrics.totalCosts)}
              </p>
            </div>

            <div className="bg-[#1e1f22] rounded-lg p-3 sm:p-4">
              <p className="text-[10px] sm:text-xs text-gray-400">Profit Margin</p>
              <p className={`text-sm sm:text-lg font-bold ${metrics.averageProfitMargin >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {metrics.averageProfitMargin.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="px-4 sm:px-6 pb-6">
        {filteredProfitData.length > 0 ? (
          <div className="space-y-4 sm:space-y-6">
            {/* Main Area Chart - Profit & Loss Over Time */}
            <div className="bg-[#1e1f22] rounded-lg p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
                <h4 className="text-white text-sm sm:text-base font-medium">Profit & Loss Over Time</h4>
                <div className="flex items-center gap-3 sm:gap-4 text-xs sm:text-sm">
                  <div className="flex items-center gap-1 sm:gap-2">
                    <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-green-500"></div>
                    <span className="text-gray-300">Profit</span>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2">
                    <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-red-500"></div>
                    <span className="text-gray-300">Loss</span>
                  </div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={filteredProfitData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#9CA3AF' }}
                    tickFormatter={formatXAxisLabel}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#9CA3AF' }}
                    tickFormatter={formatCurrency}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="#6B7280" strokeDasharray="5 5" strokeWidth={1} />
                  <Line
                    type="monotone"
                    dataKey="profit"
                    stroke="#6B7280"
                    strokeWidth={2}
                    name="Profit/Loss"
                    dot={(props: any) => {
                      const { cx, cy, payload } = props;
                      const isProfit = payload.profit >= 0;
                      const color = isProfit ? '#10B981' : '#EF4444';
                      return (
                        <circle
                          key={`${cx}-${cy}-${payload.date}`}
                          cx={cx}
                          cy={cy}
                          r={6}
                          fill={color}
                          stroke="#ffffff"
                          strokeWidth={2}
                        />
                      );
                    }}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Revenue vs Costs Chart */}
            <div className="bg-[#1e1f22] rounded-lg p-3 sm:p-4">
              <h4 className="text-white text-sm sm:text-base font-medium mb-4">Revenue vs Costs</h4>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={filteredProfitData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#9CA3AF' }}
                    tickFormatter={formatXAxisLabel}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#9CA3AF' }}
                    tickFormatter={formatCurrency}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ paddingTop: '10px' }}
                    formatter={(value) => <span className="text-gray-300">{value}</span>}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    name="Revenue"
                    dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="costs"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    name="Costs"
                    dot={{ fill: '#F59E0B', strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Profit Margin Trend */}
            <div className="bg-[#1e1f22] rounded-lg p-3 sm:p-4">
              <h4 className="text-white text-sm sm:text-base font-medium mb-4">Profit Margin Trend</h4>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={filteredProfitData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#9CA3AF' }}
                    tickFormatter={formatXAxisLabel}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#9CA3AF' }}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="profitMargin"
                    stroke="#8B5CF6"
                    strokeWidth={2}
                    name="Profit Margin"
                    dot={{ fill: '#8B5CF6', strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="h-[300px] flex flex-col items-center justify-center text-center">
            <Calendar className="w-12 h-12 text-gray-600 mb-4" />
            <p className="text-gray-400 text-lg">No profit data available</p>
            <p className="text-gray-500 text-sm mt-1">Start issuing rewards to see your profit analysis</p>
          </div>
        )}
      </div>
    </div>
  );
};
