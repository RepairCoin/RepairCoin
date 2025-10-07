"use client";

import React, { useEffect } from "react";
import { useReadContract } from "thirdweb/react";
import { getContract, createThirdwebClient } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";
import { WalletIcon, TrophyIcon, RepairsIcon, CheckShieldIcon } from "../icon";
import { useCustomer } from "@/hooks/useCustomer";
import { useCustomerStore } from "@/stores/customerStore";
import { StatCard } from "../ui/StatCard";
import { DataTable, type Column } from "../ui/DataTable";
import { DashboardHeader } from "../ui/DashboardHeader";

const client = createThirdwebClient({
  clientId:
    process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID ||
    "1969ac335e07ba13ad0f8d1a1de4f6ab",
});

const contract = getContract({
  client,
  chain: baseSepolia,
  address: (process.env.NEXT_PUBLIC_RCN_CONTRACT_ADDRESS ||
    process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
    "0xBFE793d78B6B83859b528F191bd6F2b8555D951C") as `0x${string}`,
});

// Helper function to get next tier information
const getNextTier = (currentTier: string) => {
  switch (currentTier) {
    case "BRONZE":
      return { tier: "SILVER", requirement: 200 };
    case "SILVER":
      return { tier: "GOLD", requirement: 1000 };
    default:
      return { tier: "GOLD", requirement: 1000 };
  }
};

export const OverviewTab: React.FC = () => {
  const {
    customerData,
    balanceData,
    transactions,
    blockchainBalance,
    isLoading,
    error,
    fetchCustomerData,
  } = useCustomer();

  // Use dummy data if no real transactions
  const displayTransactions = transactions.length > 0 ? transactions : [];

  // Define columns for DataTable
  const transactionColumns: Column[] = [
    {
      key: "date",
      header: "Date",
      accessor: (transaction: any) => (
        <div>
          <div className="font-medium text-gray-300">
            {new Date(transaction.createdAt).toLocaleDateString()}
          </div>
          <div className="text-xs text-gray-500">
            {new Date(transaction.createdAt).toLocaleTimeString()}
          </div>
        </div>
      ),
      className: "text-sm",
    },
    {
      key: "description",
      header: "Description",
      accessor: (transaction: any) => (
        <div className="text-gray-200">{transaction.description}</div>
      ),
      className: "text-sm",
    },
    {
      key: "shop",
      header: "Shop",
      accessor: (transaction: any) => (
        <span className="text-gray-400">{transaction.shopName || "—"}</span>
      ),
      className: "text-sm hidden md:table-cell",
      headerClassName: "hidden md:table-cell",
    },
    {
      key: "type",
      header: "Type",
      accessor: (transaction: any) => (
        <span
          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
            transaction.type === "redeemed"
              ? "bg-red-900/30 text-red-400 border border-red-800/50"
              : transaction.type === "tier_bonus"
              ? "bg-purple-900/30 text-purple-400 border border-purple-800/50"
              : transaction.type === "referral"
              ? "bg-blue-900/30 text-blue-400 border border-blue-800/50"
              : "bg-green-900/30 text-green-400 border border-green-800/50"
          }`}
        >
          {transaction.type === "earned"
            ? "Repair"
            : transaction.type === "tier_bonus"
            ? "Bonus"
            : transaction.type === "referral"
            ? "Referral"
            : transaction.type === "redeemed"
            ? "Redeemed"
            : transaction.type}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      accessor: (transaction: any) => (
        <span
          className={`text-sm font-bold ${
            transaction.type === "redeemed" ? "text-red-400" : "text-green-400"
          }`}
        >
          {transaction.type === "redeemed" ? "-" : "+"}
          {transaction.amount} RCN
        </span>
      ),
      className: "text-right",
      headerClassName: "text-right",
    },
  ];

  // Read token balance from contract
  const { data: tokenBalance } = useReadContract({
    contract,
    method: "function balanceOf(address) view returns (uint256)",
    params: customerData?.address ? [customerData.address] : [""],
  });

  // Fetch data on mount if needed
  useEffect(() => {
    if (!customerData) {
      fetchCustomerData();
    }
  }, [customerData, fetchCustomerData]);

  // Update blockchain balance from contract
  useEffect(() => {
    if (tokenBalance !== undefined) {
      const formattedBalance = Number(tokenBalance) / 1e18;
      // Update the store with the actual blockchain balance
      useCustomerStore.getState().setBlockchainBalance(formattedBalance);
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
      {/* Header with gradient background */}
      <DashboardHeader
        title={`Hello 👋, ${customerData?.name || "Guest"}`}
        subtitle="Overview of your account"
      />
      {/* Stats Grid - Responsive */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
        {/* RCN Balance Card */}
        <StatCard
          title="Available Balance"
          value={`${balanceData?.availableBalance || 0} RCN`}
          subtitle={
            balanceData
              ? `${balanceData.lifetimeEarned || 0} earned, ${balanceData.totalRedeemed || 0} redeemed`
              : undefined
          }
          icon={<WalletIcon />}
          titleClassName="text-yellow-400 text-sm md:text-base font-medium"
          valueClassName="text-white text-lg sm:text-xl md:text-2xl font-semibold"
          subtitleClassName="text-gray-400 text-xs sm:text-sm"
        />

        {/* Total Repairs Card */}
        <StatCard
          title="Tokens Redeemed"
          value={balanceData?.totalRedeemed || 0}
          icon={<RepairsIcon />}
          titleClassName="text-yellow-400 text-sm md:text-base font-medium"
          valueClassName="text-white text-lg sm:text-xl md:text-2xl font-semibold"
        />

        {/* Total Repairs Card */}
        <StatCard
          title="Tokens Earned"
          value={balanceData?.lifetimeEarned || 0}
          icon={<RepairsIcon />}
          titleClassName="text-yellow-400 text-sm md:text-base font-medium"
          valueClassName="text-white text-lg sm:text-xl md:text-2xl font-semibold"
        />

        {/* Customer Tier Card */}
        <StatCard
          title="Your Tier Level"
          value={customerData?.tier || "BRONZE"}
          icon={<TrophyIcon tier={customerData?.tier || "BRONZE"} />}
          titleClassName="text-yellow-400 text-sm md:text-base font-medium"
          valueClassName="text-white text-lg sm:text-xl md:text-2xl font-semibold"
          subtitleClassName="text-gray-400 text-xs sm:text-sm"
        />
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
        </div>
        <div className="bg-[#212121] p-4">
          <DataTable
            data={displayTransactions}
            columns={transactionColumns}
            keyExtractor={(transaction) => transaction.id}
            emptyMessage="No transactions yet"
            emptyIcon={
              <div className="text-center">
                <div className="text-4xl sm:text-5xl mb-3 sm:mb-4">📋</div>
                <p className="text-gray-500 text-sm sm:text-base mb-2">
                  No transactions yet
                </p>
                <p className="text-xs sm:text-sm text-gray-400">
                  Start earning RCN by visiting participating repair shops!
                </p>
              </div>
            }
            className="w-full"
            headerClassName="bg-gray-800/50"
          />
        </div>
      </div>
    </>
  );
};
