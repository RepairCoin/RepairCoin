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
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Reward Form */}
        <div className="bg-[#212121] rounded-3xl overflow-hidden">
          <div
            className="w-full px-8 py-20 text-white rounded-t-3xl"
            style={{
              backgroundImage: `url('/img/shop-dash-1.png')`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
          ></div>
          <div className="bg-[#1C1C1C] rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-bold text-[#FFCC00] mb-6">
              Issue Customer Reward
            </h2>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Customer Wallet Address
                </label>
                <input
                  type="text"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="0x430595dfdc2323"
                  className="w-full px-4 py-3 border border-gray-400 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {fetchingCustomer && (
                  <p className="text-sm text-gray-500 mt-1">
                    Loading customer info...
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Repair Type
                </label>
                <div className="space-y-3">
                  <label className="flex items-center p-4 border border-gray-400 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
                    <input
                      type="radio"
                      name="repairType"
                      value="small"
                      checked={repairType === "small"}
                      onChange={(e) =>
                        setRepairType(e.target.value as RepairType)
                      }
                      className="mr-3 text-green-600 focus:ring-green-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-300">
                        Small Repair
                      </div>
                      <div className="text-sm text-gray-400">
                        $50 - $99 (10 RCN base reward)
                      </div>
                    </div>
                  </label>
                  <label className="flex items-center p-4 border border-gray-400 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors">
                    <input
                      type="radio"
                      name="repairType"
                      value="large"
                      checked={repairType === "large"}
                      onChange={(e) =>
                        setRepairType(e.target.value as RepairType)
                      }
                      className="mr-3 text-green-600 focus:ring-green-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-300">
                        Large Repair
                      </div>
                      <div className="text-sm text-gray-400">
                        $100+ (25 RCN base reward)
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Reward Calculation */}
              <div
                className="bg-gray-50 rounded-xl p-4 space-y-2"
                style={{
                  backgroundImage: `url('/img/stat-card.png')`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                }}
              >
                <h3 className="font-semibold text-[#FFCC00]">
                  Reward Calculation
                </h3>
                <div className="text-sm space-y-1">
                  <div className="flex mt-10 justify-between">
                    <span className="text-gray-400">Base Reward:</span>
                    <span className="font-medium text-gray-100">
                      {baseReward} RCN
                    </span>
                  </div>
                  {customerInfo && (
                    <div className="flex justify-between pb-6">
                      <span className="text-gray-400">
                        {customerInfo.tier} Tier Bonus:
                      </span>
                      <span className={`font-medium text-gray-100`}>
                        +{tierBonus} RCN
                      </span>
                    </div>
                  )}
                  <div className="border-t pt-1 flex justify-between font-semibold">
                    <span className="text-gray-100">Total Reward:</span>
                    <span className="text-green-600">{totalReward} RCN</span>
                  </div>
                </div>
              </div>

              {/* Customer Info */}
              {customerInfo && (
                <div
                  className="bg-blue-50 rounded-xl p-4 space-y-2"
                  style={{
                    backgroundImage: `url('/img/stat-card.png')`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                  }}
                >
                  <h3 className="font-semibold text-[#FFCC00]">
                    Customer Status
                  </h3>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Current Tier:</span>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          customerInfo.tier === "GOLD"
                            ? "bg-yellow-100 text-yellow-800"
                            : customerInfo.tier === "SILVER"
                            ? "bg-gray-100 text-gray-800"
                            : "bg-orange-100 text-orange-800"
                        }`}
                      >
                        {customerInfo.tier}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Lifetime Earnings:</span>
                      <span className="font-medium">
                        {customerInfo.lifetimeEarnings} RCN
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Daily Earnings:</span>
                      <span
                        className={`font-medium ${
                          !dailyLimit.withinLimit ? "text-red-600" : ""
                        }`}
                      >
                        {customerInfo.dailyEarnings} / 50 RCN
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Monthly Earnings:</span>
                      <span
                        className={`font-medium ${
                          !monthlyLimit.withinLimit ? "text-red-600" : ""
                        }`}
                      >
                        {customerInfo.monthlyEarnings} / 500 RCN
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Limit Warnings */}
              {!canIssueReward && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <h4 className="text-sm font-medium text-red-800 mb-1">
                    Earning Limit Exceeded
                  </h4>
                  <p className="text-sm text-red-700">
                    {!dailyLimit.withinLimit &&
                      `Customer has reached daily limit. ${dailyLimit.remaining} RCN remaining today.`}
                    {!monthlyLimit.withinLimit &&
                      `Customer has reached monthly limit. ${monthlyLimit.remaining} RCN remaining this month.`}
                  </p>
                </div>
              )}

              {/* Balance Warning */}
              {!hasSufficientBalance && totalReward > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <h4 className="text-sm font-medium text-yellow-800 mb-1">
                    Low RCN Balance
                  </h4>
                  <p className="text-sm text-yellow-700">
                    Your shop doesn't have enough RCN to issue this reward.
                    Purchase more RCN or reduce the repair amount.
                  </p>
                </div>
              )}

              <button
                onClick={issueReward}
                disabled={processing || !customerAddress || !canIssueReward}
                className="w-full bg-[#FFCC00] flex items-center justify-center gap-2 text-black font-bold py-4 px-6 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 transform hover:scale-105"
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 20L4.6797 10.8496C4.34718 10.434 4.18092 10.2262 4.13625 9.9757C4.09159 9.72524 4.17575 9.47276 4.34407 8.96778L5.0883 6.73509C5.52832 5.41505 5.74832 4.75503 6.2721 4.37752C6.79587 4 7.49159 4 8.88304 4H15.117C16.5084 4 17.2041 4 17.7279 4.37752C18.2517 4.75503 18.4717 5.41505 18.9117 6.73509L19.6559 8.96778C19.8243 9.47276 19.9084 9.72524 19.8637 9.9757C19.8191 10.2262 19.6528 10.434 19.3203 10.8496L12 20ZM12 20L15.5 9M12 20L8.5 9M19.5 10L15.5 9M15.5 9L14 5M15.5 9H8.5M10 5L8.5 9M8.5 9L4.5 10"
                    stroke="#2F2F2F"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                {processing
                  ? "Issuing Reward..."
                  : `Issue ${totalReward} RCN Reward`}
              </button>
            </div>
          </div>
        </div>

        {/* Information Panel */}
        <div className="space-y-6">
          <div className="bg-[#1C1C1C] rounded-2xl">
            <div
              className="w-full px-8 py-20 text-white rounded-t-3xl"
              style={{
                backgroundImage: `url('/img/shop-issue-rewards-3.png')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            ></div>
            <div className="bg-[#1C1C1C] rounded-2xl shadow-xl p-8">
              <p className="text-2xl font-bold text-[#FFCC00] mb-4">
                Reward Structure
              </p>
              <div className="space-y-4">
                <div
                  className="flex flex-col gap-4 p-6 rounded-xl"
                  style={{
                    backgroundImage: `url('/img/shop-dash-2.png')`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                  }}
                >
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
                </div>

                <div className="pt-4">
                  <div
                    className="flex flex-col gap-4 p-6 rounded-xl"
                    style={{
                      backgroundImage: `url('/img/shop-issue-rewards-2.png')`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      backgroundRepeat: "no-repeat",
                    }}
                  >
                    <p className="font-semibold text-sm text-[#FFCC00] mb-3">
                      Tier Bonuses (Auto-Applied)
                    </p>
                    <TierBonus
                      tier="BRONZE"
                      bonus="+10 RCN"
                      requirement="0-199 lifetime RCN"
                    />
                    <TierBonus
                      tier="SILVER"
                      bonus="+20 RCN"
                      requirement="200-999 lifetime RCN"
                    />
                    <TierBonus
                      tier="GOLD"
                      bonus="+30 RCN"
                      requirement="1000+ lifetime RCN"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#1C1C1C] rounded-2xl shadow-xl p-8">
            <h3 className="text-2xl font-bold text-[#FFCC00] mb-4">
              Earning Limits
            </h3>
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
            <p className="text-xs text-gray-400 text-center mt-4">
              Tier bonuses don't count towards these limits, encouraging
              customer loyalty.
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

const RewardTier: React.FC<RewardTierProps> = ({
  range,
  baseReward,
  description,
}) => {
  return (
    <div className="flex w-3/4 justify-between items-center">
      <div>
        <p className="font-medium text-gray-100">{range}</p>
        <p className="text-sm text-gray-400">{description}</p>
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
    BRONZE: "text-orange-400",
    SILVER: "text-gray-300",
    GOLD: "text-[#FFCC00]",
  };

  return (
    <div className="flex w-3/4 justify-between items-center border-b-[1px] border-gray-600">
      <div className="flex w-2/3 justify-between items-center gap-2">
        <span
          className={`px-2 py-1 rounded-full text-xs font-semibold ${
            tierColors[tier as keyof typeof tierColors]
          }`}
        >
          {tier}
        </span>
        <span className="text-sm text-gray-500">{requirement}</span>
      </div>
      <span className="font-semibold text-gray-100">{bonus}</span>
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
    <div 
      className="flex px-6 justify-between items-center p-3 bg-blue-50 rounded-xl"
      style={{
        backgroundImage: `url('/img/stat-card.png')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="space-y-1">
        <p className="font-medium text-[#FFCC00] text-base">{type}</p>
        <p className="text-xs text-gray-400">{description}</p>
      </div>
      <span className="font-semibold text-gray-100 text-lg">{amount}</span>
    </div>
  );
};
