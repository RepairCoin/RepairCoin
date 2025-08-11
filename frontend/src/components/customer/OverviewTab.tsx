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
            <p className="text-yellow-400 text-xs sm:text-sm font-medium mb-1">
              RCN Balance
            </p>
            <p className="text-white text-xl sm:text-2xl font-bold">
              {blockchainBalance || 0} RCN
            </p>
            {earnedBalanceData && earnedBalanceData.marketBalance > 0 && (
              <p className="text-gray-400 text-xs mt-1">
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
            <p className="text-yellow-400 text-xs sm:text-sm font-medium mb-1">
              Your Tier Level
            </p>
            <p className="text-white text-xl sm:text-2xl font-bold">
              {customerData?.tier || "SILVER"}
            </p>
            {customerData && customerData.tier !== "GOLD" && (
              <p className="text-gray-400 text-xs mt-1">
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
            <p className="text-yellow-400 text-xs sm:text-sm font-medium mb-1">
              Total Repairs
            </p>
            <p className="text-white text-xl sm:text-2xl font-bold">
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
        <div
          className="rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg"
          style={{
            backgroundImage: `url(/img/tier-benefits.png)`,
            backgroundSize: "cover",
          }}
        >
          <div className="flex justify-between items-start mb-4 sm:mb-6">
            <h3 className="text-yellow-400 text-base sm:text-lg font-bold">
              Token Summary
            </h3>
          </div>
          <div className="space-y-3 sm:space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-300 text-sm sm:text-base">
                Tokens Earned:
              </span>
              <span className="font-bold text-green-500 text-sm sm:text-base">
                {customerData?.lifetimeEarnings || 0} RCN
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-300 text-sm sm:text-base">
                Tokens Redeemed:
              </span>
              <span className="font-bold text-red-500 text-sm sm:text-base">
                -{customerData?.totalRedemptions || 0} RCN
              </span>
            </div>
            <div className="h-px bg-gray-700 my-3"></div>
            <div className="flex justify-between items-center">
              <span className="text-gray-300 font-medium text-sm sm:text-base">
                Current Balance:
              </span>
              <span className="font-bold text-yellow-400 text-sm sm:text-base">
                {blockchainBalance || 0} RCN
              </span>
            </div>
          </div>
        </div>

        {/* Tier Benefits Card */}
        <div
          className="flex flex-col sm:flex-row rounded-xl sm:rounded-2xl shadow-lg overflow-hidden"
          style={{
            backgroundImage: `url(/img/tier-benefits.png)`,
            backgroundSize: "cover",
          }}
        >
          <div className="flex-1 p-4 sm:p-6">
            <div className="flex justify-between items-start mb-4 sm:mb-6">
              <h3 className="text-yellow-400 text-base sm:text-lg font-bold">
                Tier Benefits
              </h3>
            </div>
            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex-shrink-0">
                  <CheckShieldIcon width={20} height={20} />
                </div>
                <span className="text-gray-300 text-sm sm:text-base">
                  All {customerData?.tier || "Bronze"} Benefits
                </span>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex-shrink-0">
                  <CheckShieldIcon width={20} height={20} />
                </div>
                <span className="text-gray-300 text-sm sm:text-base">
                  Cross Shop Redemption
                </span>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex-shrink-0">
                  <CheckShieldIcon width={20} height={20} />
                </div>
                <span className="text-gray-300 text-sm sm:text-base">
                  Referral Bonus Available
                </span>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex-shrink-0">
                  <CheckShieldIcon width={20} height={20} />
                </div>
                <span className="text-gray-300 text-sm sm:text-base">
                  Early Access to Promos
                </span>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex-shrink-0">
                  <CheckShieldIcon width={20} height={20} />
                </div>
                <span className="text-gray-300 text-sm sm:text-base">
                  Priority Support Access
                </span>
              </div>
            </div>
          </div>

          <div className="h-32 sm:h-auto sm:flex-1 flex justify-center items-center p-4 sm:p-0">
            <img
              src="/img/customer-avatar2.png"
              className="h-full sm:w-full sm:h-full object-contain sm:object-cover"
              alt="Customer Avatar"
            />
          </div>
        </div>
      </div>

      {/* Recent Transactions - Responsive */}
      {transactions.length > 0 && (
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 lg:p-8 border border-gray-100 mb-6 sm:mb-8">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6">
            Recent Transactions
          </h2>
          <div className="space-y-2 sm:space-y-3">
            {transactions.slice(0, 5).map((transaction) => (
              <div
                key={transaction.id}
                className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 sm:p-4 bg-gray-50 rounded-lg"
              >
                <div className="mb-2 sm:mb-0">
                  <p className="font-medium text-gray-900 text-sm sm:text-base">
                    {transaction.description}
                  </p>
                  {transaction.shopName && (
                    <p className="text-xs sm:text-sm text-gray-500">
                      at {transaction.shopName}
                    </p>
                  )}
                  <p className="text-xs text-gray-400">
                    {new Date(transaction.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div
                  className={`font-bold text-sm sm:text-base ${
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

      {/* How to Earn More RepairCoin Section - Responsive */}
      <div
        className="my-8 sm:my-12 lg:my-20 bg-gradient-to-b from-[#1A1A1A] to-[#2A2A2A] rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-shadow"
        style={{
          backgroundImage: `url('/img/cus-how-to-earn.png')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <h2 className="text-xl sm:text-2xl lg:text-3xl tracking-wide font-bold text-white my-4 sm:my-6 text-center px-2">
          How to Earn More RepairCoin
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-4 sm:mb-8">
          {/* Refer Friends Card */}
          <div className="rounded-xl sm:rounded-2xl p-4 sm:p-6 bg-black/20 backdrop-blur-sm">
            <div className="w-full h-32 sm:h-40 lg:h-48 mb-3 sm:mb-4 flex items-center justify-center overflow-hidden rounded-xl sm:rounded-2xl">
              <img
                src="/img/story1.png"
                alt="Refer Friends"
                className="w-full h-full object-contain"
              />
            </div>
            <h3 className="text-[#FFCC00] text-base sm:text-lg font-semibold mb-2 text-center tracking-wide">
              Refer Friends
            </h3>
            <p className="text-gray-300 text-xs sm:text-sm tracking-wide text-center">
              Earn 25 RCN for each successful referral. New customers get 10 RCN
              bonus. No limit on referrals.
            </p>
          </div>

          {/* Complete Repairs Card */}
          <div className="rounded-xl sm:rounded-2xl p-4 sm:p-6 bg-black/20 backdrop-blur-sm">
            <div className="w-full h-32 sm:h-40 lg:h-48 mb-3 sm:mb-4 flex items-center justify-center overflow-hidden rounded-xl sm:rounded-2xl">
              <img
                src="/img/whatWeDo3.png"
                alt="Complete Repairs"
                className="w-full h-full object-contain"
              />
            </div>
            <h3 className="text-[#FFCC00] text-base sm:text-lg font-semibold mb-2 text-center tracking-wide">
              Complete Repairs
            </h3>
            <p className="text-gray-300 text-xs sm:text-sm tracking-wide text-center">
              Earn 10 RCN for $50-99 repairs. Earn 25 RCN for $100+ repairs.
              Plus tier bonuses!
            </p>
          </div>

          {/* Upgrade Your Tier Card */}
          <div className="rounded-xl sm:rounded-2xl p-4 sm:p-6 bg-black/20 backdrop-blur-sm sm:col-span-2 lg:col-span-1">
            <div className="w-full h-32 sm:h-40 lg:h-48 mb-3 sm:mb-4 flex items-center justify-center overflow-hidden rounded-xl sm:rounded-2xl">
              <img
                src="/img/customer-avatar.png"
                alt="Upgrade Your Tier"
                className="w-full h-full object-contain"
              />
            </div>
            <h3 className="text-[#FFCC00] text-base sm:text-lg font-semibold mb-2 text-center tracking-wide">
              Upgrade Your Tier
            </h3>
            <p className="text-gray-300 text-xs sm:text-sm tracking-wide text-center">
              Bronze: 0-99 RCN Earned. Silver: 100-499 RCN Earned. Gold: 500+
              RCN Earned.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};
