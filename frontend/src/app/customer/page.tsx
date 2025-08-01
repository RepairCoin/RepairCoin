'use client';

import { useState, useEffect } from 'react';
import { ConnectButton, useReadContract } from "thirdweb/react";
import { getContract, createThirdwebClient } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'next/navigation';
import { SimpleUnsuspendModal } from '../../components/SimpleUnsuspendModal';
import CommunityBanner from '@/components/CommunityBanner';

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

  // if (!customerData && !loading) {
  //   return (
  //     <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
  //       <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center">
  //         <div className="text-6xl mb-6">⚠️</div>
  //         <h1 className="text-2xl font-bold text-gray-900 mb-4">Loading Customer Data</h1>
  //         <p className="text-gray-600">Please wait while we load your information...</p>
  //       </div>
  //     </div>
  //   );
  // }

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
        <div className="relative p-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className='flex items-center gap-4'>
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-yellow-400">
                <img
                  src="/avatar1.png"
                  alt="User Avatar"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = '/default-avatar.png';
                  }}
                />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Welcome back, {customerData?.name?.split(' ')[0] || 'Customer'}</h1>
                <p className="text-gray-400 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                  {customerData?.email || account?.address || 'user@example.com'}
                </p>
              </div>
            </div>
            <div className="mt-4 sm:mt-0">
              <button
                className="bg-yellow-400 hover:bg-yellow-500 text-black font-medium py-2 px-6 rounded-lg flex items-center gap-2 transition-colors"
                onClick={() => {
                  const connectButton = document.querySelector('button[data-testid="rk-connect-button"]') as HTMLButtonElement;
                  if (connectButton) {
                    connectButton.click();
                  } else {
                    // Fallback to window.ethereum if available
                    if (typeof window.ethereum !== 'undefined') {
                      window.ethereum.request({ method: 'eth_requestAccounts' });
                    }
                  }
                }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                {account?.address ?
                  `${account.address.slice(0, 6)}...${account.address.slice(-4)}` :
                  'Connect Wallet'}
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* RCN Balance Card */}
          <div className="bg-gray-900 rounded-2xl p-6 shadow-lg flex justify-between items-center">
            <div>
              <p className="text-yellow-400 text-sm font-medium mb-1">RCN Balance</p>
              <p className="text-white text-2xl font-bold">{earnedBalanceData?.totalBalance || customerData?.currentBalance || 0} RCN</p>
              {earnedBalanceData && earnedBalanceData.marketBalance > 0 && (
                <p className="text-gray-400 text-xs mt-1">
                  {earnedBalanceData.earnedBalance} earned, {earnedBalanceData.marketBalance} bought
                </p>
              )}
            </div>
            <div className="bg-yellow-400 rounded-lg p-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 3h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2zm5 4a1 1 0 100-2 1 1 0 000 2zm0 4a1 1 0 100-2 1 1 0 000 2zm0 4a1 1 0 100-2 1 1 0 000 2z" />
              </svg>
            </div>
          </div>

          {/* Customer Tier Card */}
          <div className="bg-gray-900 rounded-2xl p-6 shadow-lg flex justify-between items-center">
            <div>
              <p className="text-yellow-400 text-sm font-medium mb-1">Your Tier Level</p>
              <p className="text-white text-2xl font-bold">{customerData?.tier || 'SILVER'}</p>
              {customerData && customerData.tier !== 'GOLD' && (
                <p className="text-gray-400 text-xs mt-1">
                  {getNextTier(customerData.tier).requirement - customerData.lifetimeEarnings} RCN to {getNextTier(customerData.tier).tier}
                </p>
              )}
            </div>
            <div className="bg-yellow-400 rounded-lg p-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V5a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2h-5a2 2 0 00-2 2v6z" />
              </svg>
            </div>
          </div>

          {/* Total Repairs Card */}
          <div className="bg-gray-900 rounded-2xl p-6 shadow-lg flex justify-between items-center">
            <div>
              <p className="text-yellow-400 text-sm font-medium mb-1">Total Repairs</p>
              <p className="text-white text-2xl font-bold">4</p>
            </div>
            <div className="bg-yellow-400 rounded-lg p-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Earnings Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Token Summary Card */}
          <div className="bg-gray-900 rounded-2xl p-6 shadow-lg">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-yellow-400 text-lg font-bold">Token Summary</h3>
              <div className="bg-yellow-400 rounded-lg p-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-black" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                  <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Tokens Earned:</span>
                <span className="font-bold text-green-500">
                  {customerData?.lifetimeEarnings || 0} RCN
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Tokens Redeemed:</span>
                <span className="font-bold text-red-500">
                  -{customerData?.totalRedemptions || 0} RCN
                </span>
              </div>
              <div className="h-px bg-gray-700 my-3"></div>
              <div className="flex justify-between items-center">
                <span className="text-gray-300 font-medium">Current Balance:</span>
                <span className="font-bold text-yellow-400">
                  {earnedBalanceData?.totalBalance || customerData?.currentBalance || 0} RCN
                </span>
              </div>
            </div>
          </div>

          {/* Tier Benefits Card */}
          <div className="bg-gray-900 rounded-2xl p-6 shadow-lg">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-yellow-400 text-lg font-bold">Tier Benefits</h3>
              <div className="bg-yellow-400 rounded-lg p-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-black" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <svg className="h-5 w-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-300">All {customerData?.tier || 'Bronze'} Benefits</span>
              </div>
              <div className="flex items-center gap-3">
                <svg className="h-5 w-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-300">Cross Shop Redemption</span>
              </div>
              <div className="flex items-center gap-3">
                <svg className="h-5 w-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-300">Referral Bonus Available</span>
              </div>
              <div className="flex items-center gap-3">
                <svg className="h-5 w-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-300">Early Access to Promos</span>
              </div>
              <div className="flex items-center gap-3">
                <svg className="h-5 w-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-gray-300">Priority Support Access</span>
              </div>
              <div className="flex justify-end mt-4">
                <a href="#" className="text-yellow-400 text-sm font-medium hover:underline flex items-center">
                  Learn More <span className="ml-1">→</span>
                </a>
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
                  <div className={`font-bold ${transaction.type === 'redeemed' ? 'text-red-600' : 'text-green-600'
                    }`}>
                    {transaction.type === 'redeemed' ? '-' : '+'}{transaction.amount} RCN
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Banner */}
        <div
          className="w-full mx-auto bg-black/70 rounded-2xl overflow-hidden my-40"
          style={{ backgroundImage: `url('/banner-chain.png')` }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-8 pt-12">
            {/* Left Column - Content */}
            <div className="flex flex-col justify-between pb-12">
              {/* Logo and Tagline */}
              <div className="flex flex-col space-x-3 mb-8">
                <div>
                  <img
                    src="/community-logo.png"
                    alt="RepairCoin Logo"
                    className="h-10 w-auto"
                  />
                </div>
                <span className="text-[#FFCC00] text-sm font-medium">
                  The Repair Industry's Loyalty Coin
                </span>
              </div>

              {/* Main Heading */}
              <p className="text-xl md:text-3xl font-bold text-white leading-tight">
                Join the Growing Community!{" "}
                <span className="text-[#FFCC00]">Earning</span> while
                repairing.
              </p>

              {/* CTA Button */}
              <button className="bg-[#FFCC00] hover:bg-yellow-400 text-gray-900 font-semibold px-8 py-3 rounded-full transition-all duration-300 transform hover:scale-105 w-max">
                Sign Up Now <span className="ml-2 text-sm md:text-lg">→</span>
              </button>
            </div>

            {/* Right Column - Placeholder for Image/Illustration */}
            <div className="flex items-center justify-center">
              <div className="relative w-full h-64 md:h-80 rounded-xl flex items-center justify-center">
                <img src="/people.png" alt="Community Banner" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}