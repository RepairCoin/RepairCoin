'use client';

import { useState, useEffect } from 'react';
import { ConnectButton, useActiveAccount } from "thirdweb/react";
import { createThirdwebClient } from "thirdweb";

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "1969ac335e07ba13ad0f8d1a1de4f6ab",
});

interface ShopData {
  shopId: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  walletAddress: string;
  verified: boolean;
  active: boolean;
  crossShopEnabled: boolean;
  totalTokensIssued: number;
  totalRedemptions: number;
  purchasedRcnBalance: number;
  totalRcnPurchased: number;
  lastPurchaseDate?: string;
}

interface PurchaseHistory {
  id: string;
  amount: number;
  totalCost: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
}

interface TierBonusStats {
  totalBonusesIssued: number;
  totalBonusAmount: number;
  bonusesByTier: { [key: string]: { count: number; amount: number } };
  averageBonusPerTransaction: number;
}

export default function ShopDashboard() {
  const account = useActiveAccount();
  const [shopData, setShopData] = useState<ShopData | null>(null);
  const [purchases, setPurchases] = useState<PurchaseHistory[]>([]);
  const [tierStats, setTierStats] = useState<TierBonusStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'purchase' | 'bonuses' | 'analytics'>('overview');
  
  // Purchase form state
  const [purchaseAmount, setPurchaseAmount] = useState<number>(100);
  const [paymentMethod, setPaymentMethod] = useState<'credit_card' | 'bank_transfer' | 'usdc'>('credit_card');
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    if (account?.address) {
      loadShopData();
    }
  }, [account?.address]);

  const loadShopData = async () => {
    setLoading(true);
    setError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      
      // Load shop data (would need shop ID lookup by wallet address)
      const shopResponse = await fetch(`${apiUrl}/shops/wallet/${account?.address}`);
      if (shopResponse.ok) {
        const shopResult = await shopResponse.json();
        setShopData(shopResult.data);
        
        // Load purchase history
        if (shopResult.data.shopId) {
          const purchaseResponse = await fetch(`${apiUrl}/shops/purchase/history/${shopResult.data.shopId}`);
          if (purchaseResponse.ok) {
            const purchaseResult = await purchaseResponse.json();
            setPurchases(purchaseResult.data.purchases || []);
          }

          // Load tier bonus stats
          const tierResponse = await fetch(`${apiUrl}/shops/tier-bonus/stats/${shopResult.data.shopId}`);
          if (tierResponse.ok) {
            const tierResult = await tierResponse.json();
            setTierStats(tierResult.data);
          }
        }
      } else if (shopResponse.status === 404) {
        setError('Shop not found. Please register your shop first.');
      }

    } catch (err) {
      console.error('Error loading shop data:', err);
      setError('Failed to load shop data');
    } finally {
      setLoading(false);
    }
  };

  const purchaseRcn = async () => {
    if (!shopData || !account?.address) return;

    setPurchasing(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/shops/purchase/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shopId: shopData.shopId,
          amount: purchaseAmount,
          paymentMethod,
          shopWalletAddress: account.address
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Purchase failed');
      }

      const result = await response.json();
      console.log('Purchase initiated:', result);
      
      // In a real implementation, this would redirect to payment processing
      alert(`Purchase initiated! Total cost: $${result.data.totalCost}. Please complete payment.`);
      
      // Reload shop data
      await loadShopData();
      
    } catch (err) {
      console.error('Error purchasing RCN:', err);
      setError(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setPurchasing(false);
    }
  };

  const getTierColor = (tier: string): string => {
    switch (tier) {
      case 'BRONZE': return 'bg-orange-100 text-orange-800';
      case 'SILVER': return 'bg-gray-100 text-gray-800';  
      case 'GOLD': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="text-center">
            <div className="text-6xl mb-6">🏪</div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Shop Dashboard</h1>
            <p className="text-gray-600 mb-8">
              Connect your shop wallet to access the dashboard
            </p>
            <ConnectButton 
              client={client}
              theme="light"
              connectModal={{ size: "wide" }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
        <div className="max-w-md w-full mx-auto p-6">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <div className="text-center">
              <div className="text-4xl mb-4">🏪</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Loading your shop...</h2>
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2 mx-auto"></div>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !shopData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="text-center">
            <div className="text-red-500 text-4xl mb-4">🚫</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Shop Not Found</h3>
            <p className="text-gray-600 mb-6">{error}</p>
            <button className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-3 px-4 rounded-xl transition duration-200 transform hover:scale-105">
              Register Shop
            </button>
            <div className="mt-6 pt-6 border-t border-gray-200">
              <ConnectButton 
                client={client}
                theme="light"
                connectModal={{ size: "compact" }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8 border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="text-2xl">🏪</div>
                <h1 className="text-2xl font-bold text-gray-900">{shopData?.name || 'Shop Dashboard'}</h1>
                {shopData?.verified && (
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                    ✓ Verified
                  </span>
                )}
              </div>
              <p className="text-gray-500 text-sm font-mono bg-gray-50 px-3 py-1 rounded-lg">
                {account.address?.slice(0, 6)}...{account.address?.slice(-4)}
              </p>
            </div>
            <div className="mt-4 sm:mt-0">
              <ConnectButton 
                client={client}
                theme="light"
                connectModal={{ size: "compact" }}
              />
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-2xl shadow-xl p-2 mb-8 border border-gray-100">
          <div className="flex space-x-1">
            {[
              { id: 'overview', label: 'Overview', icon: '📊' },
              { id: 'purchase', label: 'Buy RCN', icon: '💰' },
              { id: 'bonuses', label: 'Tier Bonuses', icon: '🏆' },
              { id: 'analytics', label: 'Analytics', icon: '📈' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Shop Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">RCN Balance</p>
                    <p className="text-3xl font-bold text-green-600">{shopData?.purchasedRcnBalance?.toFixed(2) || '0.00'}</p>
                    <p className="text-xs text-gray-400">Available for bonuses</p>
                  </div>
                  <div className="text-3xl">💰</div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Tokens Issued</p>
                    <p className="text-3xl font-bold text-blue-600">{shopData?.totalTokensIssued || 0}</p>
                    <p className="text-xs text-gray-400">To customers</p>
                  </div>
                  <div className="text-3xl">🪙</div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Total Redemptions</p>
                    <p className="text-3xl font-bold text-purple-600">{shopData?.totalRedemptions || 0}</p>
                    <p className="text-xs text-gray-400">RCN redeemed</p>
                  </div>
                  <div className="text-3xl">💸</div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">RCN Purchased</p>
                    <p className="text-3xl font-bold text-orange-600">{shopData?.totalRcnPurchased?.toFixed(2) || '0.00'}</p>
                    <p className="text-xs text-gray-400">Total investment</p>
                  </div>
                  <div className="text-3xl">📈</div>
                </div>
              </div>
            </div>

            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Shop Status</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Active Status</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      shopData?.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {shopData?.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Verification</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      shopData?.verified ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {shopData?.verified ? 'Verified' : 'Pending'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Cross-Shop Redemption</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      shopData?.crossShopEnabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {shopData?.crossShopEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Balance Alert</h3>
                <div className="space-y-3">
                  {(shopData?.purchasedRcnBalance || 0) < 50 ? (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                      <div className="flex items-center">
                        <div className="text-red-400 text-xl mr-3">⚠️</div>
                        <div>
                          <h4 className="text-sm font-medium text-red-800">Low Balance</h4>
                          <p className="text-sm text-red-700">
                            Your RCN balance is running low. Purchase more to continue offering tier bonuses.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                      <div className="flex items-center">
                        <div className="text-green-400 text-xl mr-3">✅</div>
                        <div>
                          <h4 className="text-sm font-medium text-green-800">Good Balance</h4>
                          <p className="text-sm text-green-700">
                            You have sufficient RCN balance for tier bonuses.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Purchase Tab */}
        {activeTab === 'purchase' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Purchase Form */}
              <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Purchase RCN Tokens</h2>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Amount (minimum 100 RCN)
                    </label>
                    <input
                      type="number"
                      min="100"
                      max="10000"
                      step="1"
                      value={purchaseAmount}
                      onChange={(e) => setPurchaseAmount(parseInt(e.target.value) || 100)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                    <p className="text-sm text-gray-500 mt-2">
                      Total cost: ${(purchaseAmount * 1).toFixed(2)} USD
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Payment Method
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="credit_card">Credit Card</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="usdc">USDC</option>
                    </select>
                  </div>

                  <button
                    onClick={purchaseRcn}
                    disabled={purchasing || purchaseAmount < 100}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-4 px-6 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 transform hover:scale-105"
                  >
                    {purchasing ? 'Processing...' : `Purchase ${purchaseAmount} RCN for $${(purchaseAmount * 1).toFixed(2)}`}
                  </button>

                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <h4 className="text-sm font-medium text-blue-800 mb-2">💡 Why Purchase RCN?</h4>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>• Fund tier bonuses for your customers</li>
                      <li>• Bronze: +10 RCN, Silver: +20 RCN, Gold: +30 RCN</li>
                      <li>• Applied to repairs ≥ $50</li>
                      <li>• Increases customer loyalty and retention</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Purchase History */}
              <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
                <h3 className="text-xl font-bold text-gray-900 mb-6">Recent Purchases</h3>
                <div className="space-y-4">
                  {purchases.length > 0 ? (
                    purchases.slice(0, 5).map((purchase) => (
                      <div key={purchase.id} className="border border-gray-200 rounded-xl p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-gray-900">{purchase.amount} RCN</p>
                            <p className="text-sm text-gray-500">${purchase.totalCost.toFixed(2)} via {purchase.paymentMethod}</p>
                            <p className="text-xs text-gray-400">{new Date(purchase.createdAt).toLocaleDateString()}</p>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(purchase.status)}`}>
                            {purchase.status}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-4xl mb-4">📦</div>
                      <p className="text-gray-500">No purchases yet</p>
                      <p className="text-sm text-gray-400">Make your first RCN purchase to get started</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tier Bonuses Tab */}
        {activeTab === 'bonuses' && (
          <div className="space-y-8">
            {/* Tier Bonus Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
                <div className="text-center">
                  <div className="text-3xl mb-2">🏆</div>
                  <div className="text-3xl font-bold text-purple-600 mb-2">
                    {tierStats?.totalBonusesIssued || 0}
                  </div>
                  <p className="text-sm text-gray-500 font-medium">Total Bonuses</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
                <div className="text-center">
                  <div className="text-3xl mb-2">💎</div>
                  <div className="text-3xl font-bold text-indigo-600 mb-2">
                    {tierStats?.totalBonusAmount?.toFixed(0) || 0}
                  </div>
                  <p className="text-sm text-gray-500 font-medium">RCN Awarded</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
                <div className="text-center">
                  <div className="text-3xl mb-2">📊</div>
                  <div className="text-3xl font-bold text-green-600 mb-2">
                    {tierStats?.averageBonusPerTransaction?.toFixed(1) || 0}
                  </div>
                  <p className="text-sm text-gray-500 font-medium">Avg Bonus</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
                <div className="text-center">
                  <div className="text-3xl mb-2">⚡</div>
                  <div className="text-3xl font-bold text-orange-600 mb-2">
                    {((shopData?.purchasedRcnBalance || 0) / 20).toFixed(0)}
                  </div>
                  <p className="text-sm text-gray-500 font-medium">Bonuses Left</p>
                </div>
              </div>
            </div>

            {/* Tier Breakdown */}
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Tier Bonus Breakdown</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {['BRONZE', 'SILVER', 'GOLD'].map((tier) => {
                  const tierData = tierStats?.bonusesByTier?.[tier] || { count: 0, amount: 0 };
                  const bonusAmount = tier === 'BRONZE' ? 10 : tier === 'SILVER' ? 20 : 30;
                  
                  return (
                    <div key={tier} className={`p-6 rounded-xl border-2 ${
                      tier === 'BRONZE' ? 'bg-orange-50 border-orange-200' :
                      tier === 'SILVER' ? 'bg-gray-50 border-gray-200' :
                      'bg-yellow-50 border-yellow-200'
                    }`}>
                      <div className="text-center">
                        <div className="text-2xl mb-2">
                          {tier === 'BRONZE' ? '🥉' : tier === 'SILVER' ? '🥈' : '🥇'}
                        </div>
                        <h4 className={`font-bold text-lg mb-2 ${getTierColor(tier)}`}>
                          {tier}
                        </h4>
                        <p className="text-2xl font-bold text-gray-900 mb-1">
                          {tierData.count}
                        </p>
                        <p className="text-sm text-gray-600 mb-2">bonuses given</p>
                        <p className="text-lg font-semibold text-gray-800">
                          {tierData.amount} RCN awarded
                        </p>
                        <p className="text-xs text-gray-500 mt-2">
                          +{bonusAmount} RCN per repair ≥ $50
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* How Tier Bonuses Work */}
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">How Tier Bonuses Work</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h4 className="font-bold text-lg text-gray-900 mb-4">Automatic Application</h4>
                  <ul className="space-y-2 text-gray-600">
                    <li className="flex items-center">
                      <span className="text-green-500 mr-2">✓</span>
                      Applied to every repair ≥ $50
                    </li>
                    <li className="flex items-center">
                      <span className="text-green-500 mr-2">✓</span>
                      Based on customer's current tier
                    </li>
                    <li className="flex items-center">
                      <span className="text-green-500 mr-2">✓</span>
                      Deducted from your RCN balance
                    </li>
                    <li className="flex items-center">
                      <span className="text-green-500 mr-2">✓</span>
                      Increases customer loyalty
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-bold text-lg text-gray-900 mb-4">Balance Management</h4>
                  <ul className="space-y-2 text-gray-600">
                    <li className="flex items-center">
                      <span className="text-blue-500 mr-2">ℹ</span>
                      Maintain sufficient RCN balance
                    </li>
                    <li className="flex items-center">
                      <span className="text-blue-500 mr-2">ℹ</span>
                      Failed bonuses are logged for review
                    </li>
                    <li className="flex items-center">
                      <span className="text-blue-500 mr-2">ℹ</span>
                      Set up auto-purchase for convenience
                    </li>
                    <li className="flex items-center">
                      <span className="text-blue-500 mr-2">ℹ</span>
                      Monitor usage in analytics
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mt-6">
            <div className="flex">
              <div className="text-red-400 text-2xl mr-3">⚠️</div>
              <div>
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}