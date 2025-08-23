'use client';

import React from 'react';
import { StatCard } from '@/components/shared/StatCard';
import { 
  formatRCN,
  formatCurrency,
  TierBonusStats
} from '@/utils/tierCalculations';

interface ShopData {
  totalTokensIssued: number;
  totalRedemptions: number;
  totalRcnPurchased: number;
  purchasedRcnBalance: number;
}

interface PurchaseHistory {
  id: string;
  amount: number;
  totalCost?: number;
  createdAt: string;
  status: string;
}

interface AnalyticsTabProps {
  shopData: ShopData | null;
  tierStats: TierBonusStats | null;
  purchases: PurchaseHistory[];
}

export const AnalyticsTab: React.FC<AnalyticsTabProps> = ({ shopData, tierStats, purchases }) => {
  // Calculate analytics data from real data
  const totalRevenue = shopData?.totalRcnPurchased || 0;
  const completedPurchases = purchases.filter(p => p.status === 'completed');
  const averagePurchaseSize = completedPurchases.length > 0 
    ? completedPurchases.reduce((sum, p) => sum + (p.amount || 0), 0) / completedPurchases.length 
    : 0;
  const successRate = purchases.length > 0 
    ? (completedPurchases.length / purchases.length) * 100 
    : 0;

  // Calculate monthly data from real purchases
  const monthlyData = calculateMonthlyData(purchases);

  // Calculate real trends based on purchase history
  const revenueGrowth = calculateRevenueGrowth(purchases);
  const avgPurchaseGrowth = calculateAvgPurchaseGrowth(purchases);
  const efficiencyRatio = shopData?.totalRcnPurchased ? 
    ((shopData.totalTokensIssued || 0) / shopData.totalRcnPurchased * 100) : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          label="Total Revenue"
          value={formatCurrency(totalRevenue)}
          subtitle="From RCN purchases"
          trend={`${revenueGrowth >= 0 ? '+' : ''}${revenueGrowth.toFixed(1)}%`}
          trendUp={revenueGrowth >= 0}
          color="green"
          icon="💰"
        />
        <StatCard
          label="Average Purchase"
          value={formatRCN(averagePurchaseSize)}
          subtitle="Per transaction"
          trend={`${avgPurchaseGrowth >= 0 ? '+' : ''}${avgPurchaseGrowth.toFixed(1)}%`}
          trendUp={avgPurchaseGrowth >= 0}
          color="blue"
          icon="📈"
        />
        <StatCard
          label="Success Rate"
          value={`${successRate.toFixed(1)}%`}
          subtitle="Payment completion"
          trend={successRate === 100 ? 'Perfect' : `${successRate > 95 ? 'Good' : 'Needs attention'}`}
          trendUp={successRate > 95}
          color={successRate > 95 ? 'green' : successRate > 90 ? 'yellow' : 'red'}
          icon="✅"
        />
        <StatCard
          label="Token Efficiency"
          value={`${efficiencyRatio.toFixed(1)}%`}
          subtitle="Issued vs purchased"
          trend={efficiencyRatio > 80 ? 'Optimal' : efficiencyRatio > 50 ? 'Good' : 'Low'}
          trendUp={efficiencyRatio > 50}
          color={efficiencyRatio > 80 ? 'green' : efficiencyRatio > 50 ? 'yellow' : 'red'}
          icon="⚡"
        />
      </div>

      {/* Monthly Performance Chart */}
      <div className="bg-gradient-to-br from-[#1C1C1C] to-[#252525] rounded-2xl p-8 border border-gray-800 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-white">Monthly Performance</h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-[#FFCC00] rounded-full"></div>
              <span className="text-sm text-gray-400">Revenue</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-400">Purchases</span>
            </div>
          </div>
        </div>
        {monthlyData.some(m => m.revenue > 0) ? (
          <div className="space-y-6">
            {monthlyData.map((month) => (
              <MonthlyBar
                key={month.name}
                month={month.name}
                purchases={month.purchases}
                revenue={month.revenue}
                maxRevenue={Math.max(...monthlyData.map(m => m.revenue), 1)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-gray-400 text-lg font-medium">No purchase data yet</p>
            <p className="text-sm text-gray-500 mt-2">Start purchasing RCN to see your performance metrics</p>
          </div>
        )}
      </div>

{/* Token Flow Analysis - Full Width */}
      <div className="bg-gradient-to-br from-[#1C1C1C] to-[#252525] rounded-2xl p-8 border border-gray-800 mb-8">
          <h3 className="text-2xl font-bold text-white mb-6">Token Flow Analysis</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FlowCard
              label="RCN Purchased"
              value={shopData?.totalRcnPurchased || 0}
              type="in"
              icon="💰"
              description="Total tokens bought"
            />
            <FlowCard
              label="Regular Rewards"
              value={(shopData?.totalTokensIssued || 0) - (tierStats?.totalBonusAmount || 0)}
              type="out"
              icon="🎁"
              description="Base rewards issued"
            />
            <FlowCard
              label="Tier Bonuses"
              value={tierStats?.totalBonusAmount || 0}
              type="out"
              icon="🏆"
              description="Extra tier rewards"
            />
            <FlowCard
              label="Current Balance"
              value={shopData?.purchasedRcnBalance || 0}
              type="balance"
              icon="💎"
              description="Available to distribute"
            />
          </div>
          <div className="mt-6 pt-6 border-t border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400">Customer Redemptions:</span>
                <span className="text-lg font-bold text-green-500">{formatRCN(shopData?.totalRedemptions || 0)}</span>
                <span className="text-xs text-gray-500">(Tokens returned via redemptions)</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400">Net Distribution:</span>
                <span className="text-lg font-bold text-[#FFCC00]">
                  {formatRCN((shopData?.totalTokensIssued || 0) - (shopData?.totalRedemptions || 0))}
                </span>
              </div>
            </div>
          </div>
      </div>
    </div>
  );
};


interface MonthlyBarProps {
  month: string;
  purchases: number;
  revenue: number;
  maxRevenue: number;
}

const MonthlyBar: React.FC<MonthlyBarProps> = ({ month, purchases, revenue, maxRevenue }) => {
  const percentage = maxRevenue > 0 ? (revenue / maxRevenue) * 100 : 0;

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-300">{month}</span>
        <div className="text-right">
          <span className="text-sm font-semibold text-white">${revenue.toFixed(0)}</span>
          <span className="text-xs text-gray-500 ml-2">({purchases} purchases)</span>
        </div>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-2">
        <div 
          className="bg-gradient-to-r from-[#FFCC00] to-yellow-500 h-2 rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};


interface FlowCardProps {
  label: string;
  value: number;
  type: 'in' | 'out' | 'balance';
  icon: string;
  description: string;
}

const FlowCard: React.FC<FlowCardProps> = ({ label, value, type, icon, description }) => {
  const colors = {
    in: 'text-green-500 border-green-500/30 bg-green-500/10',
    out: 'text-red-500 border-red-500/30 bg-red-500/10',
    balance: 'text-[#FFCC00] border-[#FFCC00]/30 bg-[#FFCC00]/10',
  };

  const arrows = {
    in: '↓',
    out: '↑',
    balance: '=',
  };

  return (
    <div className={`rounded-xl p-6 border ${colors[type]} hover:bg-opacity-20 transition-all`}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-2xl">{icon}</span>
        <span className={`text-lg font-bold ${colors[type].split(' ')[0]}`}>
          {arrows[type]}
        </span>
      </div>
      <div className="space-y-1">
        <p className="text-sm text-gray-400">{label}</p>
        <p className={`text-2xl font-bold ${colors[type].split(' ')[0]}`}>
          {formatRCN(value)}
        </p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
    </div>
  );
};


// Helper functions
function calculateMonthlyData(purchases: PurchaseHistory[]) {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  
  // Get last 6 months of data
  const monthlyData = [];
  for (let i = 5; i >= 0; i--) {
    const targetMonth = new Date(currentYear, currentMonth - i, 1);
    const monthIndex = targetMonth.getMonth();
    const year = targetMonth.getFullYear();
    
    // Filter purchases for this month
    const monthPurchases = purchases.filter(p => {
      const purchaseDate = new Date(p.createdAt);
      return purchaseDate.getMonth() === monthIndex && 
             purchaseDate.getFullYear() === year &&
             p.status === 'completed';
    });
    
    const monthRevenue = monthPurchases.reduce((sum, p) => sum + (p.amount || 0), 0);
    
    monthlyData.push({
      name: monthNames[monthIndex],
      purchases: monthPurchases.length,
      revenue: monthRevenue,
    });
  }
  
  return monthlyData;
}


function calculateRevenueGrowth(purchases: PurchaseHistory[]): number {
  if (purchases.length === 0) return 0;
  
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  
  const lastMonthRevenue = purchases
    .filter(p => {
      const date = new Date(p.createdAt);
      return date >= lastMonth && date < now && p.status === 'completed';
    })
    .reduce((sum, p) => sum + (p.amount || 0), 0);
    
  const previousMonthRevenue = purchases
    .filter(p => {
      const date = new Date(p.createdAt);
      return date >= twoMonthsAgo && date < lastMonth && p.status === 'completed';
    })
    .reduce((sum, p) => sum + (p.amount || 0), 0);
    
  if (previousMonthRevenue === 0) return lastMonthRevenue > 0 ? 100 : 0;
  
  return ((lastMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100;
}

function calculateAvgPurchaseGrowth(purchases: PurchaseHistory[]): number {
  if (purchases.length === 0) return 0;
  
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  
  const lastMonthPurchases = purchases.filter(p => {
    const date = new Date(p.createdAt);
    return date >= lastMonth && date < now && p.status === 'completed';
  });
  
  const previousMonthPurchases = purchases.filter(p => {
    const date = new Date(p.createdAt);
    return date >= twoMonthsAgo && date < lastMonth && p.status === 'completed';
  });
  
  const lastMonthAvg = lastMonthPurchases.length > 0 
    ? lastMonthPurchases.reduce((sum, p) => sum + (p.amount || 0), 0) / lastMonthPurchases.length
    : 0;
    
  const previousMonthAvg = previousMonthPurchases.length > 0
    ? previousMonthPurchases.reduce((sum, p) => sum + (p.amount || 0), 0) / previousMonthPurchases.length
    : 0;
    
  if (previousMonthAvg === 0) return lastMonthAvg > 0 ? 100 : 0;
  
  return ((lastMonthAvg - previousMonthAvg) / previousMonthAvg) * 100;
}