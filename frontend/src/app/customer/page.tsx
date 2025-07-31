'use client';

import { useState, useEffect } from 'react';
import { ConnectButton, useReadContract } from "thirdweb/react";
import { getContract, createThirdwebClient } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'next/navigation';

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "1969ac335e07ba13ad0f8d1a1de4f6ab",
});

const contract = getContract({
  client,
  chain: baseSepolia,
  address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!,
});

interface CustomerStats {
  totalTokensEarned: number;
  totalTokensRedeemed: number;
  totalRepairs: number;
  favoriteShops: string[];
}

export default function CustomerDashboard() {
  const router = useRouter();
  const { account, userProfile, isLoading, isAuthenticated } = useAuth();
  const [customerStats, setCustomerStats] = useState<CustomerStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read token balance from contract
  const { data: tokenBalance, isLoading: balanceLoading } = useReadContract({
    contract,
    method: "function balanceOf(address) view returns (uint256)",
    params: account?.address ? [account.address] : undefined,
  });

  const fetchCustomerStats = async () => {
    if (!userProfile?.id) return;

    setLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/customers/${userProfile.id}/stats`);
      if (response.ok) {
        const data = await response.json();
        setCustomerStats(data.stats);
      }
    } catch (err) {
      console.error('Error fetching customer stats:', err);
      setError('Failed to load customer statistics');
    } finally {
      setLoading(false);
    }
  };

  const formatBalance = (balance: bigint | undefined): string => {
    if (!balance) return '0';
    return (Number(balance) / 1e18).toFixed(2);
  };

  const getTierColor = (tier: string): string => {
    switch (tier) {
      case 'bronze': return 'bg-orange-100 text-orange-800';
      case 'silver': return 'bg-gray-100 text-gray-800';
      case 'gold': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTierEmoji = (tier: string): string => {
    switch (tier) {
      case 'bronze': return '🥉';
      case 'silver': return '🥈';
      case 'gold': return '🥇';
      default: return '🏆';
    }
  };

  // Fetch customer statistics
  useEffect(() => {
    if (userProfile?.id) {
      fetchCustomerStats();
    }
  }, [userProfile?.id]);

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

  if (!userProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center">
          <div className="text-6xl mb-6">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">You need to be registered as a customer to access this page.</p>
        </div>
      </div>
    );
  }

  // Check if customer is suspended
  if (userProfile && !userProfile.isActive) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-pink-100">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center">
          <div className="text-6xl mb-6">🚫</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Account Suspended</h1>
          <p className="text-gray-600 mb-6">
            Your account has been suspended. You cannot perform any token transactions while suspended.
          </p>
          {userProfile.suspensionReason && (
            <div className="bg-red-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-800 font-medium">Reason:</p>
              <p className="text-sm text-red-700">{userProfile.suspensionReason}</p>
            </div>
          )}
          <button 
            onClick={async () => {
              const reason = prompt('Please provide a reason for your unsuspend request:');
              if (!reason || reason.trim().length === 0) {
                alert('Please provide a reason for your request');
                return;
              }

              try {
                const response = await fetch(`/api/customers/${address}/request-unsuspend`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                  },
                  body: JSON.stringify({ reason })
                });

                const data = await response.json();
                
                if (response.ok) {
                  alert('Your unsuspend request has been submitted successfully. An admin will review it soon.');
                } else {
                  alert(data.error || 'Failed to submit unsuspend request');
                }
              } catch (error) {
                console.error('Error submitting unsuspend request:', error);
                alert('Failed to submit unsuspend request. Please try again.');
              }
            }}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Request Unsuspend
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8 border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="text-2xl">👤</div>
                <h1 className="text-2xl font-bold text-gray-900">Customer Dashboard</h1>
              </div>
              <p className="text-gray-600 mb-2">Welcome back, {userProfile.name || 'Customer'}!</p>
              <p className="text-gray-500 text-sm font-mono bg-gray-50 px-3 py-1 rounded-lg inline-block">
                {account?.address?.slice(0, 6)}...{account?.address?.slice(-4)}
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

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Token Balance */}
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
            <div className="text-center">
              <div className="text-3xl mb-2">💰</div>
              <div className="text-3xl font-bold text-blue-600 mb-2">
                {balanceLoading ? '...' : formatBalance(tokenBalance)}
              </div>
              <p className="text-sm text-gray-500 font-medium">RCN Balance</p>
            </div>
          </div>

          {/* Customer Tier */}
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
            <div className="text-center">
              <div className="text-3xl mb-2">{getTierEmoji(userProfile.tier || 'bronze')}</div>
              <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-bold ${getTierColor(userProfile.tier || 'bronze')}`}>
                {(userProfile.tier || 'bronze').toUpperCase()}
              </div>
              <p className="text-sm text-gray-500 mt-2">Your Tier Level</p>
            </div>
          </div>

          {/* Total Repairs */}
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
            <div className="text-center">
              <div className="text-3xl mb-2">🔧</div>
              <div className="text-3xl font-bold text-green-600 mb-2">
                {customerStats?.totalRepairs || 0}
              </div>
              <p className="text-sm text-gray-500 font-medium">Total Repairs</p>
            </div>
          </div>
        </div>

        {/* Earnings Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Token Summary</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Tokens Earned:</span>
                <span className="font-bold text-green-600">
                  {customerStats?.totalTokensEarned || 0} RCN
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Tokens Redeemed:</span>
                <span className="font-bold text-red-600">
                  -{customerStats?.totalTokensRedeemed || 0} RCN
                </span>
              </div>
              <hr className="border-gray-200" />
              <div className="flex justify-between items-center">
                <span className="text-gray-900 font-semibold">Current Balance:</span>
                <span className="font-bold text-blue-600">
                  {balanceLoading ? '...' : formatBalance(tokenBalance)} RCN
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Tier Benefits</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                <span className="text-sm text-gray-600">
                  {userProfile.tier === 'bronze' && 'Earn +10 RCN bonus per repair'}
                  {userProfile.tier === 'silver' && 'Earn +20 RCN bonus per repair'}
                  {userProfile.tier === 'gold' && 'Earn +30 RCN bonus per repair'}
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
            </div>
          </div>
        </div>

        {/* How to Earn More */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
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
                Bronze: 0-99 RCN earned<br />
                Silver: 100-499 RCN earned<br />
                Gold: 500+ RCN earned
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}