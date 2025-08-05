'use client';

import { useState, useEffect } from 'react';
import { ConnectButton, useActiveAccount } from "thirdweb/react";
import { createThirdwebClient } from "thirdweb";
import ThirdwebPayment from '../../components/ThirdwebPayment';

// Import our new components
import { OverviewTab } from '@/components/shop/OverviewTab';
import { PurchaseTab } from '@/components/shop/PurchaseTab';
import { BonusesTab } from '@/components/shop/BonusesTab';
import { AnalyticsTab } from '@/components/shop/AnalyticsTab';
import { RedeemTab } from '@/components/shop/RedeemTab';
import { IssueRewardsTab } from '@/components/shop/IssueRewardsTab';
import { CustomerLookupTab } from '@/components/shop/CustomerLookupTab';
import { SettingsTab } from '@/components/shop/SettingsTab';
import { TransactionsTab } from '@/components/shop/TransactionsTab';
import { CustomersTab } from '@/components/shop/CustomersTab';

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
  totalCost?: number;
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
  const [activeTab, setActiveTab] = useState<'overview' | 'purchase' | 'bonuses' | 'analytics' | 'redeem' | 'issue-rewards' | 'customers' | 'lookup' | 'transactions' | 'settings'>('overview');
  
  // Purchase form state
  const [purchaseAmount, setPurchaseAmount] = useState<number>(1);
  const [paymentMethod, setPaymentMethod] = useState<'usdc' | 'eth'>('usdc');
  const [purchasing, setPurchasing] = useState(false);
  
  // Payment flow state
  const [currentPurchaseId, setCurrentPurchaseId] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);

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
      
      // First, authenticate and get JWT token
      const authResponse = await fetch(`${apiUrl}/auth/shop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address: account?.address }),
      });

      if (authResponse.ok) {
        const authResult = await authResponse.json();
        // Store token for future requests
        localStorage.setItem('shopAuthToken', authResult.token);
        sessionStorage.setItem('shopAuthToken', authResult.token);
      } else if (authResponse.status === 403) {
        const errorData = await authResponse.json();
        setError(errorData.error || 'Shop authentication failed');
        setLoading(false);
        return;
      }
      
      // Load shop data
      const shopResponse = await fetch(`${apiUrl}/shops/wallet/${account?.address}`);
      
      if (shopResponse.ok) {
        const shopResult = await shopResponse.json();
        if (shopResult.success && shopResult.data) {
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
        } else {
          setError('Invalid shop data received');
        }
      } else if (shopResponse.status === 404) {
        setError(
          `Shop not found for wallet ${account?.address}. ` + 
          'Available test shop wallet: 0x7890123456789012345678901234567890123456 (shop001). ' +
          'Please switch to this wallet or register a new shop.'
        );
      }
    } catch (err) {
      console.error('Error loading shop data:', err);
      setError('Failed to load shop data');
    } finally {
      setLoading(false);
    }
  };

  const initiatePurchase = async () => {
    if (!shopData || !account?.address) {
      setError('Shop data not loaded or wallet not connected');
      return;
    }

    setPurchasing(true);
    setError(null);
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/shops/purchase/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shopId: shopData.shopId,
          amount: purchaseAmount,
          paymentMethod: paymentMethod
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Purchase initiation failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      // Set up payment flow
      setCurrentPurchaseId(result.data.purchaseId);
      setShowPayment(true);
      
    } catch (err) {
      console.error('Error initiating purchase:', err);
      setError(err instanceof Error ? err.message : 'Purchase initiation failed');
    } finally {
      setPurchasing(false);
    }
  };

  const handlePaymentSuccess = async () => {
    setShowPayment(false);
    setCurrentPurchaseId(null);
    
    // Show success message
    alert(`✅ Payment successful! ${purchaseAmount} RCN has been added to your balance.`);
    
    // Reload shop data to show updated balance
    await loadShopData();
  };

  const handlePaymentError = (error: string) => {
    setError(`Payment failed: ${error}`);
  };

  const cancelPayment = () => {
    setShowPayment(false);
    setCurrentPurchaseId(null);
  };

  // Not connected state
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

  // Loading state
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

  // Error state (shop not found)
  if (error && !shopData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="text-center">
            <div className="text-red-500 text-4xl mb-4">🚫</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Shop Not Found</h3>
            <p className="text-gray-600 mb-6">{error}</p>
            <a 
              href="/shop/register"
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-3 px-4 rounded-xl transition duration-200 transform hover:scale-105 inline-block"
            >
              Register Shop
            </a>
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

  // Pending application state
  if (shopData && !shopData.verified && !shopData.active) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="text-center">
            <div className="text-yellow-500 text-4xl mb-4">⏳</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Application Pending</h3>
            <p className="text-gray-600 mb-6">
              Your shop registration has been submitted and is awaiting admin verification. 
              You'll be able to access the full dashboard once approved.
            </p>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Shop Name:</span>
                <span className="font-medium text-gray-900">{shopData.name}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-gray-600">Shop ID:</span>
                <span className="font-medium text-gray-900">{shopData.shopId}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-gray-600">Status:</span>
                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                  Pending Verification
                </span>
              </div>
            </div>

            <div className="text-sm text-gray-500 mb-6">
              <p>What happens next:</p>
              <ul className="mt-2 text-left space-y-1">
                <li>• Admin reviews your application</li>
                <li>• Shop verification process</li>
                <li>• Dashboard access granted</li>
                <li>• RCN purchasing enabled</li>
              </ul>
            </div>

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

  // Main dashboard
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
          <div className="flex flex-wrap gap-1">
            {[
              { id: 'overview', label: 'Overview', icon: '📊' },
              { id: 'issue-rewards', label: 'Issue Rewards', icon: '🎁' },
              { id: 'redeem', label: 'Redeem', icon: '💸' },
              { id: 'customers', label: 'Customers', icon: '👥' },
              { id: 'lookup', label: 'Lookup', icon: '🔍' },
              { id: 'purchase', label: 'Buy RCN', icon: '💰' },
              { id: 'transactions', label: 'Transactions', icon: '📋' },
              { id: 'bonuses', label: 'Bonuses', icon: '🏆' },
              { id: 'analytics', label: 'Analytics', icon: '📈' },
              { id: 'settings', label: 'Settings', icon: '⚙️' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${
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

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <OverviewTab shopData={shopData} purchases={purchases} />
        )}

        {activeTab === 'purchase' && (
          <PurchaseTab
            purchaseAmount={purchaseAmount}
            setPurchaseAmount={setPurchaseAmount}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            purchasing={purchasing}
            purchases={purchases}
            onInitiatePurchase={initiatePurchase}
          />
        )}

        {activeTab === 'bonuses' && (
          <BonusesTab tierStats={tierStats} shopData={shopData} />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsTab 
            shopData={shopData} 
            tierStats={tierStats} 
            purchases={purchases} 
          />
        )}

        {activeTab === 'redeem' && shopData && (
          <RedeemTab 
            shopId={shopData.shopId} 
            onRedemptionComplete={loadShopData}
          />
        )}

        {activeTab === 'issue-rewards' && shopData && (
          <IssueRewardsTab 
            shopId={shopData.shopId}
            shopData={shopData}
            onRewardIssued={loadShopData}
          />
        )}

        {activeTab === 'customers' && shopData && (
          <CustomersTab shopId={shopData.shopId} />
        )}

        {activeTab === 'lookup' && shopData && (
          <CustomerLookupTab shopId={shopData.shopId} />
        )}

        {activeTab === 'transactions' && shopData && (
          <TransactionsTab shopId={shopData.shopId} />
        )}

        {activeTab === 'settings' && shopData && (
          <SettingsTab 
            shopId={shopData.shopId}
            shopData={shopData}
            onSettingsUpdate={loadShopData}
          />
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

        {/* Payment Modal */}
        {showPayment && currentPurchaseId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="max-w-md w-full">
              <ThirdwebPayment
                purchaseId={currentPurchaseId}
                amount={purchaseAmount}
                totalCost={purchaseAmount * 0.10} // $0.10 per RCN
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
                onCancel={cancelPayment}
              />
              
              {/* Cancel Button */}
              <div className="mt-4 text-center">
                <button
                  onClick={cancelPayment}
                  className="text-gray-500 hover:text-gray-700 text-sm"
                >
                  Cancel Payment
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}