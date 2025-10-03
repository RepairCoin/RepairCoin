'use client';

import React, { useState } from 'react';

interface RedeemTabProps {
  shopId: string;
  onRedemptionComplete: () => void;
}

interface VerificationResult {
  canRedeem: boolean;
  earnedBalance: number;
  marketBalance: number;
  isHomeShop: boolean;
  maxRedeemable: number;
  message?: string;
}

export const RedeemTab: React.FC<RedeemTabProps> = ({ shopId, onRedemptionComplete }) => {
  const [customerAddress, setCustomerAddress] = useState('');
  const [redeemAmount, setRedeemAmount] = useState<number>(0);
  const [verifying, setVerifying] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);

  const verifyCustomer = async () => {
    if (!customerAddress || !redeemAmount) {
      setError('Please enter customer address and redemption amount');
      return;
    }

    setVerifying(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tokens/verify-redemption`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerAddress,
          shopId,
          amount: redeemAmount
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Verification failed');
      }

      const result = await response.json();
      setVerificationResult(result.data);

      if (!result.data.canRedeem) {
        setError(result.data.message || 'Customer cannot redeem at this time');
      }
    } catch (err) {
      console.error('Verification error:', err);
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const processRedemption = async () => {
    if (!verificationResult?.canRedeem) {
      setError('Please verify the customer first');
      return;
    }

    setProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      // Get auth token
      const authToken = localStorage.getItem('shopAuthToken') || sessionStorage.getItem('shopAuthToken');
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      } else {
        throw new Error('No authentication token found. Please refresh the page and try again.');
      }
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/shops/${shopId}/redeem`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          customerAddress,
          amount: redeemAmount
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Redemption failed');
      }

      const result = await response.json();
      setSuccess(`Successfully redeemed ${redeemAmount} RCN for customer`);
      
      // Reset form
      setCustomerAddress('');
      setRedeemAmount(0);
      setVerificationResult(null);
      
      // Notify parent to refresh data
      onRedemptionComplete();
    } catch (err) {
      console.error('Redemption error:', err);
      setError(err instanceof Error ? err.message : 'Redemption failed');
    } finally {
      setProcessing(false);
    }
  };

  const resetForm = () => {
    setCustomerAddress('');
    setRedeemAmount(0);
    setVerificationResult(null);
    setError(null);
    setSuccess(null);
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Redemption Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Process Customer Redemption</h2>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Customer Wallet Address
              </label>
              <input
                type="text"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="0x..."
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Redemption Amount (RCN)
              </label>
              <input
                type="number"
                min="1"
                value={redeemAmount || ''}
                onChange={(e) => setRedeemAmount(parseInt(e.target.value) || 0)}
                placeholder="Enter amount"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <p className="text-sm text-gray-500 mt-2">
                Value: ${(redeemAmount * 0.10).toFixed(2)} USD
              </p>
            </div>

            <button
              onClick={verifyCustomer}
              disabled={verifying || !customerAddress || !redeemAmount}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition duration-200"
            >
              {verifying ? 'Verifying Customer...' : 'Verify Customer'}
            </button>

            {verificationResult && (
              <div className={`p-4 rounded-xl border ${
                verificationResult.canRedeem 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <h3 className={`font-semibold mb-2 ${
                  verificationResult.canRedeem ? 'text-green-800' : 'text-red-800'
                }`}>
                  {verificationResult.canRedeem ? '✅ Verification Successful' : '❌ Cannot Redeem'}
                </h3>
                <div className="space-y-1 text-sm">
                  <p className="text-gray-700">
                    <span className="font-medium">Earned Balance:</span> {verificationResult.earnedBalance} RCN
                  </p>
                  <p className="text-gray-700">
                    <span className="font-medium">Market Balance:</span> {verificationResult.marketBalance} RCN
                  </p>
                  <p className="text-gray-700">
                    <span className="font-medium">Customer Type:</span> Verified Customer
                  </p>
                  <p className="text-gray-700">
                    <span className="font-medium">Max Redeemable:</span> {verificationResult.maxRedeemable} RCN
                  </p>
                  {verificationResult.message && (
                    <p className={verificationResult.canRedeem ? 'text-green-700' : 'text-red-700'}>
                      {verificationResult.message}
                    </p>
                  )}
                </div>
              </div>
            )}

            {verificationResult?.canRedeem && (
              <button
                onClick={processRedemption}
                disabled={processing}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-4 px-6 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 transform hover:scale-105"
              >
                {processing ? 'Processing Redemption...' : `Process ${redeemAmount} RCN Redemption`}
              </button>
            )}

            {(verificationResult || error || success) && (
              <button
                onClick={resetForm}
                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-3 px-6 rounded-xl transition duration-200"
              >
                Reset Form
              </button>
            )}
          </div>
        </div>

        {/* Information Panel */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Redemption Rules</h3>
            <div className="space-y-4">
              <RuleCard
                icon="✅"
                title="Universal Redemption"
                description="All customers can redeem 100% of their earned RCN balance at any participating shop."
              />
              <RuleCard
                icon="🔄"
                title="No Restrictions"
                description="Customers are free to redeem their tokens at any shop in the RepairCoin network."
              />
              <RuleCard
                icon="🚫"
                title="Market-Bought RCN"
                description="RCN purchased from exchanges or other markets cannot be redeemed at shops."
              />
              <RuleCard
                icon="💵"
                title="Redemption Value"
                description="Each RCN token is worth $0.10 USD when redeemed at participating shops."
              />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <h4 className="text-sm font-medium text-blue-800 mb-2">💡 Pro Tip</h4>
            <p className="text-sm text-blue-700">
              Always verify customers before processing redemptions. This ensures only earned RCN 
              is redeemed and prevents arbitrage from market-bought tokens.
            </p>
          </div>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex">
            <div className="text-red-400 text-xl mr-3">⚠️</div>
            <div>
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-1 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex">
            <div className="text-green-400 text-xl mr-3">✅</div>
            <div>
              <h3 className="text-sm font-medium text-green-800">Success</h3>
              <div className="mt-1 text-sm text-green-700">{success}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface RuleCardProps {
  icon: string;
  title: string;
  description: string;
}

const RuleCard: React.FC<RuleCardProps> = ({ icon, title, description }) => {
  return (
    <div className="flex items-start space-x-3">
      <span className="text-2xl flex-shrink-0">{icon}</span>
      <div>
        <h4 className="font-semibold text-gray-900">{title}</h4>
        <p className="text-sm text-gray-600 mt-1">{description}</p>
      </div>
    </div>
  );
};