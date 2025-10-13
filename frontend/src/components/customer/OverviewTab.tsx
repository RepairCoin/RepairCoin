"use client";

import React, { useEffect, useState } from "react";
import { useReadContract, useActiveAccount } from "thirdweb/react";
import { getContract, createThirdwebClient } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";
import { WalletIcon, TrophyIcon, RepairsIcon, CheckShieldIcon } from "../icon";
import { useCustomer } from "@/hooks/useCustomer";
import { useCustomerStore } from "@/stores/customerStore";
import { StatCard } from "../ui/StatCard";
import { DataTable, type Column } from "../ui/DataTable";
import { DashboardHeader } from "../ui/DashboardHeader";
import { Coins, X, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "react-hot-toast";

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
  const account = useActiveAccount();
  const {
    customerData,
    balanceData,
    transactions,
    blockchainBalance,
    isLoading,
    error,
    fetchCustomerData,
  } = useCustomer();

  // Mint to Wallet state
  const [showMintModal, setShowMintModal] = useState(false);
  const [mintAmount, setMintAmount] = useState("");
  const [isMinting, setIsMinting] = useState(false);

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
            {new Date(transaction.createdAt).toLocaleDateString('en-US', { timeZone: 'America/Chicago' })}
          </div>
          <div className="text-xs text-gray-500">
            {new Date(transaction.createdAt).toLocaleTimeString('en-US', { timeZone: 'America/Chicago' })}
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
              : transaction.type === "rejected_redemption"
              ? "bg-orange-900/30 text-orange-400 border border-orange-800/50"
              : transaction.type === "cancelled_redemption"
              ? "bg-gray-900/30 text-gray-400 border border-gray-800/50"
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
            : transaction.type === "rejected_redemption"
            ? "Rejected"
            : transaction.type === "cancelled_redemption"
            ? "Cancelled"
            : transaction.type}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      accessor: (transaction: any) => {
        // Handle rejection and cancellation transactions (amount = 0)
        if (transaction.type === "rejected_redemption" || transaction.type === "cancelled_redemption") {
          return (
            <span className="text-sm font-medium text-gray-400">
              {transaction.metadata?.originalRequestAmount || 0} RCN
              <div className="text-xs text-gray-500 mt-0.5">
                {transaction.type === "rejected_redemption" ? "Request rejected" : "Request cancelled"}
              </div>
            </span>
          );
        }
        
        // Handle normal transactions
        return (
          <span
            className={`text-sm font-bold ${
              transaction.type === "redeemed" ? "text-red-400" : "text-green-400"
            }`}
          >
            {transaction.type === "redeemed" ? "-" : "+"}
            {transaction.amount} RCN
          </span>
        );
      },
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

  // Mint to Wallet functionality
  const handleMintToWallet = async () => {
    if (!account?.address) {
      toast.error("Please connect your wallet first");
      return;
    }

    const amount = parseFloat(mintAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (amount > (balanceData?.availableBalance || 0)) {
      toast.error("Amount exceeds available balance");
      return;
    }

    setIsMinting(true);
    
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/customers/balance/${account.address}/queue-mint`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("customerAuthToken") || ""}`,
          },
          body: JSON.stringify({ amount }),
        }
      );

      const result = await response.json();

      if (response.ok) {
        toast.success(`Successfully queued ${amount} RCN for minting to your wallet!`);
        setShowMintModal(false);
        setMintAmount("");
        // Refresh customer data to update balances
        fetchCustomerData(true);
      } else {
        toast.error(result.error || "Failed to queue mint request");
      }
    } catch (error) {
      console.error("Mint error:", error);
      toast.error("Failed to process mint request");
    } finally {
      setIsMinting(false);
    }
  };

  const handleMaxMint = () => {
    setMintAmount(balanceData?.availableBalance?.toString() || "0");
  };

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

      {/* Mint to Wallet Section */}
      {balanceData && balanceData.availableBalance > 0 && (
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
              Mint RCN to Wallet
            </p>
          </div>
          <div className="bg-[#212121] p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="bg-[#FFCC00]/20 p-3 rounded-full">
                  <Coins className="w-6 h-6 text-[#FFCC00]" />
                </div>
                <div>
                  <p className="text-white font-medium text-sm sm:text-base">
                    Convert your offchain RCN to blockchain tokens
                  </p>
                  <p className="text-gray-400 text-xs sm:text-sm">
                    Available to mint: {balanceData.availableBalance} RCN
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMintModal(true)}
                className="px-4 py-2 bg-[#FFCC00] text-black rounded-lg font-medium hover:bg-yellow-500 transition-colors flex items-center gap-2 text-sm sm:text-base"
              >
                <Coins className="w-4 h-4" />
                Mint to Wallet
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Mint to Wallet Modal */}
      {showMintModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#212121] rounded-2xl max-w-md w-full mx-4">
            <div className="flex justify-between items-center p-6 border-b border-gray-700">
              <h3 className="text-xl font-semibold text-white">Mint RCN to Wallet</h3>
              <button
                onClick={() => setShowMintModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                {/* Balance Info */}
                <div className="bg-[#2F2F2F] p-4 rounded-lg">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Available Balance:</span>
                    <span className="text-[#FFCC00] font-medium">
                      {balanceData?.availableBalance || 0} RCN
                    </span>
                  </div>
                </div>

                {/* Amount Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Amount to Mint
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={mintAmount}
                      onChange={(e) => setMintAmount(e.target.value)}
                      placeholder="Enter amount"
                      min="0"
                      max={balanceData?.availableBalance || 0}
                      step="0.01"
                      className="w-full px-3 py-2 bg-[#2F2F2F] border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] pr-16"
                    />
                    <button
                      onClick={handleMaxMint}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 px-2 py-1 bg-[#FFCC00] text-black text-xs rounded font-medium hover:bg-yellow-500 transition-colors"
                    >
                      MAX
                    </button>
                  </div>
                </div>

                {/* Warning */}
                <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-200">
                    <p className="font-medium mb-1">Important:</p>
                    <p>Minting converts your offchain RCN to actual blockchain tokens. This process may take a few minutes to complete.</p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setShowMintModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleMintToWallet}
                    disabled={isMinting || !mintAmount || parseFloat(mintAmount) <= 0}
                    className="flex-1 px-4 py-2 bg-[#FFCC00] text-black rounded-lg hover:bg-yellow-500 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isMinting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Minting...
                      </>
                    ) : (
                      <>
                        <Coins className="w-4 h-4" />
                        Mint to Wallet
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
