"use client";

import React, { useEffect } from "react";
import { useReadContract } from "thirdweb/react";
import { getContract, createThirdwebClient } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";
import { WalletIcon, TrophyIcon, RepairsIcon, CheckShieldIcon } from "../icon";
import { useCustomer } from "@/hooks/useCustomer";

const client = createThirdwebClient({
  clientId:
    process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID ||
    "1969ac335e07ba13ad0f8d1a1de4f6ab",
});

const contract = getContract({
  client,
  chain: baseSepolia,
  address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS!,
});

export const OverviewTab: React.FC = () => {
  const { 
    customerData, 
    earnedBalanceData, 
    transactions, 
    blockchainBalance,
    isLoading,
    error,
    fetchCustomerData,
    lastFetchTime
  } = useCustomer();

  // Read token balance from contract
  const { data: tokenBalance } = useReadContract({
    contract,
    method: "function balanceOf(address) view returns (uint256)",
    params: customerData?.address ? [customerData.address] : [""],
  });

  // Fetch data on mount only if not cached
  useEffect(() => {
    // Only fetch if we don't have data or if it's been more than 5 minutes
    if (!lastFetchTime) {
      fetchCustomerData();
    }
  }, [lastFetchTime, fetchCustomerData]);

  // Update blockchain balance from contract
  useEffect(() => {
    if (tokenBalance) {
      const formattedBalance = Number(tokenBalance) / 1e18;
      // You could update the context here if needed
    }
  }, [tokenBalance]);

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

  // Only show loading on initial load, not when switching tabs
  if (isLoading && !customerData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-yellow-400 border-t-transparent"></div>
      </div>
    );
  }

  if (error && !customerData) {
    return (
      <div className="bg-red-50 rounded-xl p-6 text-center">
        <p className="text-red-600">{error}</p>
        <button 
          onClick={() => fetchCustomerData(true)}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  // Display cached data immediately, even if refreshing in background
  return (
    <>
      {/* Refresh indicator */}
      {isLoading && customerData && (
        <div className="mb-4 flex items-center justify-end">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-yellow-400 border-t-transparent"></div>
            <span>Refreshing data...</span>
          </div>
        </div>
      )}

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
              {customerData?.tier || "BRONZE"}
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

      {/* Transaction History - Full view */}
      <div className="bg-[#212121] rounded-xl sm:rounded-2xl lg:rounded-3xl overflow-hidden mb-6 sm:mb-8">
        <div
          className="w-full px-4 sm:px-6 lg:px-8 py-3 sm:py-4 text-white rounded-t-xl sm:rounded-t-2xl lg:rounded-t-3xl flex justify-between items-center"
          style={{
            backgroundImage: `url('/img/cust-ref-widget3.png')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          <p className="text-lg md:text-xl text-gray-900 font-semibold">
            Transaction History
          </p>
          {lastFetchTime && (
            <button
              onClick={() => fetchCustomerData(true)}
              className="text-xs px-3 py-1 bg-black/20 hover:bg-black/30 rounded-full transition-colors"
              title="Refresh data"
            >
              🔄 Refresh
            </button>
          )}
        </div>
        <div className="bg-[#212121]">
          {transactions.length === 0 ? (
            <div className="text-center py-8 sm:py-12">
              <div className="text-4xl sm:text-5xl mb-3 sm:mb-4">📋</div>
              <p className="text-gray-500 text-sm sm:text-base">No transactions yet</p>
              <p className="text-xs sm:text-sm text-gray-400 mt-2 px-4">
                Start earning RCN by visiting participating repair shops!
              </p>
            </div>
          ) : (
            <>
              {/* Mobile View - Cards */}
              <div className="block sm:hidden p-4 space-y-3">
                {transactions.map((transaction) => (
                  <div key={transaction.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">
                          {transaction.description}
                        </p>
                        {transaction.shopName && (
                          <p className="text-xs text-gray-500 mt-1">
                            {transaction.shopName}
                          </p>
                        )}
                      </div>
                      <span className={`text-sm font-bold ${
                        transaction.type === 'redeemed' 
                          ? 'text-red-600' 
                          : 'text-green-600'
                      }`}>
                        {transaction.type === 'redeemed' ? '-' : '+'}
                        {transaction.amount} RCN
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        transaction.type === 'redeemed' 
                          ? 'bg-red-100 text-red-800' 
                          : transaction.type === 'tier_bonus'
                          ? 'bg-purple-100 text-purple-800'
                          : transaction.type === 'referral'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {transaction.type === 'earned' ? 'Repair' : 
                         transaction.type === 'tier_bonus' ? 'Bonus' :
                         transaction.type === 'referral' ? 'Referral' :
                         transaction.type === 'redeemed' ? 'Redeemed' : 
                         transaction.type}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(transaction.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Tablet/Desktop View - Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="hidden md:table-cell px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Shop
                      </th>
                      <th className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {transactions.map((transaction) => (
                      <tr key={transaction.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-600">
                          <div>
                            <div className="font-medium">{new Date(transaction.createdAt).toLocaleDateString()}</div>
                            <div className="text-xs text-gray-400 hidden lg:block">
                              {new Date(transaction.createdAt).toLocaleTimeString()}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 text-xs sm:text-sm text-gray-900">
                          <div className="font-medium line-clamp-2">
                            {transaction.description}
                          </div>
                        </td>
                        <td className="hidden md:table-cell px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-600">
                          {transaction.shopName || 
                            <span className="text-gray-400">—</span>
                          }
                        </td>
                        <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            transaction.type === 'redeemed' 
                              ? 'bg-red-100 text-red-800' 
                              : transaction.type === 'tier_bonus'
                              ? 'bg-purple-100 text-purple-800'
                              : transaction.type === 'referral'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {transaction.type === 'earned' ? 'Repair' : 
                             transaction.type === 'tier_bonus' ? 'Bonus' :
                             transaction.type === 'referral' ? 'Referral' :
                             transaction.type === 'redeemed' ? 'Redeemed' : 
                             transaction.type}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 lg:px-6 py-3 sm:py-4 whitespace-nowrap text-right">
                          <span className={`text-xs sm:text-sm font-bold ${
                            transaction.type === 'redeemed' 
                              ? 'text-red-600' 
                              : 'text-green-600'
                          }`}>
                            {transaction.type === 'redeemed' ? '-' : '+'}
                            {transaction.amount} RCN
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};