'use client';

import React, { useState, useEffect } from 'react';

interface ShopData {
  purchasedRcnBalance: number;
}

interface IssueRewardsTabProps {
  shopId: string;
  shopData: ShopData | null;
  onRewardIssued: () => void;
}

interface CustomerInfo {
  tier: 'BRONZE' | 'SILVER' | 'GOLD';
  lifetimeEarnings: number;
  dailyEarnings: number;
  monthlyEarnings: number;
}

export const IssueRewardsTab: React.FC<IssueRewardsTabProps> = ({ shopId, shopData, onRewardIssued }) => {
  const [customerAddress, setCustomerAddress] = useState('');
  const [repairAmount, setRepairAmount] = useState<number>(0);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [fetchingCustomer, setFetchingCustomer] = useState(false);

  // Calculate rewards based on repair amount
  const calculateBaseReward = () => {
    if (repairAmount < 50) return 0;
    if (repairAmount < 100) return 10;
    return 25;
  };

  const getTierBonus = (tier: string) => {
    switch (tier) {
      case 'BRONZE': return 10;
      case 'SILVER': return 20;
      case 'GOLD': return 30;
      default: return 10;
    }
  };

  const baseReward = calculateBaseReward();
  const tierBonus = customerInfo && repairAmount >= 50 ? getTierBonus(customerInfo.tier) : 0;
  const totalReward = baseReward + tierBonus;

  // Check if shop has sufficient balance for tier bonus
  const hasSufficientBalance = (shopData?.purchasedRcnBalance || 0) >= tierBonus;

  // Fetch customer info when address changes
  useEffect(() => {
    if (customerAddress && customerAddress.length === 42) {
      fetchCustomerInfo();
    } else {
      setCustomerInfo(null);
    }
  }, [customerAddress]);

  const fetchCustomerInfo = async () => {
    setFetchingCustomer(true);
    setError(null);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/customers/${customerAddress}`);
      
      if (response.ok) {
        const result = await response.json();
        setCustomerInfo({
          tier: result.data.tier || 'BRONZE',
          lifetimeEarnings: result.data.lifetimeEarnings || 0,
          dailyEarnings: result.data.dailyEarnings || 0,
          monthlyEarnings: result.data.monthlyEarnings || 0,
        });
      } else {
        // New customer
        setCustomerInfo({
          tier: 'BRONZE',
          lifetimeEarnings: 0,
          dailyEarnings: 0,
          monthlyEarnings: 0,
        });
      }
    } catch (err) {
      console.error('Error fetching customer:', err);
      // Assume new customer on error
      setCustomerInfo({
        tier: 'BRONZE',
        lifetimeEarnings: 0,
        dailyEarnings: 0,
        monthlyEarnings: 0,
      });
    } finally {
      setFetchingCustomer(false);
    }
  };

  const issueReward = async () => {
    if (!customerAddress || repairAmount < 50) {
      setError('Please enter a valid customer address and repair amount (minimum $50)');
      return;
    }

    if (!hasSufficientBalance && tierBonus > 0) {
      setError(`Insufficient RCN balance for tier bonus. Need ${tierBonus} RCN but only have ${shopData?.purchasedRcnBalance || 0} RCN`);
      return;
    }

    setProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      // Get auth token
      const authToken = localStorage.getItem('shopAuthToken') || sessionStorage.getItem('shopAuthToken');
      
      console.log('Auth token found:', !!authToken);
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
        console.log('Authorization header set');
      } else {
        console.error('No auth token found in storage');
      }
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/shops/${shopId}/issue-reward`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          customerAddress,
          repairAmount,
          skipTierBonus: !hasSufficientBalance // Skip tier bonus if insufficient balance
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to issue reward');
      }

      const result = await response.json();
      
      setSuccess(`Successfully issued ${result.data.totalReward} RCN to customer!`);
      
      // Reset form
      setCustomerAddress('');
      setRepairAmount(0);
      setCustomerInfo(null);
      
      // Notify parent to refresh data
      onRewardIssued();
    } catch (err) {
      console.error('Error issuing reward:', err);
      setError(err instanceof Error ? err.message : 'Failed to issue reward');
    } finally {
      setProcessing(false);
    }
  };

  const checkDailyLimit = () => {
    if (!customerInfo) return { withinLimit: true, remaining: 40 };
    const remaining = 40 - customerInfo.dailyEarnings;
    return {
      withinLimit: customerInfo.dailyEarnings + totalReward <= 40,
      remaining: Math.max(0, remaining)
    };
  };

  const checkMonthlyLimit = () => {
    if (!customerInfo) return { withinLimit: true, remaining: 500 };
    const remaining = 500 - customerInfo.monthlyEarnings;
    return {
      withinLimit: customerInfo.monthlyEarnings + totalReward <= 500,
      remaining: Math.max(0, remaining)
    };
  };

  const dailyLimit = checkDailyLimit();
  const monthlyLimit = checkMonthlyLimit();
  const canIssueReward = dailyLimit.withinLimit && monthlyLimit.withinLimit;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Reward Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Issue Customer Reward</h2>
          
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
              {fetchingCustomer && (
                <p className="text-sm text-gray-500 mt-1">Loading customer info...</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Repair Amount (USD)
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={repairAmount || ''}
                onChange={(e) => setRepairAmount(parseFloat(e.target.value) || 0)}
                placeholder="Enter repair amount"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <p className="text-sm text-gray-500 mt-2">
                Minimum $50 to earn rewards
              </p>
            </div>

            {/* Reward Calculation */}
            {repairAmount > 0 && (
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <h3 className="font-semibold text-gray-900">Reward Calculation</h3>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Base Reward:</span>
                    <span className="font-medium">{baseReward} RCN</span>
                  </div>
                  {customerInfo && repairAmount >= 50 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">
                        {customerInfo.tier} Tier Bonus:
                      </span>
                      <span className={`font-medium ${!hasSufficientBalance ? 'text-red-600 line-through' : ''}`}>
                        +{tierBonus} RCN
                      </span>
                    </div>
                  )}
                  <div className="border-t pt-1 flex justify-between font-semibold">
                    <span>Total Reward:</span>
                    <span className="text-green-600">{totalReward} RCN</span>
                  </div>
                </div>
              </div>
            )}

            {/* Customer Info */}
            {customerInfo && (
              <div className="bg-blue-50 rounded-xl p-4 space-y-2">
                <h3 className="font-semibold text-blue-900">Customer Status</h3>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-blue-700">Current Tier:</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      customerInfo.tier === 'GOLD' ? 'bg-yellow-100 text-yellow-800' :
                      customerInfo.tier === 'SILVER' ? 'bg-gray-100 text-gray-800' :
                      'bg-orange-100 text-orange-800'
                    }`}>
                      {customerInfo.tier}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Lifetime Earnings:</span>
                    <span className="font-medium">{customerInfo.lifetimeEarnings} RCN</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Daily Earnings:</span>
                    <span className={`font-medium ${!dailyLimit.withinLimit ? 'text-red-600' : ''}`}>
                      {customerInfo.dailyEarnings} / 40 RCN
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Monthly Earnings:</span>
                    <span className={`font-medium ${!monthlyLimit.withinLimit ? 'text-red-600' : ''}`}>
                      {customerInfo.monthlyEarnings} / 500 RCN
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Limit Warnings */}
            {!canIssueReward && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <h4 className="text-sm font-medium text-red-800 mb-1">Earning Limit Exceeded</h4>
                <p className="text-sm text-red-700">
                  {!dailyLimit.withinLimit && `Customer has reached daily limit. ${dailyLimit.remaining} RCN remaining today.`}
                  {!monthlyLimit.withinLimit && `Customer has reached monthly limit. ${monthlyLimit.remaining} RCN remaining this month.`}
                </p>
              </div>
            )}

            {/* Balance Warning */}
            {!hasSufficientBalance && tierBonus > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                <h4 className="text-sm font-medium text-yellow-800 mb-1">Low RCN Balance</h4>
                <p className="text-sm text-yellow-700">
                  Your shop doesn't have enough RCN for the tier bonus. Only base reward will be issued.
                </p>
              </div>
            )}

            <button
              onClick={issueReward}
              disabled={processing || !customerAddress || repairAmount < 50 || !canIssueReward}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-4 px-6 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 transform hover:scale-105"
            >
              {processing ? 'Issuing Reward...' : `Issue ${totalReward} RCN Reward`}
            </button>
          </div>
        </div>

        {/* Information Panel */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Reward Structure</h3>
            <div className="space-y-4">
              <RewardTier
                range="$50 - $99"
                baseReward="10 RCN"
                description="Small repairs"
              />
              <RewardTier
                range="$100+"
                baseReward="25 RCN"
                description="Large repairs"
              />
              
              <div className="border-t pt-4">
                <h4 className="font-semibold text-gray-900 mb-3">Tier Bonuses (Auto-Applied)</h4>
                <div className="space-y-2">
                  <TierBonus tier="Bronze" bonus="+10 RCN" requirement="0-199 lifetime RCN" />
                  <TierBonus tier="Silver" bonus="+20 RCN" requirement="200-999 lifetime RCN" />
                  <TierBonus tier="Gold" bonus="+30 RCN" requirement="1000+ lifetime RCN" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Earning Limits</h3>
            <div className="space-y-3">
              <LimitInfo
                type="Daily Limit"
                amount="40 RCN"
                description="Excluding tier bonuses"
              />
              <LimitInfo
                type="Monthly Limit"
                amount="500 RCN"
                description="Excluding tier bonuses"
              />
            </div>
            <p className="text-sm text-gray-600 mt-4">
              Tier bonuses don't count towards these limits, encouraging customer loyalty.
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

interface RewardTierProps {
  range: string;
  baseReward: string;
  description: string;
}

const RewardTier: React.FC<RewardTierProps> = ({ range, baseReward, description }) => {
  return (
    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
      <div>
        <p className="font-medium text-gray-900">{range}</p>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
      <span className="font-semibold text-green-600">{baseReward}</span>
    </div>
  );
};

interface TierBonusProps {
  tier: string;
  bonus: string;
  requirement: string;
}

const TierBonus: React.FC<TierBonusProps> = ({ tier, bonus, requirement }) => {
  const tierColors = {
    Bronze: 'bg-orange-100 text-orange-800',
    Silver: 'bg-gray-100 text-gray-800',
    Gold: 'bg-yellow-100 text-yellow-800',
  };

  return (
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-2">
        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${tierColors[tier as keyof typeof tierColors]}`}>
          {tier}
        </span>
        <span className="text-sm text-gray-600">{requirement}</span>
      </div>
      <span className="font-semibold text-blue-600">{bonus}</span>
    </div>
  );
};

interface LimitInfoProps {
  type: string;
  amount: string;
  description: string;
}

const LimitInfo: React.FC<LimitInfoProps> = ({ type, amount, description }) => {
  return (
    <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
      <div>
        <p className="font-medium text-gray-900">{type}</p>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
      <span className="font-semibold text-blue-600">{amount}</span>
    </div>
  );
};