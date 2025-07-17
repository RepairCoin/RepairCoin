'use client';

import { useState, useEffect } from 'react';
import { ConnectButton, useActiveAccount, useReadContract } from "thirdweb/react";
import { getContract, createThirdwebClient } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";

// Initialize Thirdweb client
const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID!,
});

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
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/customers/${address}`);

      if (!response.ok) {
        if (response.status === 404) {
          setError('Customer not registered. Click below to register.');
          return;
        }
        throw new Error('Failed to fetch customer data');
      }

      const data = await response.json();
      setCustomerData(data.data.customer);
    } catch (err: any) {
      setError(err.message || 'Failed to load customer data');
    } finally {
      setLoading(false);
    }
  };

  const registerCustomer = async () => {
    if (!account?.address) return;

    setLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/customers/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: account.address,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Registration failed');
      }

      await fetchCustomerData(account.address);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-4xl w-full mx-auto p-6">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !customerData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <div className="text-red-500 text-4xl mb-4">⚠️</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Get Started</h3>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={registerCustomer}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition duration-200"
            >
              {loading ? 'Registering...' : 'Register for RepairCoin'}
            </button>
            <div className="mt-4">
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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">RepairCoin Wallet</h1>
              <p className="text-gray-600 mt-1">{account.address}</p>
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Token Balance */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Token Balance</h2>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 mb-2">
                {balanceLoading ? '...' : formatBalance(tokenBalance)} RCN
              </div>
              <p className="text-sm text-gray-500">Blockchain Balance</p>
            </div>
          </div>

          {/* Customer Tier */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Customer Tier</h2>
            <div className="text-center">
              <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${getTierColor(customerData?.tier || 'BRONZE')}`}>
                {customerData?.tier || 'BRONZE'}
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Lifetime: {customerData?.lifetimeEarnings?.toFixed(2) || '0.00'} RCN
              </p>
            </div>
          </div>

          {/* Daily Progress */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Today's Progress</h2>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm">
                  <span>Daily Earned</span>
                  <span>{customerData?.dailyEarnings || 0} / 40 RCN</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full" 
                    style={{ width: `${((customerData?.dailyEarnings || 0) / 40) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* How to Earn */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">How to Earn RepairCoin</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-6 border-2 border-dashed border-gray-200 rounded-lg">
              <div className="text-4xl mb-4">🔧</div>
              <h3 className="font-semibold text-gray-900 mb-2">Complete Repairs</h3>
              <p className="text-sm text-gray-600">
                Earn 10 RCN for $50-99 repairs<br />
                Earn 25 RCN for $100+ repairs
              </p>
            </div>
            <div className="text-center p-6 border-2 border-dashed border-gray-200 rounded-lg">
              <div className="text-4xl mb-4">👥</div>
              <h3 className="font-semibold text-gray-900 mb-2">Refer Friends</h3>
              <p className="text-sm text-gray-600">
                Earn 25 RCN for each successful referral<br />
                New customers get 10 RCN bonus
              </p>
            </div>
            <div className="text-center p-6 border-2 border-dashed border-gray-200 rounded-lg">
              <div className="text-4xl mb-4">📱</div>
              <h3 className="font-semibold text-gray-900 mb-2">Engage & Interact</h3>
              <p className="text-sm text-gray-600">
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