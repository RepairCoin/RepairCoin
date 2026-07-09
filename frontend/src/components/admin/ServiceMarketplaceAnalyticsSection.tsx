// frontend/src/components/admin/ServiceMarketplaceAnalyticsSection.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { serviceAnalyticsApi, PlatformAnalyticsSummary, MarketplaceHealthScore } from '@/services/api/serviceAnalytics';
import { getCategoryLabel } from '@/services/api/services';
import { Loader2, TrendingUp, DollarSign, Package, Store, Activity, RefreshCw, Trophy } from 'lucide-react';
import { DashboardHeader } from '@/components/ui/DashboardHeader';

const usd = (n: number | undefined) =>
  `$${(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ServiceMarketplaceAnalyticsSection() {
  const [analytics, setAnalytics] = useState<PlatformAnalyticsSummary | null>(null);
  const [healthScore, setHealthScore] = useState<MarketplaceHealthScore | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      // apiClient sends the auth cookie automatically.
      const [data, health] = await Promise.all([
        serviceAnalyticsApi.getPlatformAnalytics({ topShopsLimit: 5, trendDays: 30 }),
        serviceAnalyticsApi.getMarketplaceHealthScore(),
      ]);
      setAnalytics(data);
      setHealthScore(health);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // Health score accent for the dark theme.
  const healthAccent = (score: number) => {
    if (score >= 80) return { text: 'text-emerald-400', ring: 'border-emerald-500/40', bg: 'bg-emerald-500/10' };
    if (score >= 60) return { text: 'text-blue-400', ring: 'border-blue-500/40', bg: 'bg-blue-500/10' };
    if (score >= 40) return { text: 'text-yellow-400', ring: 'border-yellow-500/40', bg: 'bg-yellow-500/10' };
    return { text: 'text-red-400', ring: 'border-red-500/40', bg: 'bg-red-500/10' };
  };

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Marketplace Analytics"
        subtitle="Service-marketplace health, revenue, top shops and categories"
        icon={Activity}
        gradientFrom="from-blue-500"
        gradientTo="to-indigo-600"
        actions={
          <button
            onClick={loadAnalytics}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      ) : !analytics || !healthScore ? (
        <div className="text-center py-16">
          <p className="text-gray-500 mb-4">Failed to load marketplace analytics.</p>
          <button
            onClick={loadAnalytics}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
          >
            Retry
          </button>
        </div>
      ) : (
        <MarketplaceBody analytics={analytics} healthScore={healthScore} healthAccent={healthAccent} />
      )}
    </div>
  );
}

function MarketplaceBody({
  analytics,
  healthScore,
  healthAccent,
}: {
  analytics: PlatformAnalyticsSummary;
  healthScore: MarketplaceHealthScore;
  healthAccent: (score: number) => { text: string; ring: string; bg: string };
}) {
  const { overview, topShops } = analytics;
  const acc = healthAccent(healthScore.score);

  return (
    <>
      {/* Health score */}
      <div className={`rounded-2xl border p-5 ${acc.ring} ${acc.bg}`}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">Marketplace Health Score</p>
            <p className={`text-4xl font-bold ${acc.text}`}>
              {healthScore.score}
              <span className="text-gray-500 text-2xl">/100</span>
            </p>
            <p className="text-sm text-gray-300 mt-1">{healthScore.interpretation}</p>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <HealthMetric label="Shop Adoption" value={`${healthScore.metrics.shopAdoptionRate}%`} />
            <HealthMetric label="Avg Services/Shop" value={`${healthScore.metrics.avgServicesPerShop}`} />
            <HealthMetric label="Order Conversion" value={`${healthScore.metrics.orderConversionRate}%`} />
            <HealthMetric label="Satisfaction" value={`${healthScore.metrics.customerSatisfaction}%`} />
          </div>
        </div>
      </div>

      {/* Platform metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric icon={Store} label="Active Shops" value={`${overview.totalShopsWithServices}`} hint={`${overview.totalActiveServices} active services`} accent="text-white" />
        <Metric icon={DollarSign} label="Total Revenue" value={usd(overview.totalRevenue)} hint={`from ${overview.totalOrders} orders`} accent="text-emerald-400" />
        <Metric icon={TrendingUp} label="Avg Order Value" value={usd(overview.averageOrderValue)} hint={`avg service ${usd(overview.averageServicePrice)}`} accent="text-blue-400" />
        <Metric icon={Package} label="RCN Redeemed" value={`${(overview.totalRcnRedeemed ?? 0).toLocaleString()} RCN`} hint={`${usd(overview.totalRcnDiscountUsd)} in discounts`} accent="text-yellow-400" />
      </div>

      {/* Top shops */}
      <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-5">
        <h3 className="flex items-center gap-2 text-white font-semibold mb-1">
          <Trophy className="w-5 h-5 text-[#FFCC00]" />
          Top Performing Shops
        </h3>
        <p className="text-xs text-gray-500 mb-4">Highest service-marketplace revenue</p>
        {topShops.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No shops yet.</p>
        ) : (
          <div className="space-y-2">
            {topShops.map((shop, index) => (
              <div key={shop.shopId} className="flex items-center gap-3 p-3 rounded-xl bg-[#101010] border border-gray-800/60">
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-500/15 text-blue-400 text-sm font-bold flex-shrink-0">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-white font-medium truncate">{shop.shopName}</p>
                  <p className="text-gray-500 text-xs">{shop.activeServices} active services</p>
                </div>
                <div className="grid grid-cols-3 gap-5 text-center text-sm shrink-0">
                  <div>
                    <p className="text-gray-500 text-xs">Orders</p>
                    <p className="text-gray-200 font-medium">{shop.totalOrders}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Revenue</p>
                    <p className="text-emerald-400 font-medium">{usd(shop.totalRevenue)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 text-xs">Rating</p>
                    <p className="text-gray-200 font-medium">{shop.averageRating.toFixed(1)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top categories */}
      <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-5">
        <h3 className="text-white font-semibold mb-1">Top Categories</h3>
        <p className="text-xs text-gray-500 mb-4">Most popular service categories by revenue</p>
        {overview.topCategories.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No category data yet.</p>
        ) : (
          <div className="space-y-2">
            {overview.topCategories.map((category) => (
              <div key={category.category} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#101010] border border-gray-800/60">
                <div className="min-w-0 flex-1">
                  <p className="text-white font-medium truncate">{getCategoryLabel(category.category)}</p>
                  <p className="text-gray-500 text-xs">
                    {category.serviceCount} services · {category.totalOrders} orders
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-emerald-400 font-medium">{usd(category.totalRevenue)}</p>
                  <p className="text-gray-500 text-xs">avg {usd(category.averagePrice)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

const HealthMetric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p className="text-gray-400 text-xs">{label}</p>
    <p className="text-white font-semibold">{value}</p>
  </div>
);

const Metric: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
  accent: string;
}> = ({ icon: Icon, label, value, hint, accent }) => (
  <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-4">
    <div className="flex items-center justify-between mb-2">
      <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
      <Icon className="w-4 h-4 text-gray-600" />
    </div>
    <p className={`text-2xl font-bold ${accent}`}>{value}</p>
    <p className="text-[11px] text-gray-500 mt-0.5">{hint}</p>
  </div>
);
