'use client';

import { useState, useEffect } from 'react';
import { ConnectButton, useReadContract } from "thirdweb/react";
import { getContract, createThirdwebClient } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'next/navigation';
import { SimpleUnsuspendModal } from '../../components/SimpleUnsuspendModal';

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "1969ac335e07ba13ad0f8d1a1de4f6ab",
});

const contract = getContract({
  client,
  chain: baseSepolia,
  address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!,
});

interface CustomerData {
  address: string;
  name?: string;
  tier: 'BRONZE' | 'SILVER' | 'GOLD';
  lifetimeEarnings: number;
  currentBalance: number;
  totalRedemptions: number;
  dailyEarnings: number;
  monthlyEarnings: number;
  isActive: boolean;
  suspensionReason?: string;
  lastEarnedDate?: string;
  joinDate: string;
}

interface EarnedBalanceData {
  earnedBalance: number;
  marketBalance: number;
  totalBalance: number;
}

interface TransactionHistory {
  id: string;
  type: 'earned' | 'redeemed' | 'bonus' | 'referral';
  amount: number;
  shopId?: string;
  shopName?: string;
  description: string;
  createdAt: string;
}

export default function CustomerDashboard() {
  const router = useRouter();
  const { account, userProfile, isLoading, isAuthenticated } = useAuth();
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [earnedBalanceData, setEarnedBalanceData] = useState<EarnedBalanceData | null>(null);
  const [transactions, setTransactions] = useState<TransactionHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUnsuspendModal, setShowUnsuspendModal] = useState(false);

  // Read token balance from contract
  const { data: tokenBalance, isLoading: balanceLoading } = useReadContract({
    contract,
    method: "function balanceOf(address) view returns (uint256)",
    params: account?.address ? [account.address] : undefined,
  });

  const fetchCustomerData = async () => {
    if (!account?.address) return;

    setLoading(true);
    setError(null);
    
    try {
      // Fetch customer data
      const customerResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/customers/${account.address}`);
      if (customerResponse.ok) {
        const customerResult = await customerResponse.json();
        console.log('Customer data from API:', customerResult.data);
        // Extract the customer object from the response
        const customerData = customerResult.data.customer || customerResult.data;
        setCustomerData(customerData);
      } else if (customerResponse.status === 404) {
        // Customer not found - they need to register
        router.push('/customer/register');
        return;
      }

      // Fetch earned balance data
      const balanceResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tokens/earned-balance/${account.address}`);
      if (balanceResponse.ok) {
        const balanceResult = await balanceResponse.json();
        setEarnedBalanceData(balanceResult.data);
      }

      // Fetch recent transactions
      const transactionsResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/customers/${account.address}/transactions?limit=10`);
      if (transactionsResponse.ok) {
        const transactionsResult = await transactionsResponse.json();
        setTransactions(transactionsResult.data?.transactions || []);
      }
    } catch (err) {
      console.error('Error fetching customer data:', err);
      setError('Failed to load customer data');
    } finally {
      setLoading(false);
    }
  };

  const formatBalance = (balance: bigint | undefined): string => {
    if (!balance) return '0';
    return (Number(balance) / 1e18).toFixed(2);
  };

  const getTierColor = (tier: string): string => {
    switch (tier.toUpperCase()) {
      case 'BRONZE': return 'bg-orange-100 text-orange-800';
      case 'SILVER': return 'bg-gray-100 text-gray-800';
      case 'GOLD': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTierEmoji = (tier: string): string => {
    switch (tier.toUpperCase()) {
      case 'BRONZE': return '🥉';
      case 'SILVER': return '🥈';
      case 'GOLD': return '🥇';
      default: return '🏆';
    }
  };

  const getNextTier = (currentTier: string): { tier: string; requirement: number } => {
    switch (currentTier.toUpperCase()) {
      case 'BRONZE':
        return { tier: 'SILVER', requirement: 200 };
      case 'SILVER':
        return { tier: 'GOLD', requirement: 1000 };
      case 'GOLD':
        return { tier: 'GOLD', requirement: 0 };
      default:
        return { tier: 'SILVER', requirement: 200 };
    }
  };

  // Fetch customer data
  useEffect(() => {
    if (account?.address) {
      fetchCustomerData();
    }
  }, [account?.address]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!customerData && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center">
          <div className="text-6xl mb-6">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Loading Customer Data</h1>
          <p className="text-gray-600">Please wait while we load your information...</p>
        </div>
      </div>
    );
  }

  // Check if customer is suspended
  if (customerData && !customerData.isActive) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-100">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center">
            <div className="text-6xl mb-6">🚫</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Account Suspended</h1>
            <p className="text-gray-600 mb-6">
              Your account has been suspended. You cannot perform any token transactions while suspended.
            </p>
            {customerData.suspensionReason && (
              <div className="bg-red-50 rounded-lg p-4 mb-6">
                <p className="text-sm text-red-800 font-medium">Reason:</p>
                <p className="text-sm text-red-700">{customerData.suspensionReason}</p>
              </div>
            )}
            <button 
              onClick={() => setShowUnsuspendModal(true)}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Request Unsuspend
            </button>
          </div>
        </div>

        {/* Unsuspend Request Modal */}
        <SimpleUnsuspendModal
          isOpen={showUnsuspendModal}
          onClose={() => setShowUnsuspendModal(false)}
          customerAddress={account?.address || ''}
          onSuccess={() => {
            setShowUnsuspendModal(false);
            // Optionally refresh customer data
            fetchCustomerData();
          }}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen py-8 bg-[#0D0D0D]" style={{ backgroundImage: `url('/cus-dash-chain.png')` }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="relative p-6 mb-8 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className='flex items-center gap-3 mb-2'>
              <div className="flex items-center w-[80px] h-[80px] p-2 gap-3 mb-2">
                <img src="/avatar1.png" alt="" />
              </div>
              <p className="text-gray-600 mb-2">Welcome back, {customerData?.name || 'Customer'}!</p>
              <p className="text-gray-500 text-sm font-mono bg-gray-50 px-3 py-1 rounded-lg inline-block">
                {account?.address?.slice(0, 6)}...{account?.address?.slice(-4)}
              </p>
            </div>
            <div className="mt-4 sm:mt-0">
              <ConnectButton
                client={client}
                connectModal={{ size: "compact" }}
              />
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Token Balance */}
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
            <div className="text-center">
              <div className="text-3xl mb-2">💰</div>
              <div className="text-3xl font-bold text-blue-600 mb-2">
                {earnedBalanceData?.totalBalance || customerData?.currentBalance || 0}
              </div>
              <p className="text-sm text-gray-500 font-medium">Total RCN Balance</p>
              {earnedBalanceData && earnedBalanceData.marketBalance > 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  {earnedBalanceData.earnedBalance} earned, {earnedBalanceData.marketBalance} bought
                </p>
              )}
            </div>
          </div>

          {/* Customer Tier */}
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
            <div className="text-center">
              <div className="text-3xl mb-2">{getTierEmoji(customerData?.tier || 'BRONZE')}</div>
              <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-bold ${getTierColor(customerData?.tier || 'BRONZE')}`}>
                {customerData?.tier || 'BRONZE'}
              </div>
              <p className="text-sm text-gray-500 mt-2">Your Tier Level</p>
              {customerData && customerData.tier !== 'GOLD' && (
                <p className="text-xs text-gray-400 mt-1">
                  {getNextTier(customerData.tier).requirement - customerData.lifetimeEarnings} RCN to {getNextTier(customerData.tier).tier}
                </p>
              )}
            </div>
          </div>

          {/* Lifetime Earnings */}
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
            <div className="text-center">
              <div className="text-3xl mb-2">⭐</div>
              <div className="text-3xl font-bold text-green-600 mb-2">
                {customerData?.lifetimeEarnings || 0}
              </div>
              <p className="text-sm text-gray-500 font-medium">Lifetime RCN Earned</p>
            </div>
          </div>
        </div>

        {/* Earnings Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Token Summary</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Lifetime Earned:</span>
                <span className="font-bold text-green-600">
                  {customerData?.lifetimeEarnings || 0} RCN
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Total Redeemed:</span>
                <span className="font-bold text-red-600">
                  -{customerData?.totalRedemptions || 0} RCN
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Redeemable Balance:</span>
                <span className="font-medium text-blue-600">
                  {earnedBalanceData?.earnedBalance || 0} RCN
                </span>
              </div>
              <hr className="border-gray-200" />
              <div className="flex justify-between items-center">
                <span className="text-gray-900 font-semibold">Total Balance:</span>
                <span className="font-bold text-blue-600">
                  {earnedBalanceData?.totalBalance || customerData?.currentBalance || 0} RCN
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Tier Benefits & Limits</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span className="text-sm text-gray-600">
                  {customerData?.tier === 'BRONZE' && 'Earn +10 RCN bonus per repair'}
                  {customerData?.tier === 'SILVER' && 'Earn +20 RCN bonus per repair'}
                  {customerData?.tier === 'GOLD' && 'Earn +30 RCN bonus per repair'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span className="text-sm text-gray-600">Cross-shop redemption (20% limit)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span className="text-sm text-gray-600">Referral bonuses available</span>
              </div>
              <hr className="border-gray-200 my-3" />
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Daily Limit:</span>
                  <span className="font-medium">
                    {customerData?.dailyEarnings || 0} / 40 RCN
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Monthly Limit:</span>
                  <span className="font-medium">
                    {customerData?.monthlyEarnings || 0} / 500 RCN
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        {transactions.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Recent Transactions</h2>
            <div className="space-y-3">
              {transactions.slice(0, 5).map((transaction) => (
                <div key={transaction.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{transaction.description}</p>
                    {transaction.shopName && (
                      <p className="text-sm text-gray-500">at {transaction.shopName}</p>
                    )}
                    <p className="text-xs text-gray-400">
                      {new Date(transaction.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className={`font-bold ${
                    transaction.type === 'redeemed' ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {transaction.type === 'redeemed' ? '-' : '+'}{transaction.amount} RCN
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* How to Earn More */}
        {/* <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">How to Earn More RCN</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
              <div className="text-4xl mb-4">🔧</div>
              <h3 className="font-bold text-gray-900 mb-3">Complete Repairs</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Earn 10 RCN for $50-99 repairs<br />
                Earn 25 RCN for $100+ repairs<br />
                Plus tier bonuses!
              </p>
            </div>
            <div className="text-center p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100">
              <div className="text-4xl mb-4">👥</div>
              <h3 className="font-bold text-gray-900 mb-3">Refer Friends</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Earn 25 RCN for each successful referral<br />
                New customers get 10 RCN bonus<br />
                No limit on referrals!
              </p>
            </div>
            <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-100">
              <div className="text-4xl mb-4">⬆️</div>
              <h3 className="font-bold text-gray-900 mb-3">Upgrade Your Tier</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Bronze: 0-199 RCN earned<br />
                Silver: 200-999 RCN earned<br />
                Gold: 1000+ RCN earned
              </p>
            </div>
          </div>
        </div> */}
      </div>
    </div>
  );
}