'use client';

import React from 'react';

interface ShopData {
  totalTokensIssued: number;
  totalRedemptions: number;
  totalRcnPurchased: number;
  purchasedRcnBalance: number;
}

interface TierBonusStats {
  totalBonusesIssued: number;
  totalBonusAmount: number;
  bonusesByTier: { [key: string]: { count: number; amount: number } };
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
  
  // Calculate tier distribution from real tier stats
  const tierDistribution = calculateTierDistribution(tierStats);

  // Calculate real trends based on purchase history
  const revenueGrowth = calculateRevenueGrowth(purchases);
  const avgPurchaseGrowth = calculateAvgPurchaseGrowth(purchases);
  const efficiencyRatio = shopData?.totalRcnPurchased ? 
    ((shopData.totalTokensIssued || 0) / shopData.totalRcnPurchased * 100) : 0;

  // Calculate bonuses per balance
  const avgBonusAmount = tierStats && tierStats.totalBonusesIssued > 0 
    ? Math.round(tierStats.totalBonusAmount / tierStats.totalBonusesIssued)
    : 20; // Default to average of tier bonuses
  const bonusesRemaining = Math.floor((shopData?.purchasedRcnBalance || 0) / avgBonusAmount);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard
          title="Total Revenue"
          value={`$${totalRevenue.toFixed(2)}`}
          subtitle="From RCN purchases"
          trend={`${revenueGrowth >= 0 ? '+' : ''}${revenueGrowth.toFixed(1)}%`}
          trendUp={revenueGrowth >= 0}
          icon={
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
            </svg>
          }
        />
        <MetricCard
          title="Average Purchase"
          value={`${averagePurchaseSize.toFixed(0)} RCN`}
          subtitle="Per transaction"
          trend={`${avgPurchaseGrowth >= 0 ? '+' : ''}${avgPurchaseGrowth.toFixed(1)}%`}
          trendUp={avgPurchaseGrowth >= 0}
          icon={
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 2a2 2 0 00-2 2v14l3.5-2 3.5 2 3.5-2 3.5 2V4a2 2 0 00-2-2H5zm2.5 3a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm6.207.293a1 1 0 00-1.414 0l-6 6a1 1 0 101.414 1.414l6-6a1 1 0 000-1.414zM12.5 10a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" clipRule="evenodd" />
            </svg>
          }
        />
        <MetricCard
          title="Success Rate"
          value={`${successRate.toFixed(1)}%`}
          subtitle="Payment completion"
          trend={successRate === 100 ? '100%' : `${successRate > 95 ? '+' : '-'}${(100 - successRate).toFixed(1)}%`}
          trendUp={successRate > 95}
          icon={
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          }
        />
        <MetricCard
          title="Token Efficiency"
          value={`${efficiencyRatio.toFixed(1)}%`}
          subtitle="Tokens issued vs purchased"
          trend={efficiencyRatio > 80 ? 'Optimal' : 'Good'}
          trendUp={efficiencyRatio > 50}
          icon={
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
            </svg>
          }
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

      {/* Customer Engagement */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Tier Distribution */}
        <div className="bg-gradient-to-br from-[#1C1C1C] to-[#252525] rounded-2xl p-8 border border-gray-800">
          <h3 className="text-xl font-bold text-white mb-6">Customer Tier Distribution</h3>
          <div className="space-y-4">
            {tierDistribution.map((tier) => (
              <TierDistributionBar
                key={tier.name}
                tier={tier.name}
                percentage={tier.percentage}
                count={tier.count}
                color={tier.color}
              />
            ))}
            {tierDistribution.every(t => t.count === 0) && (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <p className="text-gray-400 font-medium">No tier data yet</p>
                <p className="text-sm text-gray-500 mt-1">Start issuing rewards to see tier distribution</p>
              </div>
            )}
          </div>
        </div>

