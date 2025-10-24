"use client";

import { useState, useEffect } from 'react';
import { useAdminDashboard } from '@/hooks/useAdminDashboard';
import { 
  getTokenCirculationMetrics, 
  getShopPerformanceRankings, 
  getAdminAlerts,
  markAlertAsRead,
  resolveAlert,
  runMonitoringChecks
} from '@/services/api/admin';
import { toast } from 'react-hot-toast';
import { WorkingChart, WorkingLineChart, WorkingPieChart } from '@/components/admin/charts/WorkingChart';

interface TokenCirculationMetrics {
  totalSupply: number;
  totalInCirculation: number;
  totalRedeemed: number;
  shopBalances: Array<{
    shopId: string;
    shopName: string;
    balance: number;
    tokensIssued: number;
    redemptionsProcessed: number;
  }>;
  customerBalances: {
    totalCustomerBalance: number;
    averageBalance: number;
    activeCustomers: number;
  };
  dailyActivity: Array<{
    date: string;
    minted: number;
    redeemed: number;
    netFlow: number;
  }>;
}

interface ShopPerformanceRanking {
  shopId: string;
  shopName: string;
  tokensIssued: number;
  redemptionsProcessed: number;
  activeCustomers: number;
  averageTransactionValue: number;
  customerRetention: number;
  performanceScore: number;
  lastActivity: string;
  tier: 'Standard' | 'Premium' | 'Elite';
}

interface Alert {
  id: number;
  alertType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  metadata?: any;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  createdAt: string;
}

