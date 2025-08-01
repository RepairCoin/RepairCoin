import { useState, useEffect } from 'react';

interface Analytics {
  tokensInCirculation?: number;
  velocityRate?: number;
  avgHoldTime?: number;
  activeWallets?: number;
  topShopsByRevenue?: Array<{
    shopId: string;
    name: string;
    revenue: number;
  }>;
}

interface ShopRanking {
  shop_id: string;
  shop_name: string;
  total_tokens_issued?: number;
  unique_customers?: number;
}

interface AnalyticsTabProps {
  generateAdminToken: () => Promise<string | null>;
  onError: (error: string) => void;
}

export function AnalyticsTab({ generateAdminToken, onError }: AnalyticsTabProps) {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [shopRankings, setShopRankings] = useState<ShopRanking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const adminToken = await generateAdminToken();
      if (!adminToken) {
        onError('Authentication required');
        return;
      }

      const headers = {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      };

      // Load analytics data
      try {
        const analyticsResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/analytics`, { headers });
        if (analyticsResponse.ok) {
          const analyticsData = await analyticsResponse.json();
          setAnalytics(analyticsData.data || analyticsData);
        } else {
          console.warn('Analytics API failed:', await analyticsResponse.text());
        }
      } catch (err) {
        console.warn('Analytics API error:', err);
      }

      // Load shop rankings
      try {
        const rankingsResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/analytics/shop-rankings`, { headers });
        if (rankingsResponse.ok) {
          const rankingsData = await rankingsResponse.json();
          setShopRankings(rankingsData.data || rankingsData.rankings || []);
        } else {
          console.warn('Shop rankings API failed:', await rankingsResponse.text());
        }
      } catch (err) {
        console.warn('Shop rankings API error:', err);
      }

    } catch (error) {
      console.error('Error loading analytics:', error);
      onError('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Token Circulation Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Tokens in Circulation</p>
              <p className="text-3xl font-bold text-blue-600">{(analytics?.tokensInCirculation || 0).toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">RCN in customer wallets</p>
            </div>
            <div className="text-3xl">🪙</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Velocity Rate</p>
              <p className="text-3xl font-bold text-green-600">{(analytics?.velocityRate || 0).toFixed(2)}x</p>
              <p className="text-xs text-gray-500 mt-1">Last 30 days</p>
            </div>
            <div className="text-3xl">⚡</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Average Hold Time</p>
              <p className="text-3xl font-bold text-purple-600">{analytics?.avgHoldTime || 0}</p>
              <p className="text-xs text-gray-500 mt-1">Days per token</p>
            </div>
            <div className="text-3xl">⏱️</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Active Wallets</p>
              <p className="text-3xl font-bold text-orange-600">{(analytics?.activeWallets || 0).toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-1">Last 30 days</p>
            </div>
            <div className="text-3xl">💳</div>
          </div>
        </div>
      </div>

      {/* Shop Performance Rankings */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Shop Performance Rankings</h2>
          <p className="text-gray-600 mt-1">Top performing shops by various metrics</p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Top by Token Issuance */}
            <div>
              <h3 className="font-bold text-gray-900 mb-4">🏆 Top Token Issuers</h3>
              <div className="space-y-3">
                {shopRankings.length > 0 ? (
                  shopRankings.slice(0, 5).map((shop, index) => (
                    <div key={shop.shop_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-gray-400">#{index + 1}</span>
                        <div>
                          <p className="font-medium text-gray-900">{shop.shop_name}</p>
                          <p className="text-xs text-gray-500">{shop.shop_id}</p>
                        </div>
                      </div>
                      <p className="font-bold text-blue-600">{shop.total_tokens_issued?.toLocaleString() || 0} RCN</p>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4">No shop data available</p>
                )}
              </div>
            </div>

            {/* Top by Customer Count */}
            <div>
              <h3 className="font-bold text-gray-900 mb-4">👥 Most Customers</h3>
              <div className="space-y-3">
                {shopRankings.length > 0 ? (
                  shopRankings
                    .sort((a, b) => (b.unique_customers || 0) - (a.unique_customers || 0))
                    .slice(0, 5)
                    .map((shop, index) => (
                      <div key={shop.shop_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-gray-400">#{index + 1}</span>
                          <div>
                            <p className="font-medium text-gray-900">{shop.shop_name}</p>
                            <p className="text-xs text-gray-500">{shop.shop_id}</p>
                          </div>
                        </div>
                        <p className="font-bold text-green-600">{shop.unique_customers?.toLocaleString() || 0}</p>
                      </div>
                    ))
                ) : (
                  <p className="text-gray-500 text-center py-4">No shop data available</p>
                )}
              </div>
            </div>

            {/* Top by Revenue */}
            <div>
              <h3 className="font-bold text-gray-900 mb-4">💰 Highest Revenue</h3>
              <div className="space-y-3">
                {(analytics?.topShopsByRevenue || []).slice(0, 5).map((shop, index) => (
                  <div key={shop.shopId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-gray-400">#{index + 1}</span>
                      <div>
                        <p className="font-medium text-gray-900">{shop.name}</p>
                        <p className="text-xs text-gray-500">{shop.shopId}</p>
                      </div>
                    </div>
                    <p className="font-bold text-purple-600">${shop.revenue.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Token Flow Chart Placeholder */}
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Token Flow Analysis</h2>
        <div className="bg-gray-50 rounded-xl p-12 text-center">
          <div className="text-6xl mb-4">📊</div>
          <p className="text-gray-600">Token flow visualization coming soon</p>
          <p className="text-sm text-gray-500 mt-2">Track RCN movement between shops and customers</p>
        </div>
      </div>
    </div>
  );
}