        {/* Token Flow */}
        <div className="bg-gradient-to-br from-[#1C1C1C] to-[#252525] rounded-2xl p-8 border border-gray-800">
          <h3 className="text-xl font-bold text-white mb-6">Token Flow Analysis</h3>
          <div className="space-y-4">
            <FlowItem
              label="RCN Purchased"
              value={shopData?.totalRcnPurchased || 0}
              type="in"
            />
            <FlowItem
              label="Regular Rewards Issued"
              value={(shopData?.totalTokensIssued || 0) - (tierStats?.totalBonusAmount || 0)}
              type="out"
            />
            <FlowItem
              label="Tier Bonuses Issued"
              value={tierStats?.totalBonusAmount || 0}
              type="out"
            />
            <FlowItem
              label="Customer Redemptions"
              value={shopData?.totalRedemptions || 0}
              type="in"
            />
            <div className="pt-4 border-t border-gray-700">
              <FlowItem
                label="Current Balance"
                value={shopData?.purchasedRcnBalance || 0}
                type="balance"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface MetricCardProps {
  title: string;
  value: string;
  subtitle: string;
  trend: string;
  trendUp: boolean;
  icon?: React.ReactNode;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, subtitle, trend, trendUp, icon }) => {
  return (
    <div className="bg-gradient-to-br from-[#1C1C1C] to-[#252525] rounded-2xl p-6 border border-gray-800 hover:border-gray-700 transition-all">
      <div className="flex items-start justify-between mb-4">
        <p className="text-sm font-medium text-gray-400">{title}</p>
        {icon && (
          <div className="text-[#FFCC00] opacity-50">
            {icon}
          </div>
        )}
      </div>
      <p className="text-3xl font-bold text-white mb-1">{value}</p>
      <div className="flex items-center justify-between mt-4">
        <p className="text-xs text-gray-500">{subtitle}</p>
        <span className={`text-sm font-medium ${trendUp ? 'text-green-500' : 'text-red-500'}`}>
          {trendUp ? '↑' : '↓'} {trend}
        </span>
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

interface TierDistributionBarProps {
  tier: string;
  percentage: number;
  count: number;
  color: string;
}

const TierDistributionBar: React.FC<TierDistributionBarProps> = ({ tier, percentage, count, color }) => {
  const colorClasses = {
    orange: 'from-orange-500 to-orange-600',
    gray: 'from-gray-400 to-gray-500',
    yellow: 'from-[#FFCC00] to-yellow-500',
  };

  const tierIcons = {
    'Bronze': '🥉',
    'Silver': '🥈',
    'Gold': '🥇',
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{tierIcons[tier as keyof typeof tierIcons] || ''}</span>
          <span className="text-sm font-medium text-gray-300">{tier}</span>
        </div>
        <div className="text-right">
          <span className="text-sm font-semibold text-white">{percentage.toFixed(1)}%</span>
          <span className="text-xs text-gray-500 ml-2">({count} customers)</span>
        </div>
      </div>
      <div className="w-full bg-gray-800 rounded-full h-2">
        <div 
          className={`bg-gradient-to-r ${colorClasses[color as keyof typeof colorClasses]} h-2 rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

interface FlowItemProps {
  label: string;
  value: number;
  type: 'in' | 'out' | 'balance';
}

const FlowItem: React.FC<FlowItemProps> = ({ label, value, type }) => {
  const colors = {
    in: 'text-green-500',
    out: 'text-red-500',
    balance: 'text-[#FFCC00]',
  };

  const bgColors = {
    in: 'bg-green-500',
    out: 'bg-red-500',
    balance: 'bg-[#FFCC00]',
  };

  const icons = {
    in: '↓',
    out: '↑',
    balance: '=',
  };

  return (
    <div className="flex justify-between items-center p-3 rounded-lg hover:bg-gray-800 hover:bg-opacity-30 transition-all">
      <span className="text-gray-400">{label}</span>
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 ${bgColors[type]} bg-opacity-20 rounded-lg flex items-center justify-center`}>
          <span className={`${colors[type]} text-lg font-bold`}>{icons[type]}</span>
        </div>
        <span className={`font-semibold ${colors[type]}`}>{value.toFixed(0)} RCN</span>
      </div>
    </div>
  );
};

interface InsightCardProps {
  icon: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
}

const InsightCard: React.FC<InsightCardProps> = ({ icon, title, description, priority }) => {
  const priorityColors = {
    low: 'border-gray-700 bg-gray-800 bg-opacity-30',
    medium: 'border-yellow-800 bg-yellow-900 bg-opacity-20',
    high: 'border-red-800 bg-red-900 bg-opacity-20',
  };

  const priorityBadges = {
    low: { text: 'Low Priority', color: 'text-gray-400 bg-gray-800' },
    medium: { text: 'Medium Priority', color: 'text-yellow-400 bg-yellow-900' },
    high: { text: 'High Priority', color: 'text-red-400 bg-red-900' },
  };

  return (
    <div className={`p-6 rounded-xl border-2 ${priorityColors[priority]} hover:border-opacity-80 transition-all`}>
      <div className="flex items-start">
        <div className="text-3xl mr-4 mt-1">{icon}</div>
        <div className="flex-1">
          <div className="flex items-start justify-between mb-2">
            <h4 className="font-semibold text-white text-lg">{title}</h4>
            <span className={`text-xs px-2 py-1 rounded-full ${priorityBadges[priority].color} bg-opacity-30`}>
              {priorityBadges[priority].text}
            </span>
          </div>
          <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
        </div>
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

function calculateTierDistribution(tierStats: TierBonusStats | null) {
  if (!tierStats || !tierStats.bonusesByTier) {
    return [
      { name: 'Bronze', percentage: 0, count: 0, color: 'orange' },
      { name: 'Silver', percentage: 0, count: 0, color: 'gray' },
      { name: 'Gold', percentage: 0, count: 0, color: 'yellow' },
    ];
  }

  const total = Object.values(tierStats.bonusesByTier).reduce((sum, tier) => sum + tier.count, 0);
  
  return ['BRONZE', 'SILVER', 'GOLD'].map(tier => {
    const tierData = tierStats.bonusesByTier[tier] || { count: 0 };
    const percentage = total > 0 ? (tierData.count / total) * 100 : 0;
    
    return {
      name: tier.charAt(0) + tier.slice(1).toLowerCase(),
      percentage,
      count: tierData.count,
      color: tier === 'BRONZE' ? 'orange' : tier === 'SILVER' ? 'gray' : 'yellow',
    };
  });
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