export function AnalyticsTab() {
  const { generateAdminToken, setError: onError } = useAdminDashboard();
  const [tokenMetrics, setTokenMetrics] = useState<TokenCirculationMetrics | null>(null);
  const [shopRankings, setShopRankings] = useState<ShopPerformanceRanking[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertsTotal, setAlertsTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [monitoringLoading, setMonitoringLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'circulation' | 'rankings' | 'alerts'>('overview');

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadTokenCirculationMetrics(),
        loadShopPerformanceRankings(),
        loadAlerts()
      ]);
    } catch (error) {
      console.error('Error loading analytics data:', error);
      onError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const loadTokenCirculationMetrics = async () => {
    try {
      const data = await getTokenCirculationMetrics();
      if (data) {
        setTokenMetrics(data);
      }
    } catch (error) {
      console.error('Error loading token circulation metrics:', error);
    }
  };

  const loadShopPerformanceRankings = async () => {
    try {
      const data = await getShopPerformanceRankings(10);
      if (data) {
        setShopRankings(data);
      }
    } catch (error) {
      console.error('Error loading shop performance rankings:', error);
    }
  };

  const loadAlerts = async () => {
    try {
      setAlertsLoading(true);
      const data = await getAdminAlerts({ limit: 20, offset: 0 });
      if (data) {
        setAlerts(data.alerts);
        setAlertsTotal(data.total);
      }
    } catch (error) {
      console.error('Error loading alerts:', error);
    } finally {
      setAlertsLoading(false);
    }
  };

  const handleMarkAlertAsRead = async (alertId: number) => {
    try {
      const success = await markAlertAsRead(alertId);
      if (success) {
        setAlerts(prev => prev.map(alert => 
          alert.id === alertId 
            ? { ...alert, acknowledged: true, acknowledgedAt: new Date().toISOString() }
            : alert
        ));
        toast.success('Alert marked as read');
      } else {
        toast.error('Failed to mark alert as read');
      }
    } catch (error) {
      console.error('Error marking alert as read:', error);
      toast.error('Failed to mark alert as read');
    }
  };

  const handleResolveAlert = async (alertId: number) => {
    try {
      const success = await resolveAlert(alertId);
      if (success) {
        setAlerts(prev => prev.filter(alert => alert.id !== alertId));
        toast.success('Alert resolved');
      } else {
        toast.error('Failed to resolve alert');
      }
    } catch (error) {
      console.error('Error resolving alert:', error);
      toast.error('Failed to resolve alert');
    }
  };

  const handleRunMonitoringChecks = async () => {
    try {
      setMonitoringLoading(true);
      const success = await runMonitoringChecks();
      if (success) {
        toast.success('Monitoring checks completed');
        // Reload alerts to see any new ones created
        await loadAlerts();
      } else {
        toast.error('Failed to run monitoring checks');
      }
    } catch (error) {
      console.error('Error running monitoring checks:', error);
      toast.error('Failed to run monitoring checks');
    } finally {
      setMonitoringLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Elite': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'Premium': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'Standard': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="bg-[#212121] rounded-2xl shadow-xl p-8 border border-[#FFCC00]/20">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFCC00]"></div>
          <p className="mt-4 text-[#FFCC00]/70">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Navigation Tabs */}
      <div className="bg-[#212121] rounded-2xl shadow-xl border border-[#FFCC00]/20">
        <div className="px-6 py-4 border-b border-[#FFCC00]/20">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-[#FFCC00]">Advanced Analytics</h1>
            <button
              onClick={handleRunMonitoringChecks}
              disabled={monitoringLoading}
              className="px-4 py-2 bg-[#FFCC00] text-[#0D0D0D] rounded-lg hover:bg-[#FFCC00]/90 disabled:opacity-50 flex items-center gap-2 font-bold"
            >
              {monitoringLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                '🔍'
              )}
              Run Monitoring Checks
            </button>
          </div>
          <div className="flex gap-4 mt-4">
            {[
              { id: 'overview', label: 'Overview', icon: '📊' },
              { id: 'circulation', label: 'Token Circulation', icon: '🪙' },
              { id: 'rankings', label: 'Shop Rankings', icon: '🏆' },
              { id: 'alerts', label: 'Alerts', icon: '🚨', badge: alerts.filter(a => !a.acknowledged).length }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
                  activeTab === tab.id
                    ? 'bg-[#FFCC00] text-[#0D0D0D] font-bold'
                    : 'text-[#FFCC00]/70 hover:bg-[#FFCC00]/10 hover:text-[#FFCC00]'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
                {tab.badge > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-[#212121] rounded-2xl shadow-xl p-6 border border-[#FFCC00]/20 hover:border-[#FFCC00]/40 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#FFCC00]/70">Total Supply</p>
                  <p className="text-3xl font-bold text-[#FFCC00]">
                    {tokenMetrics?.totalSupply?.toLocaleString() || 0}
                  </p>
                  <p className="text-xs text-[#FFCC00]/60 mt-1">RCN tokens</p>
                </div>
                <div className="text-3xl">🪙</div>
              </div>
            </div>

            <div className="bg-[#212121] rounded-2xl shadow-xl p-6 border border-[#22C55E]/20 hover:border-[#22C55E]/40 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#22C55E]/70">In Circulation</p>
                  <p className="text-3xl font-bold text-[#22C55E]">
                    {tokenMetrics?.totalInCirculation?.toLocaleString() || 0}
                  </p>
                  <p className="text-xs text-[#22C55E]/60 mt-1">Active tokens</p>
                </div>
                <div className="text-3xl">🔄</div>
              </div>
            </div>

            <div className="bg-[#212121] rounded-2xl shadow-xl p-6 border border-[#A855F7]/20 hover:border-[#A855F7]/40 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#A855F7]/70">Active Customers</p>
                  <p className="text-3xl font-bold text-[#A855F7]">
                    {tokenMetrics?.customerBalances?.activeCustomers?.toLocaleString() || 0}
                  </p>
                  <p className="text-xs text-[#A855F7]/60 mt-1">With tokens</p>
                </div>
                <div className="text-3xl">👥</div>
              </div>
            </div>

            <div className="bg-[#212121] rounded-2xl shadow-xl p-6 border border-[#FB923C]/20 hover:border-[#FB923C]/40 transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#FB923C]/70">Active Shops</p>
                  <p className="text-3xl font-bold text-[#FB923C]">
                    {tokenMetrics?.shopBalances?.length || 0}
                  </p>
                  <p className="text-xs text-[#FB923C]/60 mt-1">Issuing tokens</p>
                </div>
                <div className="text-3xl">🏪</div>
              </div>
            </div>
          </div>

          {/* Row 1: Daily Activity Chart */}
          {tokenMetrics?.dailyActivity && tokenMetrics.dailyActivity.length > 0 && (
            <WorkingLineChart
              data={tokenMetrics.dailyActivity.map(day => ({
                date: day.date,
                value: day.minted,
                value2: day.redeemed
              }))}
              title="Daily Token Activity (Last 30 Days)"
              lines={[
                { key: 'value', color: '#22C55E', label: 'Tokens Issued' },
                { key: 'value2', color: '#EF4444', label: 'Tokens Redeemed' }
              ]}
              formatValue={(value) => `${value.toLocaleString()} RCN`}
              height={300}
            />
          )}

          {/* Row 2: Top Shops by Tokens Issued */}
          {tokenMetrics && (
            <WorkingChart
              data={tokenMetrics.shopBalances.slice(0, 10).map(shop => ({
                date: shop.shopName,
                value: shop.tokensIssued,
                label: shop.shopName
              }))}
              title="Top Shops by Tokens Issued"
              color="#FFCC00"
              formatValue={(value) => `${value.toLocaleString()} RCN`}
              height={300}
              type="bar"
            />
          )}

          {/* Recent Alerts */}
          <div className="bg-[#212121] rounded-2xl shadow-xl border border-[#FFCC00]/20 hover:border-[#FFCC00]/40 transition-all duration-300">
            <div className="px-6 py-4 border-b border-[#FFCC00]/20">
              <h2 className="text-xl font-bold text-[#FFCC00]">Recent Alerts</h2>
            </div>
            <div className="p-6">
              {alerts.slice(0, 5).map((alert) => (
                <div key={alert.id} className={`p-4 rounded-lg border mb-3 bg-gradient-to-r from-[#0D0D0D] to-[#212121] border-[#FFCC00]/30 hover:border-[#FFCC00]/50 transition-all duration-200`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-[#FFCC00]">{alert.title}</h3>
                      <p className="text-sm text-[#FFCC00]/70">{alert.message}</p>
                      <p className="text-xs text-[#FFCC00]/50 mt-1">
                        {new Date(alert.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {!alert.acknowledged && (
                        <button
                          onClick={() => handleMarkAlertAsRead(alert.id)}
                          className="px-3 py-1 bg-[#FFCC00]/20 hover:bg-[#FFCC00]/30 text-[#FFCC00] rounded text-xs border border-[#FFCC00]/40 transition-all"
                        >
                          Mark Read
                        </button>
                      )}
                      <button
                        onClick={() => handleResolveAlert(alert.id)}
                        className="px-3 py-1 bg-[#FFCC00] hover:bg-[#FFCC00]/90 text-[#0D0D0D] rounded text-xs font-bold transition-all"
                      >
                        Resolve
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Token Circulation Tab */}
      {activeTab === 'circulation' && tokenMetrics && (
        <div className="space-y-6">
          {/* Supply Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#212121] rounded-2xl shadow-xl p-6 border border-[#FFCC00]/20">
              <h3 className="text-lg font-semibold text-[#FFCC00] mb-4">Supply Overview</h3>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-[#FFCC00]/70">Total Supply:</span>
                  <span className="font-semibold text-[#FFCC00]">{tokenMetrics.totalSupply.toLocaleString()} RCN</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#FFCC00]/70">In Circulation:</span>
                  <span className="font-semibold text-[#22C55E]">{tokenMetrics.totalInCirculation.toLocaleString()} RCN</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#FFCC00]/70">Total Redeemed:</span>
                  <span className="font-semibold text-[#4F9EF8]">{tokenMetrics.totalRedeemed.toLocaleString()} RCN</span>
                </div>
              </div>
            </div>

            <div className="bg-[#212121] rounded-2xl shadow-xl p-6 border border-[#22C55E]/20">
              <h3 className="text-lg font-semibold text-[#22C55E] mb-4">Customer Analytics</h3>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-[#22C55E]/70">Active Customers:</span>
                  <span className="font-semibold text-[#22C55E]">{tokenMetrics.customerBalances.activeCustomers.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#22C55E]/70">Total Balance:</span>
                  <span className="font-semibold text-[#22C55E]">{tokenMetrics.customerBalances.totalCustomerBalance.toLocaleString()} RCN</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#22C55E]/70">Average Balance:</span>
                  <span className="font-semibold text-[#22C55E]">{tokenMetrics.customerBalances.averageBalance.toFixed(2)} RCN</span>
                </div>
              </div>
            </div>

            <div className="bg-[#212121] rounded-2xl shadow-xl p-6 border border-[#A855F7]/20">
              <h3 className="text-lg font-semibold text-[#A855F7] mb-4">Recent Activity</h3>
              <div className="space-y-2">
                {tokenMetrics.dailyActivity.slice(0, 5).map((day, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-[#A855F7]/70">{new Date(day.date).toLocaleDateString()}:</span>
                    <span className={`font-semibold ${day.netFlow >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                      {day.netFlow >= 0 ? '+' : ''}{day.netFlow.toFixed(0)} RCN
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Shops by Balance */}
          <div className="bg-[#212121] rounded-2xl shadow-xl border border-[#FFCC00]/20">
            <div className="px-6 py-4 border-b border-[#FFCC00]/20">
              <h2 className="text-xl font-bold text-[#FFCC00]">Shop Token Balances</h2>
            </div>
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#FFCC00]/20">
                      <th className="text-left py-3 font-semibold text-[#FFCC00]/70">Shop</th>
                      <th className="text-right py-3 font-semibold text-[#FFCC00]/70">Current Balance</th>
                      <th className="text-right py-3 font-semibold text-[#FFCC00]/70">Tokens Issued</th>
                      <th className="text-right py-3 font-semibold text-[#FFCC00]/70">Redemptions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tokenMetrics.shopBalances.slice(0, 10).map((shop, index) => (
                      <tr key={shop.shopId} className="border-b border-[#FFCC00]/10 hover:bg-[#FFCC00]/5 transition-all">
                        <td className="py-3">
                          <div>
                            <div className="font-medium text-[#FFCC00]">{shop.shopName}</div>
                            <div className="text-sm text-[#FFCC00]/50">{shop.shopId}</div>
                          </div>
                        </td>
                        <td className="text-right py-3 font-semibold text-[#22C55E]">{shop.balance.toLocaleString()} RCN</td>
                        <td className="text-right py-3 text-[#4F9EF8]">{shop.tokensIssued.toLocaleString()} RCN</td>
                        <td className="text-right py-3 text-[#A855F7]">{shop.redemptionsProcessed.toLocaleString()} RCN</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shop Rankings Tab */}
      {activeTab === 'rankings' && (
        <div className="space-y-6">
          {/* Row 1: Performance Score Distribution */}
          <WorkingChart
            data={shopRankings.map(shop => ({
              date: shop.shopName,
              value: shop.performanceScore,
              label: shop.shopName
            }))}
            title="Performance Score Distribution"
            color="#FFCC00"
            formatValue={(value) => `${value.toFixed(1)} pts`}
            height={300}
          />
          
          {/* Row 2: Shop Tier Distribution */}
          <WorkingPieChart
            data={[
              { 
                label: 'Elite Tier', 
                value: shopRankings.filter(s => s.tier === 'Elite').length, 
                color: '#8B5CF6' 
              },
              { 
                label: 'Premium Tier', 
                value: shopRankings.filter(s => s.tier === 'Premium').length, 
                color: '#3B82F6' 
              },
              { 
                label: 'Standard Tier', 
                value: shopRankings.filter(s => s.tier === 'Standard').length, 
                color: '#10B981' 
              }
            ]}
            title="Shop Tier Distribution"
            formatValue={(value) => `${value} shops`}
            size={300}
          />
          
          {/* Row 3: Customer Retention */}
          <WorkingChart
            data={shopRankings.slice(0, 10).map(shop => ({
              date: shop.shopName,
              value: shop.customerRetention,
              label: shop.shopName
            }))}
            title="Customer Retention by Shop (Top 10)"
            color="#A855F7"
            formatValue={(value) => `${value.toFixed(1)}%`}
            height={300}
          />
          
          {/* Row 4: Average Transaction Value */}
          <WorkingChart
            data={shopRankings.slice(0, 10).map(shop => ({
              date: shop.shopName,
              value: shop.averageTransactionValue,
              label: shop.shopName
            }))}
            title="Average Transaction Value by Shop (Top 10)"
            color="#FB923C"
            formatValue={(value) => `${value.toFixed(2)} RCN`}
            height={300}
          />
        </div>
      )}

      {/* Alerts Tab */}
      {activeTab === 'alerts' && (
        <div className="bg-[#212121] rounded-2xl shadow-xl border border-[#FFCC00]/20">
          <div className="px-6 py-4 border-b border-[#FFCC00]/20">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-[#FFCC00]">System Alerts</h2>
                <p className="text-[#FFCC00]/70 mt-1">Total: {alertsTotal} alerts</p>
              </div>
              <button
                onClick={loadAlerts}
                disabled={alertsLoading}
                className="px-4 py-2 bg-[#FFCC00] text-[#0D0D0D] rounded-lg hover:bg-[#FFCC00]/90 disabled:opacity-50 font-bold"
              >
                {alertsLoading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {alerts.map((alert) => (
                <div key={alert.id} className={`p-4 rounded-lg border ${getSeverityColor(alert.severity)}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{alert.title}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getSeverityColor(alert.severity)}`}>
                          {alert.severity.toUpperCase()}
                        </span>
                        {alert.acknowledged && (
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                            READ
                          </span>
                        )}
                      </div>
                      <p className="text-sm opacity-85 mb-2">{alert.message}</p>
                      <div className="text-xs opacity-70 space-y-1">
                        <p>Type: {alert.alertType}</p>
                        <p>Created: {new Date(alert.createdAt).toLocaleString()}</p>
                        {alert.acknowledgedAt && (
                          <p>Read: {new Date(alert.acknowledgedAt).toLocaleString()} by {alert.acknowledgedBy}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      {!alert.acknowledged && (
                        <button
                          onClick={() => handleMarkAlertAsRead(alert.id)}
                          className="px-3 py-1 bg-white bg-opacity-50 rounded text-xs hover:bg-opacity-75"
                        >
                          Mark Read
                        </button>
                      )}
                      <button
                        onClick={() => handleResolveAlert(alert.id)}
                        className="px-3 py-1 bg-white bg-opacity-50 rounded text-xs hover:bg-opacity-75"
                      >
                        Resolve
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}