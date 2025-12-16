"use client";

import React, { useEffect, useState } from "react";
import { useReadContract, useActiveAccount } from "thirdweb/react";
import { getContract, createThirdwebClient } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";
import { WalletIcon, TrophyIcon, RedeemIcon, IssueRewardsIcon } from "../icon";
import { useCustomer } from "@/hooks/useCustomer";
import { useCustomerStore } from "@/stores/customerStore";
import { useAuthStore } from "@/stores/authStore";
import { StatCard } from "../ui/StatCard";
import { DataTable, type Column } from "../ui/DataTable";
import { DashboardHeader } from "../ui/DashboardHeader";
import { Coins, X, Loader2, AlertTriangle, CheckCircle, ExternalLink } from "lucide-react";
import { toast } from "react-hot-toast";
import Tooltip from "../ui/tooltip";
import apiClient from '@/services/api/client';
import GroupBalancesCard from "./GroupBalancesCard";
import { SuspendedActionModal } from "./SuspendedActionModal";

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
  const { userProfile } = useAuthStore();
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
  const [showSuspendedModal, setShowSuspendedModal] = useState(false);
  const [mintResult, setMintResult] = useState<{
    success: boolean;
    transactionHash?: string;
    amount?: number;
  } | null>(null);

  // Check if user is suspended
  const isSuspended = userProfile?.suspended || false;

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
            {new Date(transaction.createdAt).toLocaleDateString("en-US", {
              timeZone: "America/Chicago",
            })}
          </div>
          <div className="text-xs text-gray-500">
            {new Date(transaction.createdAt).toLocaleTimeString("en-US", {
              timeZone: "America/Chicago",
            })}
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
        if (
          transaction.type === "rejected_redemption" ||
          transaction.type === "cancelled_redemption"
        ) {
          return (
            <span className="text-sm font-medium text-gray-400">
              {transaction.metadata?.originalRequestAmount || 0} RCN
              <div className="text-xs text-gray-500 mt-0.5">
                {transaction.type === "rejected_redemption"
                  ? "Request rejected"
                  : "Request cancelled"}
              </div>
            </span>
          );
        }

        // Handle normal transactions
        return (
          <span
            className={`text-sm font-bold ${
              transaction.type === "redeemed"
                ? "text-red-400"
                : "text-green-400"
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

  // Mint to Wallet functionality - Instant mint to blockchain
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

    if (amount > 10000) {
      toast.error("Maximum mint amount is 10,000 RCN per transaction");
      return;
    }

    setIsMinting(true);
    setMintResult(null);

    try {
      const result = await apiClient.post(
        `/customers/balance/${account.address}/instant-mint`,
        { amount }
      ) as { success: boolean; data?: { transactionHash?: string; amount?: number }; error?: string };

      if (result.success) {
        // Show success state with transaction hash
        setMintResult({
          success: true,
          transactionHash: result.data?.transactionHash,
          amount: result.data?.amount || amount
        });
        toast.success(`Successfully minted ${amount} RCN to your wallet!`);
        setMintAmount("");
        // Refresh customer data to update balances
        fetchCustomerData(true);
      } else {
        toast.error(result.error || "Failed to mint tokens");
        setMintResult(null);
      }
    } catch (error) {
      console.error("Mint error:", error);
      const axiosError = error as { response?: { data?: { error?: string } }; message?: string };
      const errorMessage = axiosError?.response?.data?.error || axiosError?.message || "Failed to process mint request";
      toast.error(errorMessage);
      setMintResult(null);
    } finally {
      setIsMinting(false);
    }
  };

  // Close modal and reset state
  const handleCloseMintModal = () => {
    setShowMintModal(false);
    setMintAmount("");
    setMintResult(null);
  };

  // Get block explorer URL for transaction
  const getExplorerUrl = (txHash: string) => {
    // Base Sepolia explorer
    return `https://sepolia.basescan.org/tx/${txHash}`;
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6 mb-6 sm:mb-8">
        {/* RCN Balance Card */}
        <StatCard
          title="Available Balance"
          value={`${balanceData?.availableBalance || 0} RCN`}
          subtitle="Off-chain balance"
          icon={<WalletIcon />}
          titleClassName="text-yellow-400 text-sm md:text-base font-medium"
          valueClassName="text-white text-lg sm:text-xl md:text-2xl font-semibold"
          subtitleClassName="text-gray-400 text-xs sm:text-sm"
        />

        {/* Wallet Balance Card - On-chain */}
        <StatCard
          title="Wallet Balance"
          value={`${blockchainBalance || 0} RCN`}
          subtitle="On-chain balance"
          icon={
            <div className="w-6 h-6 text-green-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            </div>
          }
          titleClassName="text-green-400 text-sm md:text-base font-medium"
          valueClassName="text-white text-lg sm:text-xl md:text-2xl font-semibold"
          subtitleClassName="text-gray-400 text-xs sm:text-sm"
        />

        {/* Tokens Earned Card */}
        <StatCard
          title="Tokens Earned"
          value={balanceData?.lifetimeEarned || 0}
          icon={<IssueRewardsIcon />}
          titleClassName="text-yellow-400 text-sm md:text-base font-medium"
          valueClassName="text-white text-lg sm:text-xl md:text-2xl font-semibold"
        />

        {/* Tokens Redeemed Card */}
        <StatCard
          title="Tokens Redeemed"
          value={balanceData?.totalRedeemed || 0}
          icon={<RedeemIcon />}
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

      {/* Shop Group Tokens Card */}
      <GroupBalancesCard />

      {/* Pending Mint Balance Alert */}
      {balanceData && (balanceData.pendingMintBalance || 0) > 0 && (
        <div className="bg-[#212121] border border-yellow-500/30 rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex items-center gap-3">
            <div className="bg-yellow-500/20 p-3 rounded-full">
              <Loader2 className="w-6 h-6 text-yellow-500 animate-spin" />
            </div>
            <div className="flex-1">
              <p className="text-yellow-500 font-semibold text-sm sm:text-base">
                Pending Mint: {balanceData.pendingMintBalance} RCN
              </p>
              <p className="text-gray-400 text-xs sm:text-sm">
                These tokens are queued for minting to your blockchain wallet. They will appear in your wallet once the transaction is processed.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mint to Wallet Section */}
      {balanceData && balanceData.availableBalance > 0 && (
        <div className="bg-[#212121] rounded-xl sm:rounded-2xl lg:rounded-3xl mb-6 sm:mb-8">
          <div
            className="w-full px-4 sm:px-6 lg:px-8 py-3 sm:py-4 text-white rounded-t-xl sm:rounded-t-2xl lg:rounded-t-3xl flex justify-between items-center overflow-visible relative"
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
            <Tooltip
              title="How it works"
              position="bottom"
              className="right-0"
              content={
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-blue-400">1</span>
                    </div>
                    <span className="text-gray-300">
                      Choose the amount of RCN you want to convert to blockchain
                      tokens
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-blue-400">2</span>
                    </div>
                    <span className="text-gray-300">
                      Your offchain RCN balance will be converted to actual
                      blockchain tokens
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-blue-400">3</span>
                    </div>
                    <span className="text-gray-300">
                      Tokens are minted and transferred to your connected wallet
                    </span>
                  </li>
                </ul>
              }
            />
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
                onClick={() => {
                  if (isSuspended) {
                    setShowSuspendedModal(true);
                  } else {
                    setShowMintModal(true);
                  }
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm sm:text-base ${
                  isSuspended
                    ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
                    : 'bg-[#FFCC00] text-black hover:bg-yellow-500'
                }`}
                disabled={isSuspended}
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
              <h3 className="text-xl font-semibold text-white">
                {mintResult?.success ? "Mint Successful!" : "Mint RCN to Wallet"}
              </h3>
              <button
                onClick={handleCloseMintModal}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              {/* Success State */}
              {mintResult?.success ? (
                <div className="space-y-4">
                  {/* Success Icon */}
                  <div className="flex justify-center">
                    <div className="bg-green-500/20 p-4 rounded-full">
                      <CheckCircle className="w-12 h-12 text-green-500" />
                    </div>
                  </div>

                  {/* Success Message */}
                  <div className="text-center">
                    <p className="text-white text-lg font-medium mb-2">
                      {mintResult.amount} RCN Minted!
                    </p>
                    <p className="text-gray-400 text-sm">
                      Your tokens have been successfully minted to your wallet.
                    </p>
                  </div>

                  {/* Transaction Hash */}
                  {mintResult.transactionHash && (
                    <div className="bg-[#2F2F2F] p-4 rounded-lg">
                      <p className="text-gray-400 text-xs mb-2">Transaction Hash:</p>
                      <div className="flex items-center gap-2">
                        <code className="text-[#FFCC00] text-xs break-all flex-1">
                          {mintResult.transactionHash}
                        </code>
                        <a
                          href={getExplorerUrl(mintResult.transactionHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#FFCC00] hover:text-yellow-400 transition-colors flex-shrink-0"
                          title="View on Block Explorer"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  )}

                  {/* View on Explorer Button */}
                  {mintResult.transactionHash && (
                    <a
                      href={getExplorerUrl(mintResult.transactionHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full px-4 py-2 bg-[#2F2F2F] text-[#FFCC00] rounded-lg hover:bg-[#3F3F3F] transition-colors font-medium flex items-center justify-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      View on Block Explorer
                    </a>
                  )}

                  {/* Close Button */}
                  <button
                    onClick={handleCloseMintModal}
                    className="w-full px-4 py-2 bg-[#FFCC00] text-black rounded-lg hover:bg-yellow-500 transition-colors font-medium"
                  >
                    Done
                  </button>
                </div>
              ) : (
                /* Mint Form State */
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
                        max={Math.min(balanceData?.availableBalance || 0, 10000)}
                        step="0.01"
                        disabled={isMinting}
                        className="w-full px-3 py-2 bg-[#2F2F2F] border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] pr-16 disabled:opacity-50"
                      />
                      <button
                        onClick={handleMaxMint}
                        disabled={isMinting}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 px-2 py-1 bg-[#FFCC00] text-black text-xs rounded font-medium hover:bg-yellow-500 transition-colors disabled:opacity-50"
                      >
                        MAX
                      </button>
                    </div>
                    <p className="text-gray-500 text-xs mt-1">
                      Max per transaction: 10,000 RCN
                    </p>
                  </div>

                  {/* Info Box */}
                  <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-3 flex items-start gap-3">
                    <Coins className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-200">
                      <p className="font-medium mb-1">Instant Minting</p>
                      <p>
                        Your tokens will be minted directly to your wallet. Gas fees
                        are covered by the platform.
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={handleCloseMintModal}
                      disabled={isMinting}
                      className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleMintToWallet}
                      disabled={
                        isMinting || !mintAmount || parseFloat(mintAmount) <= 0
                      }
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
              )}
            </div>
          </div>
        </div>
      )}

      {/* Suspended Action Modal */}
      <SuspendedActionModal
        isOpen={showSuspendedModal}
        onClose={() => setShowSuspendedModal(false)}
        action="mint tokens to your wallet"
        reason={userProfile?.suspensionReason}
      />
    </>
  );
};
