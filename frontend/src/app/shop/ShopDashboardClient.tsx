'use client';

import { useState, useEffect } from 'react';
import { ConnectButton, useActiveAccount } from "thirdweb/react";
import { createThirdwebClient, getContract, readContract } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";
import { useSearchParams } from 'next/navigation';
import DashboardLayout from "@/components/ui/DashboardLayout";
import ThirdwebPayment from '../../components/ThirdwebPayment';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Import our new components
import { OverviewTab } from '@/components/shop/OverviewTab';
import { PurchaseTab } from '@/components/shop/PurchaseTab';
import { BonusesTab } from '@/components/shop/BonusesTab';
import { AnalyticsTab } from '@/components/shop/AnalyticsTab';
import { RedeemTabV2 } from '@/components/shop/RedeemTabV2';
import { IssueRewardsTab } from '@/components/shop/IssueRewardsTab';
import { CustomerLookupTab } from '@/components/shop/CustomerLookupTab';
import { SettingsTab } from '@/components/shop/SettingsTab';
import { TransactionsTab } from '@/components/shop/TransactionsTab';
import { CustomersTab } from '@/components/shop/CustomersTab';
import { useShopRegistration } from '@/hooks/useShopRegistration';

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

export default function ShopDashboardClient() {
  const account = useActiveAccount();
  const searchParams = useSearchParams();
  const {
    existingApplication,
  } = useShopRegistration();
  const [shopData, setShopData] = useState<ShopData | null>(null);
  const [purchases, setPurchases] = useState<PurchaseHistory[]>([]);
  const [tierStats, setTierStats] = useState<TierBonusStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'purchase' | 'bonuses' | 'analytics' | 'redeem' | 'issue-rewards' | 'customers' | 'lookup' | 'transactions' | 'settings'>('overview');
  const [blockchainBalance, setBlockchainBalance] = useState<number>(0);
  
  // Purchase form state
  const [purchaseAmount, setPurchaseAmount] = useState<number>(1);
  const [paymentMethod, setPaymentMethod] = useState<'usdc' | 'eth'>('usdc');
  const [purchasing, setPurchasing] = useState(false);
  
  // Payment flow state
  const [currentPurchaseId, setCurrentPurchaseId] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  
  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    // Set active tab from URL query param
    const tab = searchParams.get('tab');
    if (tab) {
      setActiveTab(tab as any); 
    }
  }, [searchParams]);

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
        console.log('Shop authenticated successfully');
      } else if (authResponse.status === 403) {
        const errorData = await authResponse.json();
        setError(errorData.error || 'Shop authentication failed');
        setLoading(false);
        return;
      } else {
        console.error('Shop auth failed:', authResponse.status);
        setError('Authentication failed. Please try again.');
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

            // Fetch blockchain balance
            if (shopResult.data.walletAddress) {
              try {
                const contract = getContract({
                  client,
                  chain: baseSepolia,
                  address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
                });
                
                const balance = await readContract({
                  contract,
                  method: "function balanceOf(address account) view returns (uint256)",
                  params: [shopResult.data.walletAddress as `0x${string}`],
                });
                
                const rcnBalance = Number(balance) / 10**18;
                setBlockchainBalance(rcnBalance);
              } catch (error) {
                console.error('Error fetching blockchain balance:', error);
                setBlockchainBalance(0);
              }
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
      console.log('Initiating purchase:', {
        shopId: shopData.shopId,
        amount: purchaseAmount,
        paymentMethod: paymentMethod
      });

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

      const responseData = await response.json();
      console.log('Purchase initiation response:', { 
        status: response.status, 
        data: responseData 
      });

      if (!response.ok) {
        const errorMessage = responseData.error || `HTTP ${response.status}: ${response.statusText}`;
        console.error('Purchase initiation failed:', errorMessage);
        throw new Error(errorMessage);
      }

      const purchaseId = responseData.data?.purchaseId;
      if (!purchaseId) {
        throw new Error('No purchase ID received from server');
      }
      
      console.log('Purchase initiated successfully:', { purchaseId });
      
      // Set up payment flow
      setCurrentPurchaseId(purchaseId);
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
    
    // Show success message using custom modal
    setSuccessMessage(`✅ Payment successful! ${purchaseAmount} distribution credits have been added to your account.`);
    setShowSuccessModal(true);
    
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

  // Error state (shop not found)
  if (error && !shopData && !existingApplication.hasApplication) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D] py-32">
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

  // Not connected state
  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D] py-32">
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

  if (existingApplication.hasApplication && !shopData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0D0D0D] py-32">
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
                <span className="font-medium text-gray-900">{existingApplication.shopName}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-gray-600">Shop ID:</span>
                <span className="font-medium text-gray-900">{existingApplication.shopId}</span>
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

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as any);
  };

  // Main dashboard
  return (
    <DashboardLayout userRole="shop" activeTab={activeTab} onTabChange={handleTabChange}>
      <div
        className="min-h-screen py-8 bg-[#0D0D0D]"
        style={{
          backgroundImage: `url('/img/dashboard-bg.png')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="max-w-screen-2xl w-[96%] mx-auto">
          {/* Tab Content */}
          {activeTab === 'overview' && (
            <OverviewTab shopData={shopData} purchases={purchases} blockchainBalance={blockchainBalance} />
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
            <RedeemTabV2 
              shopId={shopData.shopId} 
              onRedemptionComplete={loadShopData}
            />
          )}

          {activeTab === 'issue-rewards' && shopData && (
            <IssueRewardsTab 
              shopId={shopData.shopId}
              shopData={{
                ...shopData,
                purchasedRcnBalance: blockchainBalance // Use blockchain balance for tier bonus calculations
              }}
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
            <div className="bg-red-900 bg-opacity-90 border border-red-700 rounded-lg p-4 mt-6">
              <div className="flex">
                <div className="text-red-400 text-2xl mr-3">⚠️</div>
                <div>
                  <h3 className="text-sm font-medium text-red-300">Error</h3>
                  <div className="mt-2 text-sm text-red-200">{error}</div>
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
                    className="text-gray-400 hover:text-gray-300 text-sm"
                  >
                    Cancel Payment
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Success Modal */}
          <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-2xl text-center">Payment Successful!</DialogTitle>
                <DialogDescription className="text-center text-lg pt-4">
                  {successMessage}
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-center py-6">
                <div className="text-6xl animate-bounce">🎉</div>
              </div>
              <DialogFooter className="sm:justify-center">
                <Button 
                  onClick={() => setShowSuccessModal(false)}
                  className="bg-green-600 hover:bg-green-700 text-white px-8"
                >
                  Continue
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </DashboardLayout>
  );
}