'use client';

import { useEffect, useState } from 'react';
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
  const [shopApplicationStatus, setShopApplicationStatus] = useState<{
    hasApplication: boolean;
    status: 'pending' | 'verified' | 'rejected' | null;
    shopName?: string;
  }>({ hasApplication: false, status: null });
  const [customerStatus, setCustomerStatus] = useState<{
    isRegistered: boolean;
    customerData?: any;
  }>({ isRegistered: false });
  const [checkingApplications, setCheckingApplications] = useState(false);

  // Check if wallet has existing registrations
  const checkExistingRegistrations = async (walletAddress: string) => {
    setCheckingApplications(true);
    try {
      // Check for shop application
      const shopResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/shops/wallet/${walletAddress}`);
      if (shopResponse.ok) {
        const shopData = await shopResponse.json();
        const shop = shopData.data;
        if (shop) {
          setShopApplicationStatus({
            hasApplication: true,
            status: shop.verified ? 'verified' : 'pending',
            shopName: shop.name
          });
        }
      } else if (shopResponse.status === 404) {
        // No shop found - this is normal for new wallets
        setShopApplicationStatus({ hasApplication: false, status: null });
      }

      // Check for customer registration
      const customerResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/customers/${walletAddress}`);
      if (customerResponse.ok) {
        const customerData = await customerResponse.json();
        setCustomerStatus({
          isRegistered: true,
          customerData: customerData.data
        });
      } else if (customerResponse.status === 404) {
        // No customer found - this is normal for new wallets
        setCustomerStatus({ isRegistered: false });
      }
    } catch (error) {
      console.error('Error checking existing registrations:', error);
      // Don't show error to user, just assume no registrations
      setShopApplicationStatus({ hasApplication: false, status: null });
      setCustomerStatus({ isRegistered: false });
    } finally {
      setCheckingApplications(false);
    }
  };

  // Check for existing registrations when wallet connects
  useEffect(() => {
    if (account?.address && !isAuthenticated) {
      checkExistingRegistrations(account.address);
    }
  }, [account?.address, isAuthenticated]);

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
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 hover:shadow-2xl transition-shadow h-full">
              <div className="text-center h-full flex flex-col">
                {checkingApplications ? (
                  <>
                    <div className="text-5xl mb-4">🔄</div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-4">Checking Registration...</h3>
                    <p className="text-gray-600 mb-6 flex-grow">
                      Please wait while we check for existing registrations
                    </p>
                    <div className="mt-auto">
                      <div className="w-full bg-gray-200 rounded-xl py-4 px-6">
                        <div className="animate-pulse flex items-center justify-center">
                          <div className="rounded-full h-4 w-4 bg-gray-400"></div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : customerStatus.isRegistered ? (
                  <>
                    <div className="text-5xl mb-4">✅</div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-4">Already Registered</h3>
                    <p className="text-gray-600 mb-6 flex-grow">
                      You're already registered as a customer in our network
                    </p>
                    <div className="bg-green-50 rounded-lg p-4 mb-6">
                      <p className="text-sm text-green-600">Customer Status:</p>
                      <p className="font-semibold text-green-900">Active</p>
                      {customerStatus.customerData?.tier && (
                        <>
                          <p className="text-sm text-green-600 mt-2">Current Tier:</p>
                          <p className="font-semibold text-green-900">{customerStatus.customerData.tier}</p>
                        </>
                      )}
                    </div>
                    <div className="mt-auto">
                      <button
                        onClick={() => router.push('/customer')}
                        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-4 px-6 rounded-xl transition duration-200 transform hover:scale-105 cursor-pointer"
                      >
                        Go to Customer Dashboard
                      </button>
                    </div>
                  </>
                ) : shopApplicationStatus.hasApplication ? (
                  <>
                    <div className="text-5xl mb-4">🚫</div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-4">Shop Application Found</h3>
                    <p className="text-gray-600 mb-6 flex-grow">
                      You have a {shopApplicationStatus.status === 'pending' ? 'pending' : 'verified'} shop application. 
                      You cannot register as both a customer and a shop with the same wallet.
                    </p>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                      <div className="text-sm text-yellow-700">
                        <p className="font-medium mb-1">Existing Shop:</p>
                        <p className="font-semibold">{shopApplicationStatus.shopName}</p>
                        <p className="mt-2">Status: <span className="font-medium">
                          {shopApplicationStatus.status === 'pending' ? 'Pending Approval' : 'Verified'}
                        </span></p>
                      </div>
                    </div>
                    <div className="mt-auto">
                      <button
                        onClick={() => router.push('/shop')}
                        className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold py-4 px-6 rounded-xl transition duration-200 transform hover:scale-105 cursor-pointer"
                      >
                        View Shop Application
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-5xl mb-4">👤</div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-4">I'm a Customer</h3>
                    <p className="text-gray-600 mb-6 flex-grow">
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
                    <div className="mt-auto">
                      <button
                        onClick={() => router.push('/customer/register')}
                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-4 px-6 rounded-xl transition duration-200 transform hover:scale-105 cursor-pointer"
                      >
                        Register as Customer
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Shop Registration */}
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 hover:shadow-2xl transition-shadow h-full">
              <div className="text-center h-full flex flex-col">
                {checkingApplications ? (
                  <>
                    <div className="text-5xl mb-4">🔄</div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-4">Checking Application...</h3>
                    <p className="text-gray-600 mb-6 flex-grow">
                      Please wait while we check for existing shop applications
                    </p>
                    <div className="mt-auto">
                      <div className="w-full bg-gray-200 rounded-xl py-4 px-6">
                        <div className="animate-pulse flex items-center justify-center">
                          <div className="rounded-full h-4 w-4 bg-gray-400"></div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : customerStatus.isRegistered ? (
                  <>
                    <div className="text-5xl mb-4">🚫</div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-4">Customer Registration Found</h3>
                    <p className="text-gray-600 mb-6 flex-grow">
                      You're already registered as a customer in our network. 
                      You cannot register as both a customer and a shop with the same wallet.
                    </p>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                      <div className="text-sm text-blue-700">
                        <p className="font-medium mb-1">Existing Registration:</p>
                        <p className="font-semibold">Customer Account</p>
                        {customerStatus.customerData?.tier && (
                          <p className="mt-2">Tier: <span className="font-medium">{customerStatus.customerData.tier}</span></p>
                        )}
                      </div>
                    </div>
                    <div className="mt-auto">
                      <button
                        onClick={() => router.push('/customer')}
                        className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-bold py-4 px-6 rounded-xl transition duration-200 transform hover:scale-105 cursor-pointer"
                      >
                        View Customer Dashboard
                      </button>
                    </div>
                  </>
                ) : shopApplicationStatus.hasApplication ? (
                  <>
                    <div className="text-5xl mb-4">
                      {shopApplicationStatus.status === 'pending' ? '⏳' : '✅'}
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-4">
                      {shopApplicationStatus.status === 'pending' ? 'Application Pending' : 'Shop Registered'}
                    </h3>
                    <p className="text-gray-600 mb-6 flex-grow">
                      {shopApplicationStatus.status === 'pending' 
                        ? 'Your shop application is being reviewed by our admin team'
                        : 'Your shop is registered and verified in our network'
                      }
                    </p>
                    {shopApplicationStatus.shopName && (
                      <div className="bg-gray-50 rounded-lg p-4 mb-6">
                        <p className="text-sm text-gray-600">Shop Name:</p>
                        <p className="font-semibold text-gray-900">{shopApplicationStatus.shopName}</p>
                      </div>
                    )}
                    <div className="space-y-3 text-sm mb-6">
                      {shopApplicationStatus.status === 'pending' ? (
                        <div className="text-yellow-600 bg-yellow-50 rounded-lg p-3">
                          <div className="flex items-center justify-center gap-2 mb-2">
                            <span>⏳</span>
                            <span className="font-medium">Awaiting Admin Review</span>
                          </div>
                          <p className="text-xs">You'll receive access once approved</p>
                        </div>
                      ) : (
                        <div className="text-green-600 bg-green-50 rounded-lg p-3">
                          <div className="flex items-center justify-center gap-2">
                            <span>✓</span>
                            <span className="font-medium">Ready to Use Dashboard</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="mt-auto">
                      <button
                        onClick={() => router.push('/shop')}
                        className={`w-full font-bold py-4 px-6 rounded-xl transition duration-200 transform hover:scale-105 cursor-pointer ${
                          shopApplicationStatus.status === 'pending'
                            ? 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white'
                            : 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white'
                        }`}
                      >
                        {shopApplicationStatus.status === 'pending' ? 'View Application Status' : 'Go to Shop Dashboard'}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-5xl mb-4">🏪</div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-4">I'm a Repair Shop</h3>
                    <p className="text-gray-600 mb-6 flex-grow">
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
                    <div className="mt-auto">
                      <button
                        onClick={() => router.push('/shop/register')}
                        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-4 px-6 rounded-xl transition duration-200 transform hover:scale-105 cursor-pointer"
                      >
                        Register as Shop
                      </button>
                    </div>
                  </>
                )}
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