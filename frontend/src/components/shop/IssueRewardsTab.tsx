"use client";

import React, { useState, useEffect } from "react";

interface ShopData {
  purchasedRcnBalance: number;
}

interface IssueRewardsTabProps {
  shopId: string;
  shopData: ShopData | null;
  onRewardIssued: () => void;
}

type RepairType = "small" | "large";

interface CustomerInfo {
  tier: "BRONZE" | "SILVER" | "GOLD";
  lifetimeEarnings: number;
  dailyEarnings: number;
  monthlyEarnings: number;
}

export const IssueRewardsTab: React.FC<IssueRewardsTabProps> = ({
  shopId,
  shopData,
  onRewardIssued,
}) => {
  const [customerAddress, setCustomerAddress] = useState("");
  const [repairType, setRepairType] = useState<RepairType>("small");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [fetchingCustomer, setFetchingCustomer] = useState(false);

  // Calculate rewards based on repair type
  const calculateBaseReward = () => {
    return repairType === "large" ? 25 : 10;
  };

  // Get repair amount for API call
  const getRepairAmount = () => {
    return repairType === "large" ? 100 : 75; // Use 75 for small repairs (middle of $50-99 range)
  };

  const getTierBonus = (tier: string) => {
    switch (tier) {
      case "BRONZE":
        return 10;
      case "SILVER":
        return 20;
      case "GOLD":
        return 30;
      default:
        return 10;
    }
  };

  const baseReward = calculateBaseReward();
  const tierBonus = customerInfo ? getTierBonus(customerInfo.tier) : 0;
  const totalReward = baseReward + tierBonus;

  // Check if shop has sufficient balance for total reward (base + tier bonus)
  const hasSufficientBalance =
    (shopData?.purchasedRcnBalance || 0) >= totalReward;

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
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/customers/${customerAddress}`
      );

      if (response.ok) {
        const result = await response.json();
        setCustomerInfo({
          tier: result.data.tier || "BRONZE",
          lifetimeEarnings: result.data.lifetimeEarnings || 0,
          dailyEarnings: result.data.dailyEarnings || 0,
          monthlyEarnings: result.data.monthlyEarnings || 0,
        });
      } else {
        // New customer
        setCustomerInfo({
          tier: "BRONZE",
          lifetimeEarnings: 0,
          dailyEarnings: 0,
          monthlyEarnings: 0,
        });
      }
    } catch (err) {
      console.error("Error fetching customer:", err);
      // Assume new customer on error
      setCustomerInfo({
        tier: "BRONZE",
        lifetimeEarnings: 0,
        dailyEarnings: 0,
        monthlyEarnings: 0,
      });
    } finally {
      setFetchingCustomer(false);
    }
  };

  const issueReward = async () => {
    if (!customerAddress) {
      setError("Please enter a valid customer address");
      return;
    }

    if (!hasSufficientBalance) {
      setError(
        `Insufficient RCN balance. Need ${totalReward} RCN but only have ${
          shopData?.purchasedRcnBalance || 0
        } RCN`
      );
      return;
    }

    setProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      // Get auth token
      const authToken =
        localStorage.getItem("shopAuthToken") ||
        sessionStorage.getItem("shopAuthToken");

      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };

      if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
      } else {
        throw new Error(
          "No authentication token found. Please refresh the page and try again."
        );
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/shops/${shopId}/issue-reward`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            customerAddress,
            repairAmount: getRepairAmount(),
            skipTierBonus: false, // Always include tier bonus in total calculation
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to issue reward");
      }

      const result = await response.json();

      setSuccess(
        `Successfully issued ${result.data.totalReward} RCN to customer!`
      );

      // Reset form
      setCustomerAddress("");
      setRepairType("small");
      setCustomerInfo(null);

      // Notify parent to refresh data
      onRewardIssued();
    } catch (err) {
      console.error("Error issuing reward:", err);
      if (err instanceof Error && err.message.includes("Failed to fetch")) {
        setError(
          "Network error. Please check your connection and try again. If the problem persists, try refreshing the page."
        );
      } else {
        setError(err instanceof Error ? err.message : "Failed to issue reward");
      }
    } finally {
      setProcessing(false);
    }
  };

  const checkDailyLimit = () => {
    if (!customerInfo) return { withinLimit: true, remaining: 40 };
    const remaining = 40 - customerInfo.dailyEarnings;
    return {
      withinLimit: customerInfo.dailyEarnings + totalReward <= 40,
      remaining: Math.max(0, remaining),
    };
  };

  const checkMonthlyLimit = () => {
    if (!customerInfo) return { withinLimit: true, remaining: 500 };
    const remaining = 500 - customerInfo.monthlyEarnings;
    return {
      withinLimit: customerInfo.monthlyEarnings + totalReward <= 500,
      remaining: Math.max(0, remaining),
    };
  };

  const dailyLimit = checkDailyLimit();
  const monthlyLimit = checkMonthlyLimit();
  const canIssueReward = dailyLimit.withinLimit && monthlyLimit.withinLimit;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Form Section - Left Side */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Input Card */}
          <div className="bg-gradient-to-br from-[#1C1C1C] to-[#252525] rounded-2xl p-6 border border-gray-800">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-[#FFCC00] bg-opacity-20 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-[#FFCC00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-white">Customer Details</h2>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Wallet Address
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="0x0000...0000"
                    className="w-full px-4 py-3 bg-[#0D0D0D] border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent transition-all"
                  />
                  {fetchingCustomer && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <svg className="animate-spin h-5 w-5 text-[#FFCC00]" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    </div>
                  )}
                </div>
              </div>

              {/* Customer Status Bar */}
              {customerInfo && (
                <div className="bg-[#0D0D0D] rounded-xl p-4 border border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                        customerInfo.tier === "GOLD"
                          ? "bg-gradient-to-r from-yellow-500 to-yellow-600 text-white"
                          : customerInfo.tier === "SILVER"
                          ? "bg-gradient-to-r from-gray-400 to-gray-500 text-white"
                          : "bg-gradient-to-r from-orange-500 to-orange-600 text-white"
                      }`}>
                        {customerInfo.tier} TIER
                      </div>
                      <div className="text-sm">
                        <span className="text-gray-400">Lifetime:</span>
                        <span className="text-white ml-1 font-semibold">{customerInfo.lifetimeEarnings} RCN</span>
                      </div>
                    </div>
                    <div className="flex gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">Today:</span>
                        <span className={`ml-1 font-semibold ${!dailyLimit.withinLimit ? "text-red-500" : "text-green-500"}`}>
                          {customerInfo.dailyEarnings}/50
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Month:</span>
                        <span className={`ml-1 font-semibold ${!monthlyLimit.withinLimit ? "text-red-500" : "text-green-500"}`}>
                          {customerInfo.monthlyEarnings}/500
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Repair Type Selection */}
          <div className="bg-gradient-to-br from-[#1C1C1C] to-[#252525] rounded-2xl p-6 border border-gray-800">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-[#FFCC00] bg-opacity-20 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-[#FFCC00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-white">Select Repair Type</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className={`relative cursor-pointer`}>
                <input
                  type="radio"
                  name="repairType"
                  value="small"
                  checked={repairType === "small"}
                  onChange={(e) => setRepairType(e.target.value as RepairType)}
                  className="sr-only"
                />
                <div className={`p-4 rounded-xl border transition-all ${
                  repairType === "small" 
                    ? "bg-[#FFCC00] bg-opacity-10 border-[#FFCC00]" 
                    : "bg-[#0D0D0D] border-gray-700 hover:border-gray-600"
                }`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center">
                      <div className={`w-4 h-4 rounded-full border-2 mr-3 ${
                        repairType === "small" 
                          ? "border-[#FFCC00] bg-[#FFCC00]" 
                          : "border-gray-500"
                      }`}>
                        {repairType === "small" && (
                          <svg className="w-full h-full text-black" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <span className="font-semibold text-white">Small Repair</span>
                    </div>
                    <span className="text-[#FFCC00] font-bold">10 RCN</span>
                  </div>
                  <p className="text-gray-400 text-sm ml-7">$50 - $99 repair value</p>
                </div>
              </label>

              <label className={`relative cursor-pointer`}>
                <input
                  type="radio"
                  name="repairType"
                  value="large"
                  checked={repairType === "large"}
                  onChange={(e) => setRepairType(e.target.value as RepairType)}
                  className="sr-only"
                />
                <div className={`p-4 rounded-xl border transition-all ${
                  repairType === "large" 
                    ? "bg-[#FFCC00] bg-opacity-10 border-[#FFCC00]" 
                    : "bg-[#0D0D0D] border-gray-700 hover:border-gray-600"
                }`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center">
                      <div className={`w-4 h-4 rounded-full border-2 mr-3 ${
                        repairType === "large" 
                          ? "border-[#FFCC00] bg-[#FFCC00]" 
                          : "border-gray-500"
                      }`}>
                        {repairType === "large" && (
                          <svg className="w-full h-full text-black" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <span className="font-semibold text-white">Large Repair</span>
                    </div>
                    <span className="text-[#FFCC00] font-bold">25 RCN</span>
                  </div>
                  <p className="text-gray-400 text-sm ml-7">$100+ repair value</p>
                </div>
              </label>
            </div>
          </div>

          {/* Warnings and Alerts */}
          {!canIssueReward && customerInfo && (
            <div className="bg-red-900 bg-opacity-20 border border-red-500 rounded-xl p-4">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-red-500 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <h4 className="font-semibold text-red-500 mb-1">Earning Limit Exceeded</h4>
                  <p className="text-sm text-red-400">
                    {!dailyLimit.withinLimit && `Daily limit reached. ${dailyLimit.remaining} RCN remaining today.`}
                    {!monthlyLimit.withinLimit && `Monthly limit reached. ${monthlyLimit.remaining} RCN remaining this month.`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {!hasSufficientBalance && totalReward > 0 && (
            <div className="bg-yellow-900 bg-opacity-20 border border-yellow-500 rounded-xl p-4">
              <div className="flex items-start">
                <svg className="w-5 h-5 text-yellow-500 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <h4 className="font-semibold text-yellow-500 mb-1">Insufficient Balance</h4>
                  <p className="text-sm text-yellow-400">
                    Need {totalReward} RCN but only have {shopData?.purchasedRcnBalance || 0} RCN available.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Reward Calculator */}
        <div className="lg:col-span-1">
          <div className="sticky top-8">
            {/* Enhanced Reward Summary Card */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1C1C1C] to-[#252525] border border-gray-800">
              {/* Decorative Header */}
              <div className="bg-gradient-to-r from-[#FFCC00] to-[#FFA500] p-1">
                <div className="bg-[#1C1C1C] px-6 py-4 rounded-t-3xl">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white">Reward Calculator</h3>
                    <div className="w-12 h-12 rounded-full bg-[#FFCC00] bg-opacity-20 flex items-center justify-center">
                      <svg className="w-6 h-6 text-[#FFCC00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Balance Display */}
              <div className="px-6 py-4 border-b border-gray-800">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Available Balance</span>
                  <div className="text-right">
                    <div className={`text-2xl font-bold ${(shopData?.purchasedRcnBalance || 0) >= totalReward ? 'text-[#FFCC00]' : 'text-red-500'}`}>
                      {shopData?.purchasedRcnBalance || 0} RCN
                    </div>
                    {!hasSufficientBalance && totalReward > 0 && (
                      <p className="text-red-400 text-xs mt-1">Need {totalReward - (shopData?.purchasedRcnBalance || 0)} more</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Calculation Breakdown */}
              <div className="px-6 py-4 space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-[#FFCC00] rounded-full"></div>
                      <span className="text-gray-300">Base Reward</span>
                    </div>
                    <span className="text-white font-semibold text-lg">{baseReward} RCN</span>
                  </div>
                  
                  {customerInfo && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-gray-300">{customerInfo.tier} Bonus</span>
                      </div>
                      <span className="text-green-500 font-semibold text-lg">+{tierBonus} RCN</span>
                    </div>
                  )}
                </div>

                {/* Total Display */}
                <div className="border-t border-gray-700 pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-white font-semibold text-lg">Total Reward</span>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-[#FFCC00]">{totalReward}</div>
                      <div className="text-xs text-gray-400">RCN</div>
                    </div>
                  </div>

                  {/* Progress Bars for Limits */}
                  {customerInfo && (
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-400">Daily</span>
                          <span className={`${!dailyLimit.withinLimit ? 'text-red-400' : 'text-gray-400'}`}>
                            {customerInfo.dailyEarnings}/50 RCN
                          </span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all ${
                              !dailyLimit.withinLimit ? 'bg-red-500' : 'bg-[#FFCC00]'
                            }`}
                            style={{ width: `${Math.min((customerInfo.dailyEarnings / 50) * 100, 100)}%` }}
                          ></div>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-400">Monthly</span>
                          <span className={`${!monthlyLimit.withinLimit ? 'text-red-400' : 'text-gray-400'}`}>
                            {customerInfo.monthlyEarnings}/500 RCN
                          </span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full transition-all ${
                              !monthlyLimit.withinLimit ? 'bg-red-500' : 'bg-[#FFCC00]'
                            }`}
                            style={{ width: `${Math.min((customerInfo.monthlyEarnings / 500) * 100, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Issue Button */}
                <button
                  onClick={issueReward}
                  disabled={processing || !customerAddress || !canIssueReward || !hasSufficientBalance}
                  className="w-full bg-gradient-to-r from-[#FFCC00] to-[#FFA500] text-black font-bold py-4 px-6 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-lg hover:shadow-yellow-500/25 transform hover:scale-105"
                >
                  {processing ? (
                    <div className="flex items-center justify-center">
                      <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Issue {totalReward} RCN
                    </div>
                  )}
                </button>

                {/* Helper Text */}
                <p className="text-center text-xs text-gray-500">
                  Tier bonuses are automatically added
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="mt-6 bg-green-900 bg-opacity-20 border border-green-500 rounded-xl p-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-green-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <p className="text-green-400">{success}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-6 bg-red-900 bg-opacity-20 border border-red-500 rounded-xl p-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="text-red-400">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
};
