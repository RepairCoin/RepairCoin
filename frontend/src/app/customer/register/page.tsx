'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConnectButton, useActiveAccount } from "thirdweb/react";
import { createThirdwebClient } from "thirdweb";
import { useAuth } from '../../../hooks/useAuth';

const client = createThirdwebClient({
  clientId: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID || "1969ac335e07ba13ad0f8d1a1de4f6ab",
});

export default function CustomerRegistration() {
  const account = useActiveAccount();
  const { refreshProfile } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    referralCode: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account?.address) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const registrationData = {
        ...formData,
        walletAddress: account.address,
      };

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/customers/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registrationData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle specific error cases
        if (response.status === 409) {
          // Handle role conflict errors with specific messaging
          if (errorData.conflictingRole) {
            const roleMessage = {
              'admin': 'This wallet is registered as an admin account and cannot be used for customer registration.',
              'shop': 'This wallet is already registered as a shop account. You cannot register the same wallet as both a shop and a customer.',
              'customer': 'This wallet is already registered as a customer.'
            };
            
            const message = roleMessage[errorData.conflictingRole as keyof typeof roleMessage] || errorData.error;
            
            // For existing customer, we still redirect, but for other roles we don't
            if (errorData.conflictingRole === 'customer') {
              throw new Error('This wallet is already registered. Redirecting to your dashboard...');
            } else {
              throw new Error(message);
            }
          } else {
            throw new Error('This wallet is already registered. Redirecting to your dashboard...');
          }
        }
        
        throw new Error(errorData.error || 'Registration failed');
      }

      const result = await response.json();
      setSuccess('Registration successful! Welcome to RepairCoin!');
      console.log('Customer registered:', result);

      // Refresh the auth profile to update the authentication state
      await refreshProfile();

      // Redirect to customer dashboard after successful registration
      setTimeout(() => {
        router.push('/customer');
      }, 2000);

    } catch (err) {
      console.error('Registration error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Registration failed';
      setError(errorMessage);
      
      // If user already exists as customer, redirect after a short delay
      // Don't redirect for role conflicts (admin/shop trying to register as customer)
      if (errorMessage.includes('already registered') && errorMessage.includes('Redirecting')) {
        setTimeout(() => {
          router.push('/customer');
        }, 3000);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="text-center">
            <div className="text-6xl mb-6">👤</div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Customer Registration</h1>
            <p className="text-gray-600 mb-8">
              Connect your wallet to register as a customer
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8 border border-gray-100">
          <div className="text-center">
            <div className="text-4xl mb-4">👤</div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Join RepairCoin</h1>
            <p className="text-gray-600">Start earning tokens for your device repairs</p>
          </div>
        </div>

        {/* Registration Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Wallet Information */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4">Wallet Information</h3>
              <div className="bg-gray-50 border border-gray-300 rounded-xl p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Connected Wallet
                </label>
                <span className="font-mono text-sm text-gray-600">
                  {account.address}
                </span>
              </div>
            </div>

            {/* Personal Information */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4">Personal Information</h3>
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name (Optional)
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="John Doe"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Used for personalization and support
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="john@example.com"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    For notifications and important updates
                  </p>
                </div>
              </div>
            </div>

            {/* Referral Code */}
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4">Referral (Optional)</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Referral Code
                </label>
                <input
                  type="text"
                  name="referralCode"
                  value={formData.referralCode}
                  onChange={handleInputChange}
                  placeholder="Enter referral code"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Get bonus tokens if you were referred by someone
                </p>
              </div>
            </div>

            {/* Benefits Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
              <h4 className="font-bold text-blue-900 mb-3">🎉 Customer Benefits</h4>
              <ul className="text-sm text-blue-800 space-y-2">
                <li>• Earn 10 RCN for repairs $50-99</li>
                <li>• Earn 25 RCN for repairs $100+</li>
                <li>• Bonus tokens based on your tier (Bronze, Silver, Gold)</li>
                <li>• Redeem tokens at any participating repair shop</li>
                <li>• 20% cross-shop redemption available</li>
                <li>• Referral bonuses for bringing friends</li>
              </ul>
            </div>

            {/* Submit Button */}
            <div className="flex justify-center pt-6">
              <button
                type="submit"
                disabled={loading}
                className="w-full md:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 transform hover:scale-105"
              >
                {loading ? 'Creating Account...' : 'Join RepairCoin'}
              </button>
            </div>
          </form>

          {/* Success Message */}
          {success && (
            <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center">
                <div className="text-green-400 text-2xl mr-3">✅</div>
                <div>
                  <h3 className="text-sm font-medium text-green-800">Registration Successful!</h3>
                  <div className="mt-2 text-sm text-green-700">{success}</div>
                  <div className="mt-2 text-sm text-green-600">Redirecting to your dashboard...</div>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center">
                <div className="text-red-400 text-2xl mr-3">⚠️</div>
                <div>
                  <h3 className="text-sm font-medium text-red-800">Registration Error</h3>
                  <div className="mt-2 text-sm text-red-700">{error}</div>
                  {error.includes('already registered') && (
                    <div className="mt-2 text-sm text-red-600">Redirecting to your dashboard...</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Back to Home */}
        <div className="text-center mt-6">
          <button
            onClick={() => router.push('/')}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}