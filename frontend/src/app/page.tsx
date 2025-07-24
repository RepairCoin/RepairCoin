'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ConnectButton } from "thirdweb/react";
import { createThirdwebClient } from "thirdweb";
import { useAuth } from '../hooks/useAuth';

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "1969ac335e07ba13ad0f8d1a1de4f6ab",
});

export default function LandingPage() {
  const { account, isAuthenticated, isLoading, userType, userProfile } = useAuth();
  const router = useRouter();

  // Auto-redirect authenticated users to their appropriate dashboard
  useEffect(() => {
    if (isAuthenticated && userType && !isLoading) {
      console.log('Redirecting user:', { userType, userProfile });
      
      switch (userType) {
        case 'admin':
          router.push('/admin');
          break;
        case 'shop':
          router.push('/shop');
          break;
        case 'customer':
          router.push('/customer');
          break;
        default:
          console.warn('Unknown user type:', userType);
      }
    }
  }, [isAuthenticated, userType, isLoading, router, userProfile]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading RepairCoin...</h2>
            <p className="text-gray-600">Checking your authentication status</p>
          </div>
        </div>
      </div>
    );
  }

  // Show registration options for connected wallet without profile
  if (account?.address && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="text-6xl mb-6">🔧</div>
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Welcome to RepairCoin</h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Choose how you'd like to join our blockchain-powered repair ecosystem
            </p>
          </div>

          {/* Wallet Info */}
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-8 border border-gray-100">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Connected Wallet</h3>
              <p className="text-sm font-mono text-gray-600 bg-gray-50 px-4 py-2 rounded-lg inline-block">
                {account.address.slice(0, 6)}...{account.address.slice(-4)}
              </p>
            </div>
          </div>

          {/* Registration Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            {/* Customer Registration */}
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 hover:shadow-2xl transition-shadow">
              <div className="text-center">
                <div className="text-5xl mb-4">👤</div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">I'm a Customer</h3>
                <p className="text-gray-600 mb-6">
                  Start earning RepairCoin tokens for your device repairs and redeem them for discounts
                </p>
                <div className="space-y-3 text-sm text-gray-500 mb-6">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-green-500">✓</span>
                    <span>Earn 10-25 RCN per repair</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-green-500">✓</span>
                    <span>Redeem tokens for discounts</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-green-500">✓</span>
                    <span>Access tier benefits</span>
                  </div>
                </div>
                <button
                  onClick={() => router.push('/customer/register')}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3 px-6 rounded-xl transition duration-200 transform hover:scale-105"
                >
                  Register as Customer
                </button>
              </div>
            </div>

            {/* Shop Registration */}
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 hover:shadow-2xl transition-shadow">
              <div className="text-center">
                <div className="text-5xl mb-4">🏪</div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">I'm a Repair Shop</h3>
                <p className="text-gray-600 mb-6">
                  Join our network to offer loyalty tokens to your customers and boost retention
                </p>
                <div className="space-y-3 text-sm text-gray-500 mb-6">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-green-500">✓</span>
                    <span>Purchase RCN at $1 per token</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-green-500">✓</span>
                    <span>Automatic tier bonuses</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-green-500">✓</span>
                    <span>Cross-shop redemption network</span>
                  </div>
                </div>
                <button
                  onClick={() => router.push('/shop/register')}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-3 px-6 rounded-xl transition duration-200 transform hover:scale-105"
                >
                  Register as Shop
                </button>
              </div>
            </div>
          </div>

          {/* How It Works */}
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">How RepairCoin Works</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="text-4xl mb-4">🔧</div>
                <h3 className="font-bold text-gray-900 mb-3">1. Get Repairs</h3>
                <p className="text-sm text-gray-600">
                  Customers get their devices repaired at participating shops
                </p>
              </div>
              <div className="text-center">
                <div className="text-4xl mb-4">🪙</div>
                <h3 className="font-bold text-gray-900 mb-3">2. Earn Tokens</h3>
                <p className="text-sm text-gray-600">
                  Receive RepairCoin (RCN) tokens based on repair value and tier
                </p>
              </div>
              <div className="text-center">
                <div className="text-4xl mb-4">💰</div>
                <h3 className="font-bold text-gray-900 mb-3">3. Redeem Benefits</h3>
                <p className="text-sm text-gray-600">
                  Use tokens for discounts at any participating repair shop
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show connect wallet prompt for non-connected users
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <div className="text-center">
          <div className="text-6xl mb-6">🔧</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">RepairCoin</h1>
          <p className="text-gray-600 mb-8">
            Connect your wallet to join the future of repair shop loyalty programs
          </p>
          <ConnectButton 
            client={client}
            theme="light"
            connectModal={{ size: "wide" }}
          />
          
          {/* Additional Info */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 leading-relaxed">
              RepairCoin is a blockchain-based loyalty token system that rewards customers for device repairs and helps shops build customer loyalty.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}