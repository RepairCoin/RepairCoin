'use client';

import React from 'react';
import {
  WalletIcon,
  TrophyIcon,
  RepairsIcon,
  CheckShieldIcon,
} from '../icon';

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
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* RCN Balance Card */}
        <div className="bg-gradient-to-r from-black to-[#3C3C3C] rounded-2xl px-6 py-4 shadow-lg flex justify-between items-center">
          <div>
            <p className="text-yellow-400 text-sm font-medium mb-1">
              RCN Balance
            </p>
            <p className="text-white text-2xl font-bold">
              {blockchainBalance || 0} RCN
            </p>
            {earnedBalanceData &&
              earnedBalanceData.marketBalance > 0 && (
                <p className="text-gray-400 text-xs mt-1">
                  {earnedBalanceData.earnedBalance} earned,{" "}
                  {earnedBalanceData.marketBalance} bought
                </p>
              )}
          </div>
          <div className="w-20 rounded-lg">
            <WalletIcon />
          </div>
        </div>

        {/* Customer Tier Card */}
        <div className="bg-gradient-to-r from-black to-[#3C3C3C] rounded-2xl px-6 py-4 shadow-lg flex justify-between items-center">
          <div>
            <p className="text-yellow-400 text-sm font-medium mb-1">
              Your Tier Level
            </p>
            <p className="text-white text-2xl font-bold">
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
          <div className="w-20 rounded-lg">
            <TrophyIcon />
          </div>
        </div>

        {/* Total Repairs Card */}
        <div className="bg-gradient-to-r from-black to-[#3C3C3C] rounded-2xl px-6 py-4 shadow-lg flex justify-between items-center">
          <div>
            <p className="text-yellow-400 text-sm font-medium mb-1">
              Total Repairs
            </p>
            <p className="text-white text-2xl font-bold">
              {customerData?.lifetimeEarnings || 0}
            </p>
          </div>
          <div className="w-20 rounded-lg">
            <RepairsIcon />
          </div>
        </div>
      </div>

      {/* Earnings Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Token Summary Card */}
        <div
          className="rounded-2xl p-6 shadow-lg"
          style={{
            backgroundImage: `url(/img/tier-benefits.png)`,
            backgroundSize: "cover",
          }}
        >
          <div className="flex justify-between items-start mb-6">
            <h3 className="text-yellow-400 text-lg font-bold">
              Token Summary
            </h3>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Tokens Earned:</span>
              <span className="font-bold text-green-500">
                {customerData?.lifetimeEarnings || 0} RCN
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-300">Tokens Redeemed:</span>
              <span className="font-bold text-red-500">
                -{customerData?.totalRedemptions || 0} RCN
              </span>
            </div>
            <div className="h-px bg-gray-700 my-3"></div>
            <div className="flex justify-between items-center">
              <span className="text-gray-300 font-medium">
                Current Balance:
              </span>
              <span className="font-bold text-yellow-400">
                {blockchainBalance || 0} RCN
              </span>
            </div>
          </div>
        </div>

        {/* Tier Benefits Card */}
        <div
          className="flex rounded-2xl shadow-lg"
          style={{
            backgroundImage: `url(/img/tier-benefits.png)`,
            backgroundSize: "cover",
          }}
        >
          <div className="flex-1 p-6">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-yellow-400 text-lg font-bold">
                Tier Benefits
              </h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <CheckShieldIcon width={25} height={25} />
                <span className="text-gray-300">
                  All {customerData?.tier || "Bronze"} Benefits
                </span>
              </div>
              <div className="flex items-center gap-3">
                <CheckShieldIcon width={25} height={25} />
                <span className="text-gray-300">
                  Cross Shop Redemption
                </span>
              </div>
              <div className="flex items-center gap-3">
                <CheckShieldIcon width={25} height={25} />
                <span className="text-gray-300">
                  Referral Bonus Available
                </span>
              </div>
              <div className="flex items-center gap-3">
                <CheckShieldIcon width={25} height={25} />
                <span className="text-gray-300">
                  Early Access to Promos
                </span>
              </div>
              <div className="flex items-center gap-3">
                <CheckShieldIcon width={25} height={25} />
                <span className="text-gray-300">
                  Priority Support Access
                </span>
              </div>
            </div>
          </div>

          <div className="flex-1 flex justify-center items-center">
            <img
              src="/img/customer-avatar2.png"
              className="w-full h-full object-cover"
              alt="Customer Avatar"
            />
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      {transactions.length > 0 && (
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            Recent Transactions
          </h2>
          <div className="space-y-3">
            {transactions.slice(0, 5).map((transaction) => (
              <div
                key={transaction.id}
                className="flex justify-between items-center p-4 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {transaction.description}
                  </p>
                  {transaction.shopName && (
                    <p className="text-sm text-gray-500">
                      at {transaction.shopName}
                    </p>
                  )}
                  <p className="text-xs text-gray-400">
                    {new Date(
                      transaction.createdAt
                    ).toLocaleDateString()}
                  </p>
                </div>
                <div
                  className={`font-bold ${
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

      {/* How to Earn More RepairCoin Section */}
      <div
        className="my-20 bg-gradient-to-b from-[#1A1A1A] to-[#2A2A2A] rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow"
        style={{
          backgroundImage: `url('/img/cus-how-to-earn.png')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <h2 className="text-3xl tracking-wide font-bold text-white my-6 text-center">
          How to Earn More RepairCoin
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Refer Friends Card */}
          <div className="rounded-2xl p-6">
            <div className="w-full h-48 mb-4 flex items-center justify-center overflow-hidden rounded-2xl">
              <img
                src="/img/story1.png"
                alt="Refer Friends"
                className="w-full h-full object-contain"
              />
            </div>
            <h3 className="text-[#FFCC00] text-lg font-semibold mb-2 text-center tracking-wide">
              Refer Friends
            </h3>
            <p className="text-gray-300 text-sm tracking-wide">
              Earn 25 RCN for each successful referral. New customers
              get 10 RCN bonus. No limit on referrals.
            </p>
          </div>

          {/* Complete Repairs Card */}
          <div className="rounded-2xl p-6">
            <div className="w-full h-48 mb-4 flex items-center justify-center overflow-hidden rounded-2xl">
              <img
                src="/img/whatWeDo3.png"
                alt="Complete Repairs"
                className="w-full h-full object-contain"
              />
            </div>
            <h3 className="text-[#FFCC00] text-lg font-semibold mb-2 text-center tracking-wide">
              Complete Repairs
            </h3>
            <p className="text-gray-300 text-sm tracking-wide">
              Earn 10 RCN for $50-99 repairs. Earn 25 RCN for $100+
              repairs. Plus tier bonuses!
            </p>
          </div>

          {/* Upgrade Your Tier Card */}
          <div className="rounded-2xl p-6">
            <div className="w-full h-48 mb-4 flex items-center justify-center overflow-hidden rounded-2xl">
              <img
                src="/img/customer-avatar.png"
                alt="Upgrade Your Tier"
                className="w-full h-full object-contain"
              />
            </div>
            <h3 className="text-[#FFCC00] text-lg font-semibold mb-2 text-center tracking-wide">
              Upgrade Your Tier
            </h3>
            <p className="text-gray-300 text-sm tracking-wide">
              Bronze: 0-99 RCN Earned. Silver: 100-499 RCN Earned. Gold:
              500+ RCN Earned.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};