"use client";

import React from "react";
import { WalletIcon, TrophyIcon, RepairsIcon, CheckShieldIcon } from "../icon";

interface CustomerData {
  address: string;
  email: string;
  name?: string;
  tier: "BRONZE" | "SILVER" | "GOLD";
  lifetimeEarnings: number;
  currentBalance: number;
  totalRedemptions: number;
  dailyEarnings: number;
  monthlyEarnings: number;
  isActive: boolean;
  suspensionReason?: string;
  lastEarnedDate?: string;
  joinDate: string;
}

interface EarnedBalanceData {
  earnedBalance: number;
  marketBalance: number;
  totalBalance: number;
}

interface TransactionHistory {
  id: string;
  type: "earned" | "redeemed" | "bonus" | "referral" | "tier_bonus";
  amount: number;
  shopId?: string;
  shopName?: string;
  description: string;
  createdAt: string;
}

interface OverviewTabProps {
  customerData: CustomerData | null;
  blockchainBalance: number;
  earnedBalanceData: EarnedBalanceData | null;
  transactions: TransactionHistory[];
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  customerData,
  blockchainBalance,
  earnedBalanceData,
  transactions,
}) => {
  const getNextTier = (
    currentTier: string
  ): { tier: string; requirement: number } => {
    switch (currentTier.toUpperCase()) {
      case "BRONZE":
        return { tier: "SILVER", requirement: 200 };
      case "SILVER":
        return { tier: "GOLD", requirement: 1000 };
      case "GOLD":
        return { tier: "GOLD", requirement: 0 };
      default:
        return { tier: "SILVER", requirement: 200 };
    }
  };

  return (
    <>
      {/* Stats Grid - Responsive */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
        {/* RCN Balance Card */}
        <div
          className="bg-gradient-to-r from-black to-[#3C3C3C] rounded-xl sm:rounded-2xl p-4 sm:px-6 sm:py-4 shadow-lg flex justify-between items-center"
          style={{
            backgroundImage: `url(/img/stat-card.png)`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          <div className="flex-1">
            <p className="text-yellow-400 text-sm md:text-base font-medium mb-1">
              RCN Balance
            </p>
            <p className="text-white text-lg sm:text-xl md:text-2xl font-semibold">
              {blockchainBalance || 0} RCN
            </p>
            {earnedBalanceData && earnedBalanceData.marketBalance > 0 && (
              <p className="text-gray-400 text-xs sm:text-sm mt-1">
                {earnedBalanceData.earnedBalance} earned,{" "}
                {earnedBalanceData.marketBalance} bought
              </p>
            )}
          </div>
          <div className="w-16 sm:w-20 ml-3 flex-shrink-0">
            <WalletIcon />
          </div>
        </div>

        {/* Customer Tier Card */}
        <div
          className="bg-gradient-to-r from-black to-[#3C3C3C] rounded-xl sm:rounded-2xl p-4 sm:px-6 sm:py-4 shadow-lg flex justify-between items-center"
          style={{
            backgroundImage: `url(/img/stat-card.png)`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          {" "}
          <div className="flex-1">
            <p className="text-yellow-400 text-sm md:text-base font-medium mb-1">
              Your Tier Level
            </p>
            <p className="text-white text-lg sm:text-xl md:text-2xl font-semibold">
              {customerData?.tier || "SILVER"}
            </p>
            {customerData && customerData.tier !== "GOLD" && (
              <p className="text-gray-400 text-xs sm:text-sm mt-1">
                {getNextTier(customerData.tier).requirement -
                  customerData.lifetimeEarnings}{" "}
                RCN to {getNextTier(customerData.tier).tier}
              </p>
            )}
          </div>
          <div className="w-16 sm:w-20 ml-3 flex-shrink-0">
            <TrophyIcon />
          </div>
        </div>

        {/* Total Repairs Card */}
        <div
          className="bg-gradient-to-r from-black to-[#3C3C3C] rounded-xl sm:rounded-2xl p-4 sm:px-6 sm:py-4 shadow-lg flex justify-between items-center"
          style={{
            backgroundImage: `url(/img/stat-card.png)`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          {" "}
          <div className="flex-1">
            <p className="text-yellow-400 text-sm md:text-base font-medium mb-1">
              Total Repairs
            </p>
            <p className="text-white text-lg sm:text-xl md:text-2xl font-semibold">
              {customerData?.lifetimeEarnings || 0}
            </p>
          </div>
          <div className="w-16 sm:w-20 ml-3 flex-shrink-0">
            <RepairsIcon />
          </div>
        </div>
      </div>

      {/* Earnings Overview - Responsive */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
        {/* Token Summary Card */}
        <div className="bg-[#212121] rounded-xl sm:rounded-2xl lg:rounded-3xl overflow-hidden">
          <div
            className="w-full px-4 sm:px-6 lg:px-8 py-3 sm:py-4 text-white rounded-t-xl sm:rounded-t-2xl lg:rounded-t-3xl"
            style={{
              backgroundImage: `url('/img/cust-ref-widget3.png')`,
              backgroundSize: "cover",
              backgroundPosition: "right",
              backgroundRepeat: "no-repeat",
            }}
          >
            <p className="text-base sm:text-lg md:text-xl text-gray-900 font-semibold">
              Token Summary
            </p>
          </div>
          <div className="space-y-3 sm:space-y-4 px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-300 text-sm">
                Tokens Earned:
              </span>
              <span className="font-semibold text-green-500 text-sm">
                {customerData?.lifetimeEarnings || 0} RCN
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-300 text-sm">
                Tokens Redeemed:
              </span>
              <span className="font-semibold text-red-500 text-sm">
                -{customerData?.totalRedemptions || 0} RCN
              </span>
            </div>
            <div className="h-px bg-gray-700 my-3"></div>
            <div className="flex justify-between items-center">
              <span className="text-gray-300 font-medium text-sm">
                Current Balance:
              </span>
              <span className="font-semibold text-yellow-400 text-sm">
                {blockchainBalance || 0} RCN
              </span>
            </div>
          </div>
        </div>

        {/* Tier Benefits Card */}
        <div className="bg-[#212121] rounded-xl sm:rounded-2xl lg:rounded-3xl overflow-hidden">
          <div
            className="w-full px-4 sm:px-6 lg:px-8 py-3 sm:py-4 text-white rounded-t-xl sm:rounded-t-2xl lg:rounded-t-3xl"
            style={{
              backgroundImage: `url('/img/cust-ref-widget3.png')`,
              backgroundSize: "cover",
              backgroundPosition: "right",
              backgroundRepeat: "no-repeat",
            }}
          >
            <p className="text-base sm:text-lg md:text-xl text-gray-900 font-semibold">
              Tier Benefits
            </p>
          </div>
          <div className="flex-1 p-4 sm:p-6 px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex-shrink-0">
                  <CheckShieldIcon width={20} height={20} />
                </div>
                <span className="text-gray-300 text-sm">
                  All {customerData?.tier || "Bronze"} Benefits
                </span>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex-shrink-0">
                  <CheckShieldIcon width={20} height={20} />
                </div>
                <span className="text-gray-300 text-sm">
                  Cross Shop Redemption
                </span>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex-shrink-0">
                  <CheckShieldIcon width={20} height={20} />
                </div>
                <span className="text-gray-300 text-sm">
                  Referral Bonus Available
                </span>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex-shrink-0">
                  <CheckShieldIcon width={20} height={20} />
                </div>
                <span className="text-gray-300 text-sm">
                  Early Access to Promos
                </span>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex-shrink-0">
                  <CheckShieldIcon width={20} height={20} />
                </div>
                <span className="text-gray-300 text-sm">
                  Priority Support Access
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Transactions - Responsive */}
      {transactions.length > 0 && (
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 lg:p-8 border border-gray-100 mb-6 sm:mb-8">
          <h2 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 mb-4 sm:mb-6">
            Recent Transactions
          </h2>
          <div className="space-y-2 sm:space-y-3">
            {transactions.slice(0, 5).map((transaction) => (
              <div
                key={transaction.id}
                className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 sm:p-4 bg-gray-50 rounded-lg"
              >
                <div className="mb-2 sm:mb-0">
                  <p className="font-medium text-gray-900 text-sm">
                    {transaction.description}
                  </p>
                  {transaction.shopName && (
                    <p className="text-xs text-gray-500">
                      at {transaction.shopName}
                    </p>
                  )}
                  <p className="text-xs text-gray-400">
                    {new Date(transaction.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div
                  className={`font-semibold text-sm ${
                    transaction.type === "redeemed"
                      ? "text-red-600"
                      : "text-green-600"
                  }`}
                >
                  {transaction.type === "redeemed" ? "-" : "+"}
                  {transaction.amount} RCN
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};
