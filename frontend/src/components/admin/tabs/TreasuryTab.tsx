'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useAdminDashboard } from '@/hooks/useAdminDashboard';
import { CheckCircle, Clock, AlertCircle, Zap, RefreshCw, AlertTriangle } from 'lucide-react';
import { PendingMintsSection } from './PendingMintsSection';
import { BlockchainMintingToggle } from '../settings/BlockchainMintingToggle';
import { AutoCompletePurchases } from '../AutoCompletePurchases';
import { DiscrepancySection } from './DiscrepancySection';

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
    shopId?: string;
    shop_id?: string;
    shopName?: string;
    shop_name?: string;
    totalPurchased?: number;
    total_purchased?: string | number;
    totalSpent?: number;
    total_spent?: string | number;
  }>;
  recentPurchases: Array<{
    id: string;
    shopId?: string;
    shop_id?: string;
    shopName?: string;
    shop_name?: string;
    amount?: number;
    rcn_amount?: string | number;
    totalCost?: number;
    total_cost?: string | number;
    createdAt?: string;
    purchase_date?: string;
    payment_method?: string;
    payment_reference?: string;
    status?: string;
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
  const { generateAdminToken, setError: onError } = useAdminDashboard();
  const [treasuryData, setTreasuryData] = useState<TreasuryData | null>(null);
  const [rcgMetrics, setRcgMetrics] = useState<RCGMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState<'rcn' | 'rcg'>('rcn');

  useEffect(() => {
    loadTreasuryData();
    loadRCGMetrics();
  }, []);

  const loadTreasuryData = async () => {
    setLoading(true);
    try {
      const adminToken = await generateAdminToken();
      if (!adminToken) {
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
        
        // Merge warnings data if available
        if (warningsResponse.ok) {
          const warningsResult = await warningsResponse.json();
          treasuryData = {
            ...treasuryData,
            ...warningsResult.data,
            totalMinted: warningsResult.data.treasury?.totalMinted || treasuryData.totalMinted
          };
        }
        
        setTreasuryData(treasuryData);
      } else {
        const errorData = await response.json();
        onError(errorData.error || 'Failed to load treasury data');
      }
    } catch (error) {
      console.error('Error loading treasury data:', error);
      onError('Failed to load treasury data');
    } finally {
      setLoading(false);
    }
  };

  const loadRCGMetrics = async () => {
    try {
      const adminToken = await generateAdminToken();
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
      } else {
        const errorData = await response.json();
        console.error('Failed to load RCG metrics:', errorData.error);
      }
    } catch (error) {
      console.error('Error loading RCG metrics:', error);
    }
  };


  const updateTreasuryData = async () => {
    setUpdating(true);
    try {
      const adminToken = await generateAdminToken();
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

  if (!treasuryData) {
    return (
      <div className="bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700">
        <h2 className="text-2xl font-bold text-white mb-4">Treasury Management</h2>
        <p className="text-gray-400">Failed to load treasury data</p>
      </div>
    );
  }

  return (
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
              ? 'bg-purple-600 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          RCG Metrics
        </button>
      </div>

      {activeTab === 'rcn' ? (
        <>
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

          {/* RCN Treasury Overview */}
          <div className="bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">RCN Treasury Overview</h2>
              <button
                onClick={updateTreasuryData}
                disabled={updating}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {updating ? 'Updating...' : 'Update Data'}
              </button>
            </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <div className="bg-gradient-to-br from-blue-900 to-blue-800 rounded-xl p-6 border border-blue-700">
            <div className="text-3xl mb-2">💎</div>
            <p className="text-sm text-gray-400 mb-1">Total Supply</p>
            <p className="text-2xl font-bold text-white">
              {typeof treasuryData.totalSupply === 'string' 
                ? treasuryData.totalSupply 
                : formatNumber(treasuryData.totalSupply)} RCN
            </p>
          </div>

          <div className="bg-gradient-to-br from-green-900 to-green-800 rounded-xl p-6 border border-green-700">
            <div className="text-3xl mb-2">🏦</div>
            <p className="text-sm text-gray-400 mb-1">Available in Treasury</p>
            <p className="text-2xl font-bold text-white">
              {typeof treasuryData.availableSupply === 'string' 
                ? treasuryData.availableSupply 
                : formatNumber(treasuryData.availableSupply)} RCN
            </p>
          </div>

          <div className="bg-gradient-to-br from-purple-900 to-purple-800 rounded-xl p-6 border border-purple-700">
            <div className="text-3xl mb-2">💰</div>
            <p className="text-sm text-gray-400 mb-1">Total Sold to Shops</p>
            <p className="text-2xl font-bold text-white">{formatNumber(treasuryData.totalSold)} RCN</p>
            <p className="text-sm text-purple-400 mt-1">Shops purchased @ $0.10/RCN</p>
          </div>

          <div className="bg-gradient-to-br from-orange-900 to-orange-800 rounded-xl p-6 border border-orange-700">
            <div className="text-3xl mb-2">🎁</div>
            <p className="text-sm text-gray-400 mb-1">Total Minted (Rewards)</p>
            <p className="text-2xl font-bold text-white">{formatNumber(treasuryData.totalMinted || 0)} RCN</p>
            <p className="text-sm text-orange-400 mt-1">Issued to customers</p>
          </div>

          <div className="bg-gradient-to-br from-yellow-900 to-yellow-800 rounded-xl p-6 border border-yellow-700">
            <div className="text-3xl mb-2">💵</div>
            <p className="text-sm text-gray-400 mb-1">Total Revenue</p>
            <p className="text-2xl font-bold text-white">{formatCurrency(treasuryData.totalRevenue)}</p>
          </div>
        </div>

        <p className="text-sm text-gray-500 mt-4">
          Last updated: {new Date(treasuryData.lastUpdated).toLocaleString()}
        </p>
      </div>

      {/* Top Buyers */}
      <div className="bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700">
        <h3 className="text-xl font-bold text-white mb-4">Top RCN Buyers</h3>
        {treasuryData.topBuyers.length === 0 ? (
          <p className="text-gray-400">No purchases yet</p>
        ) : (
          <div className="space-y-3">
            {treasuryData.topBuyers.map((buyer, index) => (
              <div key={buyer.shop_id || buyer.shopId || `buyer-${index}`} className="flex items-center justify-between p-4 bg-gray-900 rounded-lg border border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="text-2xl font-bold text-gray-500">#{index + 1}</div>
                  <div>
                    <p className="font-semibold text-white">{buyer.shop_name || buyer.shopName}</p>
                    <p className="text-sm text-gray-400">Shop ID: {buyer.shop_id || buyer.shopId}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-white">{formatNumber(Number(buyer.total_purchased || buyer.totalPurchased || 0))} RCN</p>
                  <p className="text-sm text-gray-400">{formatCurrency(Number(buyer.total_spent || buyer.totalSpent || 0))}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Purchases */}
      <div className="bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700">
        <h3 className="text-xl font-bold text-white mb-4">Recent RCN Purchases</h3>
        {treasuryData.recentPurchases.length === 0 ? (
          <p className="text-gray-400">No recent purchases</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Shop</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Cost</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                {treasuryData.recentPurchases.map((purchase) => (
                  <tr key={purchase.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-white">{purchase.shop_name || purchase.shopName}</div>
                      <div className="text-sm text-gray-400">{purchase.shop_id || purchase.shopId}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                      {formatNumber(Number(purchase.rcn_amount || purchase.amount || 0))} RCN
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                      {formatCurrency(Number(purchase.total_cost || purchase.totalCost || 0))}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      {new Date(purchase.purchase_date || purchase.createdAt || Date.now()).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-900 text-green-400`}>
                        Completed
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Auto-Complete Purchases */}
      <AutoCompletePurchases />
      
      {/* Pending Blockchain Mints */}
      <PendingMintsSection />
      
      {/* Blockchain Minting Settings */}
      <div className="mt-6">
        <h3 className="text-xl font-bold text-white mb-4">Minting Settings</h3>
        <BlockchainMintingToggle />
      </div>

      {/* Token Discrepancies Section */}
      <DiscrepancySection />

        </>
      ) : (
        <>
          {/* RCG Metrics */}
          {rcgMetrics ? (
            <>
              {/* RCG Token Overview */}
              <div className="bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700">
                <h2 className="text-2xl font-bold text-white mb-6">RCG Token Distribution</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-gradient-to-br from-purple-900 to-purple-800 rounded-xl p-6 border border-purple-700">
                    <div className="text-3xl mb-2">💜</div>
                    <p className="text-sm text-gray-400 mb-1">Total Supply</p>
                    <p className="text-2xl font-bold text-white">{formatNumber(parseInt(rcgMetrics.totalSupply))} RCG</p>
                    <p className="text-xs text-purple-400 mt-1">Fixed supply</p>
                  </div>
                  
                  <div className="bg-gradient-to-br from-indigo-900 to-indigo-800 rounded-xl p-6 border border-indigo-700">
                    <div className="text-3xl mb-2">🔄</div>
                    <p className="text-sm text-gray-400 mb-1">Circulating Supply</p>
                    <p className="text-2xl font-bold text-white">{formatNumber(parseInt(rcgMetrics.circulatingSupply))} RCG</p>
                    <p className="text-xs text-indigo-400 mt-1">Available for trading</p>
                  </div>
                  
                  <div className="bg-gradient-to-br from-pink-900 to-pink-800 rounded-xl p-6 border border-pink-700">
                    <div className="text-3xl mb-2">🏪</div>
                    <p className="text-sm text-gray-400 mb-1">Total Shops</p>
                    <p className="text-2xl font-bold text-white">{rcgMetrics?.shopTierDistribution?.total || 0}</p>
                    <p className="text-xs text-pink-400 mt-1">Active partners</p>
                  </div>
                </div>
              </div>

              {/* Token Allocations */}
              <div className="bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700">
                <h3 className="text-xl font-bold text-white mb-4">Token Allocations</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                    <p className="text-sm text-gray-400">Team & Founders</p>
                    <p className="text-lg font-bold text-white">{formatNumber(parseInt(rcgMetrics.allocations.team))} RCG</p>
                    <p className="text-xs text-gray-500">30% - 4yr vest, 1yr cliff</p>
                  </div>
                  
                  <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                    <p className="text-sm text-gray-400">Private Investors</p>
                    <p className="text-lg font-bold text-white">{formatNumber(parseInt(rcgMetrics.allocations.investors))} RCG</p>
                    <p className="text-xs text-gray-500">30% - 2yr vest, 6mo cliff</p>
                  </div>
                  
                  <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                    <p className="text-sm text-gray-400">Public Sale</p>
                    <p className="text-lg font-bold text-white">{formatNumber(parseInt(rcgMetrics.allocations.publicSale))} RCG</p>
                    <p className="text-xs text-gray-500">20% - DEX/CEX</p>
                  </div>
                  
                  <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                    <p className="text-sm text-gray-400">DAO Treasury</p>
                    <p className="text-lg font-bold text-white">{formatNumber(parseInt(rcgMetrics.allocations.daoTreasury))} RCG</p>
                    <p className="text-xs text-gray-500">15% - Community</p>
                  </div>
                  
                  <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                    <p className="text-sm text-gray-400">Staking Rewards</p>
                    <p className="text-lg font-bold text-white">{formatNumber(parseInt(rcgMetrics.allocations.stakingRewards))} RCG</p>
                    <p className="text-xs text-gray-500">5% - 4yr emission</p>
                  </div>
                </div>
              </div>

              {/* Shop Tier Distribution */}
              <div className="bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700">
                <h3 className="text-xl font-bold text-white mb-4">Shop Tier Distribution</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-6 border border-gray-700">
                    <div className="text-2xl mb-2">🥉</div>
                    <p className="text-sm text-gray-400 mb-1">Standard Tier</p>
                    <p className="text-2xl font-bold text-white">{rcgMetrics.shopTierDistribution.standard}</p>
                    <p className="text-xs text-gray-500">10K-49K RCG</p>
                    <p className="text-xs text-green-400">$0.10/RCN</p>
                  </div>
                  
                  <div className="bg-gradient-to-br from-blue-900 to-blue-800 rounded-xl p-6 border border-blue-700">
                    <div className="text-2xl mb-2">🥈</div>
                    <p className="text-sm text-gray-400 mb-1">Premium Tier</p>
                    <p className="text-2xl font-bold text-white">{rcgMetrics.shopTierDistribution.premium}</p>
                    <p className="text-xs text-blue-400">50K-199K RCG</p>
                    <p className="text-xs text-green-400">$0.08/RCN (20% off)</p>
                  </div>
                  
                  <div className="bg-gradient-to-br from-yellow-900 to-yellow-800 rounded-xl p-6 border border-yellow-700">
                    <div className="text-2xl mb-2">🥇</div>
                    <p className="text-sm text-gray-400 mb-1">Elite Tier</p>
                    <p className="text-2xl font-bold text-white">{rcgMetrics.shopTierDistribution.elite}</p>
                    <p className="text-xs text-yellow-400">200K+ RCG</p>
                    <p className="text-xs text-green-400">$0.06/RCN (40% off)</p>
                  </div>
                  
                  <div className="bg-gradient-to-br from-red-900 to-red-800 rounded-xl p-6 border border-red-700">
                    <div className="text-2xl mb-2">❌</div>
                    <p className="text-sm text-gray-400 mb-1">No Tier</p>
                    <p className="text-2xl font-bold text-white">{rcgMetrics.shopTierDistribution.none}</p>
                    <p className="text-xs text-red-400">&lt;10K RCG</p>
                    <p className="text-xs text-gray-500">Cannot buy RCN</p>
                  </div>
                </div>
              </div>

              {/* Revenue Impact */}
              <div className="bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700">
                <h3 className="text-xl font-bold text-white mb-4">Revenue Impact by Tier</h3>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                      <p className="text-sm text-gray-400">Standard Tier Revenue</p>
                      <p className="text-lg font-bold text-white">{formatCurrency(rcgMetrics.revenueImpact.standardRevenue)}</p>
                    </div>
                    
                    <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                      <p className="text-sm text-gray-400">Premium Tier Revenue</p>
                      <p className="text-lg font-bold text-white">{formatCurrency(rcgMetrics.revenueImpact.premiumRevenue)}</p>
                    </div>
                    
                    <div className="bg-gray-900 rounded-lg p-4 border border-gray-700">
                      <p className="text-sm text-gray-400">Elite Tier Revenue</p>
                      <p className="text-lg font-bold text-white">{formatCurrency(rcgMetrics.revenueImpact.eliteRevenue)}</p>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-green-900 to-green-800 rounded-xl p-6 border border-green-700">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-gray-400">Total Revenue (30 days)</p>
                        <p className="text-2xl font-bold text-white">{formatCurrency(rcgMetrics.revenueImpact.totalRevenue)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-400">Discounts Given</p>
                        <p className="text-xl font-bold text-red-400">-{formatCurrency(rcgMetrics.revenueImpact.discountsGiven)}</p>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-green-700">
                      <h4 className="text-sm font-semibold text-gray-300 mb-2">Revenue Distribution</h4>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <p className="text-gray-400">Operations (80%)</p>
                          <p className="font-bold text-white">{formatCurrency(rcgMetrics.revenueImpact.totalRevenue * 0.8)}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Stakers (10%)</p>
                          <p className="font-bold text-green-400">{formatCurrency(rcgMetrics.revenueImpact.totalRevenue * 0.1)}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">DAO (10%)</p>
                          <p className="font-bold text-purple-400">{formatCurrency(rcgMetrics.revenueImpact.totalRevenue * 0.1)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Top RCG Holders */}
              {rcgMetrics.topHolders.length > 0 && (
                <div className="bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700">
                  <h3 className="text-xl font-bold text-white mb-4">Top RCG Holders</h3>
                  
                  <div className="space-y-3">
                    {rcgMetrics.topHolders.map((holder, index) => (
                      <div key={holder.address} className="flex items-center justify-between p-4 bg-gray-900 rounded-lg border border-gray-700">
                        <div className="flex items-center gap-3">
                          <div className="text-2xl font-bold text-gray-500">#{index + 1}</div>
                          <div>
                            {holder.isShop && holder.shopName ? (
                              <>
                                <p className="font-semibold text-white">{holder.shopName}</p>
                                <p className="text-xs text-gray-400 font-mono">{holder.address}</p>
                              </>
                            ) : (
                              <p className="font-mono text-white">{holder.address}</p>
                            )}
                            {holder.isShop && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-900 text-blue-400 mt-1">
                                Shop Partner
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-white">{formatNumber(parseInt(holder.balance))} RCG</p>
                          <p className="text-sm text-gray-400">
                            {((parseInt(holder.balance) / 100000000) * 100).toFixed(2)}% of supply
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-700">
              <h2 className="text-2xl font-bold text-white mb-4">RCG Metrics</h2>
              <p className="text-gray-400">Loading RCG metrics...</p>
            </div>
          )}
        </>
      )}

    </div>
  );
};