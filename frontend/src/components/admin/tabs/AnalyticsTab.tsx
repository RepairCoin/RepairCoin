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
import { BarChart3, Coins, Trophy, AlertTriangle, Search, RefreshCcw, Users, Store, TrendingUp, Activity } from 'lucide-react';

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
  const {  setError: onError } = useAdminDashboard();
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
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-800 border-t-white"></div>
          <p className="mt-4 text-gray-400">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Modern Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Analytics
          </h1>
          <p className="text-gray-400 mt-2">Platform insights and performance metrics</p>
        </div>
        <button
          onClick={handleRunMonitoringChecks}
          disabled={monitoringLoading}
          className="group relative px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 transition-all duration-300 shadow-lg hover:shadow-xl flex items-center gap-2 font-medium"
        >
          {monitoringLoading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
          ) : (
            <Activity className="w-5 h-5" />
          )}
          Run Health Check
        </button>
      </div>

      {/* Elegant Tabs */}
      <div className="relative">
        <div className="flex gap-8 border-b border-gray-800">
          {[
            { id: 'overview', label: 'Overview', icon: <BarChart3 className="w-4 h-4" /> },
            { id: 'circulation', label: 'Circulation', icon: <Coins className="w-4 h-4" /> },
            { id: 'rankings', label: 'Rankings', icon: <Trophy className="w-4 h-4" /> },
            { id: 'alerts', label: 'Alerts', icon: <AlertTriangle className="w-4 h-4" />, badge: alerts.filter(a => !a.acknowledged).length }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`group relative pb-4 px-2 flex items-center gap-2 text-sm font-medium transition-all duration-300 ${
                activeTab === tab.id
                  ? 'text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <span className={`transition-all duration-300 ${activeTab === tab.id ? 'text-blue-400' : 'text-gray-600 group-hover:text-gray-400'}`}>
                {tab.icon}
              </span>
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-2 py-0.5 font-semibold">
                  {tab.badge}
                </span>
              )}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500"></div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Beautiful Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Supply Card */}
            <div className="group relative bg-gradient-to-br from-blue-500/10 to-blue-600/5 backdrop-blur-sm rounded-2xl p-6 border border-blue-500/20 hover:border-blue-500/40 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-blue-500/10 rounded-xl">
                  <Coins className="w-6 h-6 text-blue-400" />
                </div>
                <TrendingUp className="w-5 h-5 text-blue-400 opacity-50 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-sm text-gray-400 font-medium mb-1">Total Supply</p>
              <p className="text-3xl font-bold text-white mb-1">
                {tokenMetrics?.totalSupply?.toLocaleString() || 0}
              </p>
              <p className="text-xs text-blue-400">RCN tokens</p>
            </div>

            {/* In Circulation Card */}
            <div className="group relative bg-gradient-to-br from-green-500/10 to-green-600/5 backdrop-blur-sm rounded-2xl p-6 border border-green-500/20 hover:border-green-500/40 transition-all duration-300 hover:shadow-lg hover:shadow-green-500/10">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-green-500/10 rounded-xl">
                  <RefreshCcw className="w-6 h-6 text-green-400" />
                </div>
                <TrendingUp className="w-5 h-5 text-green-400 opacity-50 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-sm text-gray-400 font-medium mb-1">In Circulation</p>
              <p className="text-3xl font-bold text-white mb-1">
                {tokenMetrics?.totalInCirculation?.toLocaleString() || 0}
              </p>
              <p className="text-xs text-green-400">Active tokens</p>
            </div>

            {/* Active Customers Card */}
            <div className="group relative bg-gradient-to-br from-purple-500/10 to-purple-600/5 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20 hover:border-purple-500/40 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-purple-500/10 rounded-xl">
                  <Users className="w-6 h-6 text-purple-400" />
                </div>
                <TrendingUp className="w-5 h-5 text-purple-400 opacity-50 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-sm text-gray-400 font-medium mb-1">Active Customers</p>
              <p className="text-3xl font-bold text-white mb-1">
                {tokenMetrics?.customerBalances?.activeCustomers?.toLocaleString() || 0}
              </p>
              <p className="text-xs text-purple-400">With tokens</p>
            </div>

            {/* Active Shops Card */}
            <div className="group relative bg-gradient-to-br from-orange-500/10 to-orange-600/5 backdrop-blur-sm rounded-2xl p-6 border border-orange-500/20 hover:border-orange-500/40 transition-all duration-300 hover:shadow-lg hover:shadow-orange-500/10">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-orange-500/10 rounded-xl">
                  <Store className="w-6 h-6 text-orange-400" />
                </div>
                <TrendingUp className="w-5 h-5 text-orange-400 opacity-50 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-sm text-gray-400 font-medium mb-1">Active Shops</p>
              <p className="text-3xl font-bold text-white mb-1">
                {tokenMetrics?.shopBalances?.length || 0}
              </p>
              <p className="text-xs text-orange-400">Issuing tokens</p>
            </div>
          </div>

          {/* Charts Section */}
          {tokenMetrics?.dailyActivity && tokenMetrics.dailyActivity.length > 0 && (
            <div className="bg-gradient-to-br from-gray-900/50 to-gray-800/30 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
              <WorkingLineChart
                data={tokenMetrics.dailyActivity.map(day => ({
                  date: day.date,
                  value: day.minted,
                  value2: day.redeemed
                }))}
                title="Daily Token Activity"
                lines={[
                  { key: 'value', color: '#22C55E', label: 'Issued' },
                  { key: 'value2', color: '#EF4444', label: 'Redeemed' }
                ]}
                formatValue={(value) => `${value.toLocaleString()} RCN`}
                height={300}
              />
            </div>
          )}

          {tokenMetrics && (
            <div className="bg-gradient-to-br from-gray-900/50 to-gray-800/30 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
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
            </div>
          )}

          {/* Recent Alerts */}
          {alerts.length > 0 && (
            <div className="bg-gradient-to-br from-gray-900/50 to-gray-800/30 backdrop-blur-sm rounded-2xl border border-gray-700/50 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-700/50">
                <h2 className="text-xl font-semibold text-white">Recent Alerts</h2>
              </div>
              <div className="p-6">
                <div className="space-y-3">
                  {alerts.slice(0, 5).map((alert) => (
                    <div key={alert.id} className="group bg-gray-800/30 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50 hover:border-gray-600/50 transition-all duration-300">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-medium text-white">{alert.title}</h3>
                            <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                              alert.severity === 'critical' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                              alert.severity === 'high' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                              alert.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                              'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            }`}>
                              {alert.severity.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-400 line-clamp-2">{alert.message}</p>
                          <p className="text-xs text-gray-500 mt-2">
                            {new Date(alert.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          {!alert.acknowledged && (
                            <button
                              onClick={() => handleMarkAlertAsRead(alert.id)}
                              className="px-3 py-1.5 bg-gray-700/50 hover:bg-gray-700 text-gray-300 rounded-lg text-xs transition-colors"
                            >
                              Mark Read
                            </button>
                          )}
                          <button
                            onClick={() => handleResolveAlert(alert.id)}
                            className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg text-xs font-medium transition-all"
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
      )}

      {/* Token Circulation Tab */}
      {activeTab === 'circulation' && tokenMetrics && (
        <div className="space-y-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-gray-900/50 to-gray-800/30 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
              <h3 className="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                Supply Overview
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Total Supply</span>
                  <span className="font-semibold text-white">{tokenMetrics.totalSupply.toLocaleString()} RCN</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">In Circulation</span>
                  <span className="font-semibold text-green-400">{tokenMetrics.totalInCirculation.toLocaleString()} RCN</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Total Redeemed</span>
                  <span className="font-semibold text-blue-400">{tokenMetrics.totalRedeemed.toLocaleString()} RCN</span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-gray-900/50 to-gray-800/30 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
              <h3 className="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-400"></div>
                Customer Analytics
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Active Customers</span>
                  <span className="font-semibold text-white">{tokenMetrics.customerBalances.activeCustomers.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Total Balance</span>
                  <span className="font-semibold text-purple-400">{tokenMetrics.customerBalances.totalCustomerBalance.toLocaleString()} RCN</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Avg Balance</span>
                  <span className="font-semibold text-purple-400">{tokenMetrics.customerBalances.averageBalance.toFixed(2)} RCN</span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-gray-900/50 to-gray-800/30 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
              <h3 className="text-sm font-medium text-gray-400 mb-4 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-400"></div>
                Recent Activity
              </h3>
              <div className="space-y-3">
                {tokenMetrics.dailyActivity.slice(0, 5).map((day, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-gray-400">{new Date(day.date).toLocaleDateString()}</span>
                    <span className={`font-semibold ${day.netFlow >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {day.netFlow >= 0 ? '+' : ''}{day.netFlow.toFixed(0)} RCN
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Shop Balances Table */}
          <div className="bg-gradient-to-br from-gray-900/50 to-gray-800/30 backdrop-blur-sm rounded-2xl border border-gray-700/50 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-700/50">
              <h2 className="text-xl font-semibold text-white">Shop Token Balances</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700/50">
                    <th className="text-left py-4 px-6 font-medium text-gray-400 text-sm">Shop</th>
                    <th className="text-right py-4 px-6 font-medium text-gray-400 text-sm">Balance</th>
                    <th className="text-right py-4 px-6 font-medium text-gray-400 text-sm">Issued</th>
                    <th className="text-right py-4 px-6 font-medium text-gray-400 text-sm">Redeemed</th>
                  </tr>
                </thead>
                <tbody>
                  {tokenMetrics.shopBalances.slice(0, 10).map((shop, index) => (
                    <tr key={shop.shopId} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                      <td className="py-4 px-6">
                        <div>
                          <div className="font-medium text-white text-sm">{shop.shopName}</div>
                          <div className="text-xs text-gray-500">{shop.shopId}</div>
                        </div>
                      </td>
                      <td className="text-right py-4 px-6 font-semibold text-white text-sm">{shop.balance.toLocaleString()} RCN</td>
                      <td className="text-right py-4 px-6 text-green-400 text-sm">{shop.tokensIssued.toLocaleString()} RCN</td>
                      <td className="text-right py-4 px-6 text-blue-400 text-sm">{shop.redemptionsProcessed.toLocaleString()} RCN</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Shop Rankings Tab */}
      {activeTab === 'rankings' && (
        <div className="space-y-8">
          <div className="bg-gradient-to-br from-gray-900/50 to-gray-800/30 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
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
          </div>

          <div className="bg-gradient-to-br from-gray-900/50 to-gray-800/30 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-gray-900/50 to-gray-800/30 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
              <WorkingChart
                data={shopRankings.slice(0, 10).map(shop => ({
                  date: shop.shopName,
                  value: shop.customerRetention,
                  label: shop.shopName
                }))}
                title="Customer Retention (Top 10)"
                color="#A855F7"
                formatValue={(value) => `${value.toFixed(1)}%`}
                height={250}
              />
            </div>

            <div className="bg-gradient-to-br from-gray-900/50 to-gray-800/30 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
              <WorkingChart
                data={shopRankings.slice(0, 10).map(shop => ({
                  date: shop.shopName,
                  value: shop.averageTransactionValue,
                  label: shop.shopName
                }))}
                title="Avg Transaction Value (Top 10)"
                color="#FB923C"
                formatValue={(value) => `${value.toFixed(2)} RCN`}
                height={250}
              />
            </div>
          </div>
        </div>
      )}

      {/* Alerts Tab */}
      {activeTab === 'alerts' && (
        <div className="bg-gradient-to-br from-gray-900/50 to-gray-800/30 backdrop-blur-sm rounded-2xl border border-gray-700/50 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-700/50">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">System Alerts</h2>
                <p className="text-sm text-gray-400 mt-1">Total: {alertsTotal} alerts</p>
              </div>
              <button
                onClick={loadAlerts}
                disabled={alertsLoading}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl disabled:opacity-50 text-sm font-medium transition-all shadow-lg hover:shadow-xl"
              >
                {alertsLoading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {alerts.map((alert) => (
                <div key={alert.id} className="bg-gray-800/30 backdrop-blur-sm rounded-xl p-5 border border-gray-700/50 hover:border-gray-600/50 transition-all duration-300">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <h3 className="font-semibold text-white">{alert.title}</h3>
                        <span className={`px-3 py-1 rounded-lg text-xs font-medium ${
                          alert.severity === 'critical' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                          alert.severity === 'high' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                          alert.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                          'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        }`}>
                          {alert.severity.toUpperCase()}
                        </span>
                        {alert.acknowledged && (
                          <span className="px-3 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg text-xs font-medium">
                            READ
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400 mb-3 line-clamp-2">{alert.message}</p>
                      <div className="text-xs text-gray-500 space-y-1">
                        <p>Type: {alert.alertType}</p>
                        <p>Created: {new Date(alert.createdAt).toLocaleString()}</p>
                        {alert.acknowledgedAt && (
                          <p>Read: {new Date(alert.acknowledgedAt).toLocaleString()} by {alert.acknowledgedBy}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {!alert.acknowledged && (
                        <button
                          onClick={() => handleMarkAlertAsRead(alert.id)}
                          className="px-4 py-2 bg-gray-700/50 hover:bg-gray-700 text-gray-300 rounded-lg text-xs transition-colors"
                        >
                          Mark Read
                        </button>
                      )}
                      <button
                        onClick={() => handleResolveAlert(alert.id)}
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg text-xs font-medium transition-all"
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
