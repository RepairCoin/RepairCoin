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
    <div className="space-y-8">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Revenue"
          value={`$${totalRevenue.toFixed(2)}`}
          subtitle="From RCN purchases"
          trend={`${revenueGrowth >= 0 ? '+' : ''}${revenueGrowth.toFixed(1)}%`}
          trendUp={revenueGrowth >= 0}
        />
        <MetricCard
          title="Average Purchase"
          value={`${averagePurchaseSize.toFixed(0)} RCN`}
          subtitle="Per transaction"
          trend={`${avgPurchaseGrowth >= 0 ? '+' : ''}${avgPurchaseGrowth.toFixed(1)}%`}
          trendUp={avgPurchaseGrowth >= 0}
        />
        <MetricCard
          title="Success Rate"
          value={`${successRate.toFixed(1)}%`}
          subtitle="Payment completion"
          trend={successRate === 100 ? '100%' : `${successRate > 95 ? '+' : '-'}${(100 - successRate).toFixed(1)}%`}
          trendUp={successRate > 95}
        />
        <MetricCard
          title="Token Efficiency"
          value={`${efficiencyRatio.toFixed(1)}%`}
          subtitle="Tokens issued vs purchased"
          trend={efficiencyRatio > 80 ? 'Optimal' : 'Good'}
          trendUp={efficiencyRatio > 50}
        />
      </div>

      {/* Monthly Performance Chart */}
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <h3 className="text-2xl font-bold text-gray-900 mb-6">Monthly Performance</h3>
        {monthlyData.some(m => m.revenue > 0) ? (
          <div className="space-y-4">
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
            <div className="text-4xl mb-4">📊</div>
            <p className="text-gray-500">No purchase data yet</p>
            <p className="text-sm text-gray-400 mt-2">Start purchasing RCN to see your performance metrics</p>
          </div>
        )}
      </div>

      {/* Customer Engagement */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tier Distribution */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Customer Tier Distribution</h3>
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
          </div>
        </div>

        {/* Token Flow */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Token Flow Analysis</h3>
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
            <div className="pt-4 border-t border-gray-200">
              <FlowItem
                label="Current Balance"
                value={shopData?.purchasedRcnBalance || 0}
                type="balance"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Insights and Recommendations */}
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <h3 className="text-2xl font-bold text-gray-900 mb-6">Insights & Recommendations</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <InsightCard
            icon="💡"
            title="Balance Optimization"
            description={`Your current RCN balance can cover approximately ${bonusesRemaining} more tier bonuses. ${
              bonusesRemaining < 50 ? 'Consider purchasing more RCN to maintain smooth operations.' : 
              'Your balance is healthy for current operations.'
            }`}
            priority={bonusesRemaining < 50 ? "high" : "low"}
          />
          <InsightCard
            icon="📈"
            title="Customer Tier Analysis"
            description={`${
              tierDistribution[2]?.percentage > 15 ? 
                `Gold tier customers represent ${tierDistribution[2].percentage.toFixed(0)}% of your base. Excellent retention!` :
                `Focus on upgrading customers to higher tiers. Currently ${tierDistribution[0].percentage.toFixed(0)}% are Bronze tier.`
            }`}
            priority={tierDistribution[2]?.percentage > 15 ? "low" : "medium"}
          />
          <InsightCard
            icon="🎯"
            title="Token Efficiency"
            description={`You're issuing ${efficiencyRatio.toFixed(0)}% of purchased tokens. ${
              efficiencyRatio > 80 ? 'This shows excellent customer engagement!' :
              efficiencyRatio > 50 ? 'Good balance between rewards and reserves.' :
              'Consider increasing customer engagement activities.'
            }`}
            priority={efficiencyRatio > 80 ? "low" : efficiencyRatio > 50 ? "medium" : "high"}
          />
          <InsightCard
            icon="🔄"
            title="Purchase Performance"
            description={`Average purchase size is ${averagePurchaseSize.toFixed(0)} RCN with ${successRate.toFixed(0)}% success rate. ${
              completedPurchases.length > 0 ? 
                `Last purchase: ${new Date(completedPurchases[completedPurchases.length - 1].createdAt).toLocaleDateString()}.` :
                'No purchases recorded yet.'
            }`}
            priority={completedPurchases.length === 0 ? "high" : "medium"}
          />
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
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, subtitle, trend, trendUp }) => {
  return (
    <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
      <div className="flex items-center justify-between mt-4">
        <p className="text-xs text-gray-400">{subtitle}</p>
        <span className={`text-sm font-medium ${trendUp ? 'text-green-600' : 'text-red-600'}`}>
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
        <span className="text-sm font-medium text-gray-700">{month}</span>
        <div className="text-right">
          <span className="text-sm font-semibold text-gray-900">${revenue.toFixed(0)}</span>
          <span className="text-xs text-gray-500 ml-2">({purchases} purchases)</span>
        </div>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all duration-500"
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
    orange: 'from-orange-400 to-orange-600',
    gray: 'from-gray-400 to-gray-600',
    yellow: 'from-yellow-400 to-yellow-600',
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-700">{tier}</span>
        <div className="text-right">
          <span className="text-sm font-semibold text-gray-900">{percentage.toFixed(1)}%</span>
          <span className="text-xs text-gray-500 ml-2">({count} customers)</span>
        </div>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
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
    in: 'text-green-600',
    out: 'text-red-600',
    balance: 'text-blue-600',
  };

  const icons = {
    in: '↓',
    out: '↑',
    balance: '=',
  };

  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-600">{label}</span>
      <div className="flex items-center">
        <span className={`${colors[type]} text-lg mr-2`}>{icons[type]}</span>
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
    low: 'border-gray-200 bg-gray-50',
    medium: 'border-yellow-200 bg-yellow-50',
    high: 'border-green-200 bg-green-50',
  };

  return (
    <div className={`p-6 rounded-xl border ${priorityColors[priority]}`}>
      <div className="flex items-start">
        <span className="text-2xl mr-3">{icon}</span>
        <div>
          <h4 className="font-semibold text-gray-900 mb-2">{title}</h4>
          <p className="text-sm text-gray-600">{description}</p>
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