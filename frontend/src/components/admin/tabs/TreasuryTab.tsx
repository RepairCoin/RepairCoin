'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useAdminDashboard } from '@/hooks/useAdminDashboard';
import { CheckCircle, Clock, AlertCircle, Zap, RefreshCw, AlertTriangle, DollarSign, Gem, Store, Coins, Gift, Banknote, RefreshCcw } from 'lucide-react';
import { AutoCompletePurchases } from '../AutoCompletePurchases';
import { TreasurySyncProvider } from '@/hooks/useTreasurySync';
import { WorkingChart, WorkingLineChart, WorkingPieChart } from '@/components/admin/charts/WorkingChart';

interface TreasuryData {
  totalSupply: number | string;
  availableSupply: number | string;
  totalSold: number;
  totalMinted?: number;
  totalRevenue: number;
  lastUpdated: string;
  circulatingSupply?: number;
  mintedRewards?: number;
  topBuyers: Array<{
    shop_id: string;
    shop_name: string;
    total_purchased: string | number;
    total_spent: string | number;
  }>;
  recentPurchases: Array<{
    id: string;
    shop_id: string;
    shop_name: string;
    rcn_amount: string | number;
    total_cost: string | number;
    purchase_date: string;
    payment_method?: string;
    payment_reference?: string;
    status: string;
  }>;
  treasury?: {
    totalSupply: number;
    totalSold: number;
    totalRevenue: number;
    totalMinted: number;
    totalIssuedByShops: number;
  };
  adminWallet?: {
    address: string;
    onChainBalance: number;
    expectedBalance: number;
    discrepancy: number;
  };
  warnings?: {
    hasDiscrepancies: boolean;
    customersWithMissingTokens: number;
    totalMissingTokens: number;
    message: string;
  };
}

interface TreasuryTabProps {}

interface RCGMetrics {
  totalSupply: string;
  circulatingSupply: string;
  allocations: {
    team: string;
    investors: string;
    publicSale: string;
    daoTreasury: string;
    stakingRewards: string;
  };
  shopTierDistribution: {
    standard: number;
    premium: number;
    elite: number;
    none: number;
    total: number;
  };
  topHolders: Array<{
    address: string;
    balance: string;
    isShop: boolean;
    shopName?: string;
  }>;
  revenueImpact: {
    standardRevenue: number;
    premiumRevenue: number;
    eliteRevenue: number;
    totalRevenue: number;
    discountsGiven: number;
  };
}

