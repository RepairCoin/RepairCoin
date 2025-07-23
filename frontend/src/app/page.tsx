'use client';

import { useState, useEffect } from 'react';
import { ConnectButton, useActiveAccount, useReadContract } from "thirdweb/react";
import { getContract, createThirdwebClient } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";

// Initialize Thirdweb client
const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "1969ac335e07ba13ad0f8d1a1de4f6ab",
});

// Debug: Check if client ID is loaded
console.log('Thirdweb Client ID:', process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID);
console.log('Using client ID:', process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "1969ac335e07ba13ad0f8d1a1de4f6ab");

const contract = getContract({
  client,
  chain: baseSepolia,
  address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!,
});

interface CustomerData {
  address: string;
  tier: 'BRONZE' | 'SILVER' | 'GOLD';
  lifetimeEarnings: number;
  dailyEarnings: number;
  monthlyEarnings: number;
}

export default function CustomerWallet() {
  const account = useActiveAccount();
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read token balance from contract
  const { data: tokenBalance, isLoading: balanceLoading } = useReadContract({
    contract,
    method: "function balanceOf(address) view returns (uint256)",
    params: account?.address ? [account.address] : undefined,
  });

  // Fetch customer data when wallet connects
  useEffect(() => {
    if (account?.address) {
      fetchCustomerData(account.address);
    }
  }, [account?.address]);

  const fetchCustomerData = async (address: string) => {
    setLoading(true);
    setError(null);

    try {
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/customers/${address}`;
      console.log('Fetching customer data from:', apiUrl);
      
      const response = await fetch(apiUrl);
      console.log('Response status:', response.status);

      if (!response.ok) {
        if (response.status === 404) {
          setError('Customer not registered. Click below to register.');
          return;
        }
        const errorText = await response.text();
        console.error('API Error:', errorText);
        throw new Error(`Failed to fetch customer data: ${response.status}`);
      }

      const data = await response.json();
      console.log('Customer data:', data);
      
      // Map the backend response to frontend structure
      const customer = data.data.customer;
      setCustomerData({
        address: customer.address,
        tier: customer.tier,
        lifetimeEarnings: parseFloat(customer.lifetime_earnings),
        dailyEarnings: parseFloat(customer.daily_earnings),
        monthlyEarnings: parseFloat(customer.monthly_earnings)
      });
    } catch (err: unknown) {
      console.error('Fetch error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load customer data';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const registerCustomer = async () => {
    if (!account?.address) return;

    setLoading(true);
    try {
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/customers/register`;
      console.log('Registering customer at:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: account.address,
        }),
      });

      console.log('Registration response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Registration error:', errorData);
        throw new Error(errorData.error || 'Registration failed');
      }

      const result = await response.json();
      console.log('Registration successful:', result);
      
      await fetchCustomerData(account.address);
      setError(null);
    } catch (err: unknown) {
      console.error('Registration error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Registration failed';
      setError(errorMessage);
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
      case 'BRONZE': return 'bg-orange-100 text-orange-800';
      case 'SILVER': return 'bg-gray-100 text-gray-800';
      case 'GOLD': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="text-center">
            <div className="text-6xl mb-6">🔧</div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">RepairCoin</h1>
            <p className="text-gray-600 mb-8">
              Connect your wallet to start earning loyalty tokens!
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-md w-full mx-auto p-6">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <div className="text-center">
              <div className="text-4xl mb-4">🔧</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Loading your wallet...</h2>
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

  if (error && !customerData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="text-center">
            <div className="text-blue-500 text-4xl mb-4">✨</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Welcome to RepairCoin!</h3>
            <p className="text-gray-600 mb-6">Ready to start earning loyalty tokens?</p>
            <button
              onClick={registerCustomer}
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3 px-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 transform hover:scale-105"
            >
              {loading ? 'Setting up your wallet...' : 'Join RepairCoin'}
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8 border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="text-2xl">🔧</div>
                <h1 className="text-2xl font-bold text-gray-900">RepairCoin Wallet</h1>
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
              <div className="text-3xl mb-2">🏆</div>
              <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-bold ${getTierColor(customerData?.tier || 'BRONZE')}`}>
                {customerData?.tier || 'BRONZE'}
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Lifetime: {customerData?.lifetimeEarnings?.toFixed(2) || '0.00'} RCN
              </p>
            </div>
          </div>

          {/* Daily Progress */}
          <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
            <div className="text-center">
              <div className="text-3xl mb-2">📈</div>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Today&apos;s Progress</span>
                    <span>{customerData?.dailyEarnings || 0} / 40 RCN</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-indigo-500 h-3 rounded-full transition-all duration-500" 
                      style={{ width: `${((customerData?.dailyEarnings || 0) / 40) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* How to Earn */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">How to Earn RepairCoin</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
              <div className="text-4xl mb-4">🔧</div>
              <h3 className="font-bold text-gray-900 mb-3">Complete Repairs</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Earn 10 RCN for $50-99 repairs<br />
                Earn 25 RCN for $100+ repairs
              </p>
            </div>
            <div className="text-center p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100">
              <div className="text-4xl mb-4">👥</div>
              <h3 className="font-bold text-gray-900 mb-3">Refer Friends</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Earn 25 RCN for each successful referral<br />
                New customers get 10 RCN bonus
              </p>
            </div>
            <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-100">
              <div className="text-4xl mb-4">📱</div>
              <h3 className="font-bold text-gray-900 mb-3">Engage & Interact</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Earn tokens for ads, surveys,<br />
                and platform interactions
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}