export const TreasuryTab: React.FC<TreasuryTabProps> = () => {
  const {  setError: onError } = useAdminDashboard();
  const [treasuryData, setTreasuryData] = useState<TreasuryData | null>(null);
  const [rcgMetrics, setRcgMetrics] = useState<RCGMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState<'rcn' | 'rcg'>('rcn');
  const [retryCount, setRetryCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTreasuryData();
    loadRCGMetrics();
  }, []);

  const loadTreasuryData = async (isRetry = false) => {
    if (!isRetry) {
      setLoading(true);
      setError(null);
    }
    
    try {
      // Cookies sent automatically with apiClient
      if (!adminToken) {
        setError('Failed to authenticate as admin');
        onError('Failed to authenticate as admin');
        return;
      }

      // Load both regular treasury data and the enhanced stats with warnings
      const [response, warningsResponse] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/treasury`, {
          headers: {
            'Authorization': `Bearer ${adminToken}`
          }
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/treasury/stats-with-warnings`, {
          headers: {
            'Authorization': `Bearer ${adminToken}`
          }
        })
      ]);
      
      if (response.ok) {
        const result = await response.json();
        let treasuryData = result.data;
        
        // Safely merge warnings data if available, without overwriting core treasury data
        if (warningsResponse.ok) {
          const warningsResult = await warningsResponse.json();
          treasuryData = {
            ...treasuryData,
            // Only add warnings-specific fields, don't overwrite core data
            warnings: warningsResult.data.warnings,
            adminWallet: warningsResult.data.adminWallet,
            treasury: {
              ...treasuryData.treasury,
              ...warningsResult.data.treasury
            }
          };
        }
        
        setTreasuryData(treasuryData);
        setError(null);
        setRetryCount(0);
      } else {
        const errorData = await response.json();
        const errorMessage = errorData.error || 'Failed to load treasury data';
        setError(errorMessage);
        onError(errorMessage);
      }
    } catch (error: any) {
      console.error('Error loading treasury data:', error);
      const errorMessage = error.message || 'Network error loading treasury data';
      setError(errorMessage);
      
      // Auto-retry for network errors (max 3 times)
      if (retryCount < 3 && (error.name === 'TypeError' || error.message?.includes('fetch'))) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          loadTreasuryData(true);
        }, 2000 * (retryCount + 1)); // Exponential backoff
      } else {
        onError(errorMessage);
      }
    } finally {
      if (!isRetry) {
        setLoading(false);
      }
    }
  };

  const loadRCGMetrics = async () => {
    try {
      // Cookies sent automatically with apiClient
      if (!adminToken) {
        onError('Failed to authenticate as admin');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/treasury/rcg`, {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        setRcgMetrics(result.data);
        
        // Show warning if using fallback data
        if (result.warning) {
          toast.error(result.warning, { duration: 5000 });
        }
      } else {
        const errorData = await response.json();
        console.error('Failed to load RCG metrics:', errorData.error);
        toast.error('Failed to load RCG metrics');
      }
    } catch (error) {
      console.error('Error loading RCG metrics:', error);
    }
  };


  const updateTreasuryData = async () => {
    setUpdating(true);
    try {
      // Cookies sent automatically with apiClient
      if (!adminToken) {
        onError('Failed to authenticate as admin');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/treasury/update`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        await loadTreasuryData();
      } else {
        const errorData = await response.json();
        onError(errorData.error || 'Failed to update treasury data');
      }
    } catch (error) {
      console.error('Error updating treasury:', error);
      onError('Failed to update treasury data');
    } finally {
      setUpdating(false);
    }
  };


  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const safeParseNumber = (value: string | number | undefined, fallback: number = 0): number => {
    if (typeof value === 'number' && !isNaN(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? fallback : parsed;
    }
    return fallback;
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="space-y-4">
            <div className="h-32 bg-gray-700 rounded"></div>
            <div className="h-32 bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!treasuryData && !loading) {
    return (
      <div className="bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700">
        <h2 className="text-2xl font-bold text-white mb-4">Treasury Management</h2>
        <div className="space-y-4">
          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-900/50 border border-red-700 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-200">{error}</p>
                {retryCount > 0 && (
                  <p className="text-sm text-red-300 mt-1">
                    Retried {retryCount} time{retryCount > 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => loadTreasuryData()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Retry Loading
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <TreasurySyncProvider>
      <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex space-x-1 p-1 bg-gray-900 rounded-lg">
        <button
          onClick={() => setActiveTab('rcn')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'rcn'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          RCN Treasury
        </button>
        <button
          onClick={() => setActiveTab('rcg')}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'rcg'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Treasury Analytics
        </button>
      </div>

      {activeTab === 'rcn' ? (
        <>
          {/* Retry Status */}
          {retryCount > 0 && (
            <div className="bg-yellow-900/50 border border-yellow-700 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-5 h-5 text-yellow-500 animate-spin" />
                <div>
                  <p className="text-yellow-200">
                    Retrying data load... (Attempt {retryCount}/3)
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Discrepancy Warning */}
          {treasuryData.warnings?.hasDiscrepancies && (
            <div className="bg-yellow-900/50 border border-yellow-700 rounded-xl p-6 mb-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-lg font-bold text-yellow-300 mb-1">Token Discrepancy Detected</h3>
                  <p className="text-yellow-200 mb-2">{treasuryData.warnings.message}</p>
                  <p className="text-sm text-yellow-300">
                    Total missing: {formatNumber(treasuryData.warnings.totalMissingTokens)} RCN
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* RCN Off-Chain Treasury Overview */}
          <div className="bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">RCN Off-Chain Treasury Overview</h2>
              <button
                onClick={updateTreasuryData}
                disabled={updating}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {updating && <RefreshCw className="w-4 h-4 animate-spin" />}
                {updating ? 'Updating...' : 'Update Data'}
              </button>
            </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <div className="bg-gradient-to-br from-blue-900 to-blue-800 rounded-xl p-6 border border-blue-700">
            <Gem className="w-8 h-8 text-blue-400 mb-2" />
            <p className="text-sm text-gray-400 mb-1">Off-Chain Supply</p>
            <p className="text-2xl font-bold text-white">Unlimited</p>
            <p className="text-sm text-blue-400 mt-1">Virtual token supply</p>
          </div>

          <div className="bg-gradient-to-br from-green-900 to-green-800 rounded-xl p-6 border border-green-700">
            <Store className="w-8 h-8 text-green-400 mb-2" />
            <p className="text-sm text-gray-400 mb-1">Shops Total Balance</p>
            <p className="text-2xl font-bold text-white">{formatNumber(treasuryData.totalSold)} RCN</p>
            <p className="text-sm text-green-400 mt-1">Available for rewards</p>
          </div>

          <div className="bg-gradient-to-br from-purple-900 to-purple-800 rounded-xl p-6 border border-purple-700">
            <Coins className="w-8 h-8 text-purple-400 mb-2" />
            <p className="text-sm text-gray-400 mb-1">Total Purchased by Shops</p>
            <p className="text-2xl font-bold text-white">{formatNumber(treasuryData.totalSold)} RCN</p>
            <p className="text-sm text-purple-400 mt-1">Paid via Stripe @ $0.10/RCN</p>
          </div>

          <div className="bg-gradient-to-br from-orange-900 to-orange-800 rounded-xl p-6 border border-orange-700">
            <Gift className="w-8 h-8 text-orange-400 mb-2" />
            <p className="text-sm text-gray-400 mb-1">Customer Rewards Issued</p>
            <p className="text-2xl font-bold text-white">{formatNumber(treasuryData.totalMinted || 0)} RCN</p>
            <p className="text-sm text-orange-400 mt-1">Off-chain tracking</p>
          </div>

          <div className="bg-gradient-to-br from-yellow-900 to-yellow-800 rounded-xl p-6 border border-yellow-700">
            <Banknote className="w-8 h-8 text-yellow-400 mb-2" />
            <p className="text-sm text-gray-400 mb-1">Total Revenue</p>
            <p className="text-2xl font-bold text-white">{formatCurrency(treasuryData.totalRevenue)}</p>
          </div>
        </div>

        <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-700">
          <p className="text-sm text-gray-500">
            Last updated: {new Date(treasuryData.lastUpdated).toLocaleString()}
          </p>
          <button
            onClick={() => loadTreasuryData()}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-700"
            title="Refresh data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Advanced Treasury Management Controls */}
      <div className="bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700">
        <h3 className="text-xl font-bold text-white mb-6">Treasury Management Controls</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Update Treasury Data */}
          <button
            onClick={updateTreasuryData}
            disabled={updating}
            className="flex flex-col items-center p-6 bg-blue-900/30 border border-blue-700 rounded-xl hover:bg-blue-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-8 h-8 text-blue-400 mb-3 ${updating ? 'animate-spin' : ''}`} />
            <span className="text-white font-medium">Update All Data</span>
            <span className="text-gray-400 text-sm mt-1">Refresh shop tiers & metrics</span>
          </button>

          {/* View Analytics */}
          <button
            onClick={() => {
              // TODO: Open analytics modal or navigate to analytics view
              toast.info('Advanced analytics coming soon!');
            }}
            className="flex flex-col items-center p-6 bg-green-900/30 border border-green-700 rounded-xl hover:bg-green-900/50 transition-colors"
          >
            <Zap className="w-8 h-8 text-green-400 mb-3" />
            <span className="text-white font-medium">View Analytics</span>
            <span className="text-gray-400 text-sm mt-1">Revenue & growth trends</span>
          </button>

          {/* Bulk Operations */}
          <button
            onClick={() => {
              // TODO: Open bulk operations modal
              toast.info('Bulk token operations coming soon!');
            }}
            className="flex flex-col items-center p-6 bg-purple-900/30 border border-purple-700 rounded-xl hover:bg-purple-900/50 transition-colors"
          >
            <CheckCircle className="w-8 h-8 text-purple-400 mb-3" />
            <span className="text-white font-medium">Bulk Operations</span>
            <span className="text-gray-400 text-sm mt-1">Mass token transfers</span>
          </button>

          {/* Emergency Controls */}
          <button
            onClick={() => {
              if (confirm('Are you sure you want to access emergency controls? This should only be used in critical situations.')) {
                toast.error('Emergency controls logged - contact technical team for implementation');
              }
            }}
            className="flex flex-col items-center p-6 bg-red-900/30 border border-red-700 rounded-xl hover:bg-red-900/50 transition-colors"
          >
            <AlertTriangle className="w-8 h-8 text-red-400 mb-3" />
            <span className="text-white font-medium">Emergency</span>
            <span className="text-gray-400 text-sm mt-1">Freeze & safety controls</span>
          </button>
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-700">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-400">{treasuryData.topBuyers.length}</p>
            <p className="text-gray-400 text-sm">Active Shops</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-400">{formatCurrency(treasuryData.totalRevenue)}</p>
            <p className="text-gray-400 text-sm">Total Revenue</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-400">{treasuryData.recentPurchases.length}</p>
            <p className="text-gray-400 text-sm">Recent Transactions</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-400">$0.10</p>
            <p className="text-gray-400 text-sm">RCN Price (USD)</p>
          </div>
        </div>
      </div>

      {/* Row 1: Revenue Trend Chart */}
      {treasuryData.recentPurchases.length > 0 && (
        <WorkingChart
          data={treasuryData.recentPurchases.slice(-30).map(purchase => ({
            date: purchase.purchase_date,
            value: safeParseNumber(purchase.total_cost)
          }))}
          title="Revenue Trend (Last 30 Days)"
          color="#10B981"
          formatValue={(value) => formatCurrency(value)}
          type="line"
          height={300}
        />
      )}

      {/* Row 2: Top RCN Buyers */}
      {treasuryData.topBuyers.length > 0 && (
        <WorkingChart
          data={treasuryData.topBuyers.slice(0, 10).map(buyer => ({
            date: buyer.shop_name,
            value: safeParseNumber(buyer.total_purchased),
            label: buyer.shop_name
          }))}
          title="Top RCN Buyers"
          color="#3B82F6"
          formatValue={(value) => `${formatNumber(value)} RCN`}
          height={300}
          type="bar"
        />
      )}
      
      {/* Row 3: RCN Purchase Distribution */}
      {treasuryData.topBuyers.length > 0 && (
        <WorkingPieChart
          data={treasuryData.topBuyers.slice(0, 8).map((buyer, index) => ({
            label: buyer.shop_name,
            value: safeParseNumber(buyer.total_purchased),
            color: `hsl(${(index * 45) % 360}, 70%, 50%)`
          }))}
          title="RCN Purchase Distribution by Shop"
          formatValue={(value) => `${formatNumber(value)} RCN`}
          size={300}
        />
      )}

      {/* Top Buyers List */}
      <div className="bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-700">
        <h3 className="text-xl font-bold text-white mb-4">Top RCN Buyers</h3>
        {treasuryData.topBuyers.length === 0 ? (
          <div className="text-center py-8">
            <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-300 text-lg font-medium">No purchases yet</p>
            <p className="text-gray-400 text-sm">Shop purchases will appear here once they start buying RCN tokens</p>
          </div>
        ) : (
          <div className="space-y-3">
            {treasuryData.topBuyers.map((buyer, index) => (
              <div key={buyer.shop_id || `buyer-${index}`} className="flex items-center justify-between p-4 bg-gray-700 rounded-lg border border-gray-600 hover:bg-gray-600 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="text-2xl font-bold text-gray-400">#{index + 1}</div>
                  <div>
                    <p className="font-semibold text-white">{buyer.shop_name}</p>
                    <p className="text-sm text-gray-300">Shop ID: {buyer.shop_id}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-white">{formatNumber(safeParseNumber(buyer.total_purchased))} RCN</p>
                  <p className="text-sm text-gray-300">{formatCurrency(safeParseNumber(buyer.total_spent))}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Purchases */}
      <div className="bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-700">
        <h3 className="text-xl font-bold text-white mb-4">Recent RCN Purchases</h3>
        {treasuryData.recentPurchases.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-300 text-lg font-medium">No recent purchases</p>
            <p className="text-gray-400 text-sm">Recent RCN purchases from shops will be displayed here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-600">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Shop</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Cost</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-600">
                {treasuryData.recentPurchases.map((purchase) => {
                  const status = purchase.status?.toLowerCase() || 'unknown';
                  const statusColors = {
                    completed: 'bg-green-600 text-green-200',
                    pending: 'bg-yellow-600 text-yellow-200',
                    failed: 'bg-red-600 text-red-200',
                    cancelled: 'bg-gray-600 text-gray-200',
                    unknown: 'bg-gray-600 text-gray-200'
                  };
                  const statusColor = statusColors[status as keyof typeof statusColors] || statusColors.unknown;
                  
                  return (
                    <tr key={purchase.id} className="hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-white">{purchase.shop_name}</div>
                        <div className="text-sm text-gray-300">{purchase.shop_id}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        {formatNumber(safeParseNumber(purchase.rcn_amount))} RCN
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                        {formatCurrency(safeParseNumber(purchase.total_cost))}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {new Date(purchase.purchase_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor}`}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Auto-Complete Purchases - Still needed for failed Stripe webhooks */}
      <AutoCompletePurchases />
      
      {/* Off-chain Operations Notice */}
      <div className="bg-blue-900/50 border border-blue-700 rounded-xl p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-bold text-blue-300 mb-1">Off-Chain Operations</h3>
            <p className="text-blue-200 mb-2">
              Shop tokens are managed off-chain. Shops purchase RCN tokens and use them directly without blockchain transactions.
            </p>
            <div className="text-sm text-blue-300 space-y-1">
              <p>• Shop purchases: Processed via Stripe</p>
              <p>• Customer rewards: Tracked in database</p>
              <p>• Redemptions: Handled off-chain</p>
            </div>
          </div>
        </div>
      </div>

        </>
      ) : (
        <>
          {/* Treasury Analytics */}
          {rcgMetrics ? (
            <div className="space-y-6">
              {/* RCG Token Overview */}
              <div className="bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700">
                <h2 className="text-2xl font-bold text-white mb-6">RCG Token Distribution</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-gradient-to-br from-purple-900 to-purple-800 rounded-xl p-6 border border-purple-700">
                    <Gem className="w-8 h-8 text-purple-400 mb-2" />
                    <p className="text-sm text-gray-400 mb-1">Total Supply</p>
                    <p className="text-2xl font-bold text-white">{formatNumber(parseInt(rcgMetrics.totalSupply))} RCG</p>
                    <p className="text-xs text-purple-400 mt-1">Fixed supply</p>
                  </div>
                  
                  <div className="bg-gradient-to-br from-indigo-900 to-indigo-800 rounded-xl p-6 border border-indigo-700">
                    <RefreshCcw className="w-8 h-8 text-indigo-400 mb-2" />
                    <p className="text-sm text-gray-400 mb-1">Circulating Supply</p>
                    <p className="text-2xl font-bold text-white">{formatNumber(parseInt(rcgMetrics.circulatingSupply))} RCG</p>
                    <p className="text-xs text-indigo-400 mt-1">Available for trading</p>
                  </div>
                  
                  <div className="bg-gradient-to-br from-pink-900 to-pink-800 rounded-xl p-6 border border-pink-700">
                    <Store className="w-8 h-8 text-pink-400 mb-2" />
                    <p className="text-sm text-gray-400 mb-1">Total Shops</p>
                    <p className="text-2xl font-bold text-white">{rcgMetrics?.shopTierDistribution?.total || 0}</p>
                    <p className="text-xs text-pink-400 mt-1">Active partners</p>
                  </div>
                </div>
              </div>

              {/* Row 1: RCG Token Allocation */}
              <WorkingPieChart
                data={[
                  { label: 'Team & Founders (30%)', value: parseInt(rcgMetrics.allocations.team), color: '#8B5CF6' },
                  { label: 'Private Investors (30%)', value: parseInt(rcgMetrics.allocations.investors), color: '#3B82F6' },
                  { label: 'Public Sale (20%)', value: parseInt(rcgMetrics.allocations.publicSale), color: '#10B981' },
                  { label: 'DAO Treasury (15%)', value: parseInt(rcgMetrics.allocations.daoTreasury), color: '#F59E0B' },
                  { label: 'Staking Rewards (5%)', value: parseInt(rcgMetrics.allocations.stakingRewards), color: '#EF4444' }
                ]}
                title="RCG Token Allocation Distribution"
                formatValue={(value) => `${formatNumber(value)} RCG`}
                size={300}
              />

              {/* Row 2: Shop Tier Distribution */}
              <WorkingPieChart
                data={[
                  { label: 'Elite Tier (200K+ RCG)', value: rcgMetrics.shopTierDistribution.elite, color: '#F59E0B' },
                  { label: 'Premium Tier (50K-199K RCG)', value: rcgMetrics.shopTierDistribution.premium, color: '#3B82F6' },
                  { label: 'Standard Tier (10K-49K RCG)', value: rcgMetrics.shopTierDistribution.standard, color: '#10B981' },
                  { label: 'No Tier (<10K RCG)', value: rcgMetrics.shopTierDistribution.none, color: '#EF4444' }
                ]}
                title="Shop Tier Distribution"
                formatValue={(value) => `${value} shops`}
                size={300}
              />

              {/* Row 3: Revenue by Tier */}
              <WorkingChart
                data={[
                  { date: 'Standard', value: rcgMetrics.revenueImpact.standardRevenue, label: 'Standard Tier' },
                  { date: 'Premium', value: rcgMetrics.revenueImpact.premiumRevenue, label: 'Premium Tier' },
                  { date: 'Elite', value: rcgMetrics.revenueImpact.eliteRevenue, label: 'Elite Tier' }
                ]}
                title="Revenue by Tier (Last 30 Days)"
                color="#10B981"
                formatValue={(value) => formatCurrency(value)}
                height={300}
                type="bar"
              />

              {/* Row 4: Top RCG Holders */}
              {rcgMetrics.topHolders.length > 0 && (
                <div className="bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700 hover:shadow-2xl transition-shadow duration-300">
                  <h3 className="text-2xl font-bold text-white mb-6">Top RCG Holders</h3>
                  
                  <div className="space-y-4">
                    {rcgMetrics.topHolders.map((holder, index) => (
                      <div key={holder.address} className="flex items-center justify-between p-6 bg-gradient-to-r from-gray-700 to-gray-600 rounded-xl border border-gray-500 hover:shadow-md transition-shadow duration-200">
                        <div className="flex items-center gap-4">
                          <div className="text-3xl font-bold text-gray-400">#{index + 1}</div>
                          <div>
                            {holder.isShop && holder.shopName ? (
                              <>
                                <p className="font-bold text-white text-lg">{holder.shopName}</p>
                                <p className="text-sm text-gray-300 font-mono">{holder.address}</p>
                              </>
                            ) : (
                              <p className="font-mono text-white text-lg">{holder.address}</p>
                            )}
                            {holder.isShop && (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-600 text-blue-200 mt-2">
                                Shop Partner
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-white text-xl">{formatNumber(parseInt(holder.balance))} RCG</p>
                          <p className="text-sm text-gray-300 font-medium">
                            {((parseInt(holder.balance) / parseInt(rcgMetrics.totalSupply)) * 100).toFixed(2)}% of supply
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700">
              <h2 className="text-2xl font-bold text-white mb-4">Treasury Analytics</h2>
              <p className="text-gray-400">Loading treasury analytics...</p>
            </div>
          )}
        </>
      )}

      </div>
    </TreasurySyncProvider>
  );
};