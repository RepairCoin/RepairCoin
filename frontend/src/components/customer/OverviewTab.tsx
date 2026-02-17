"use client";

import React, { useEffect, useState } from "react";
import { useReadContract, useActiveAccount } from "thirdweb/react";
import { getContract, createThirdwebClient } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";
import { Wallet, CircleCheck, TrendingUp, Gift } from "lucide-react";
import { useCustomer } from "@/hooks/useCustomer";
import { useCustomerStore } from "@/stores/customerStore";
import { useAuthStore } from "@/stores/authStore";
import { DataTable, type Column } from "../ui/DataTable";
import { Coins, X, Loader2, CheckCircle, ExternalLink } from "lucide-react";
import { toast } from "react-hot-toast";
import apiClient from "@/services/api/client";
import { SuspendedActionModal } from "./SuspendedActionModal";
import {
  TrendingServicesList,
  YourTierLevelCard,
  MintRCNCard,
  CampaignsPromosCard,
} from "./overview";
import { ShopServiceWithShopInfo } from "@/services/api/services";
import { useRouter } from "next/navigation";

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

// Compact stat card component for the new design
interface CompactStatCardProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  sublabel?: string;
}

const CompactStatCard: React.FC<CompactStatCardProps> = ({
  icon,
  value,
  label,
  sublabel,
}) => (
  <div className="bg-[#212121] rounded-xl p-4 sm:p-5 flex items-center gap-4">
    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#2A2A2A] flex items-center justify-center flex-shrink-0">
      {icon}
    </div>
    <div className="min-w-0">
      <div className="text-xs sm:text-sm text-gray-400">{label}</div>
      <div className="text-xl sm:text-2xl font-bold text-white truncate">{value}</div>
      {sublabel && <div className="text-xs text-gray-500">{sublabel}</div>}
    </div>
  </div>
);

export const OverviewTab: React.FC = () => {
  const router = useRouter();
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

  // Define columns for DataTable - simplified for overview
  const transactionColumns: Column[] = [
    {
      key: "date",
      header: "Date",
      accessor: (transaction: any) => (
        <div>
          <div className="font-medium text-gray-300 text-xs">
            {new Date(transaction.createdAt).toLocaleDateString("en-US", {
              timeZone: "America/Chicago",
              month: "2-digit",
              day: "2-digit",
              year: "numeric",
            })}
          </div>
          <div className="text-xs text-gray-500">
            {new Date(transaction.createdAt).toLocaleTimeString("en-US", {
              timeZone: "America/Chicago",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>
      ),
      className: "text-xs",
    },
    {
      key: "description",
      header: "Description",
      accessor: (transaction: any) => (
        <div className="text-gray-200 text-xs truncate max-w-[120px]">
          {transaction.type === "earned"
            ? "Service"
            : transaction.type === "redeemed"
            ? "Redemption"
            : transaction.description}
        </div>
      ),
      className: "text-xs",
    },
    {
      key: "shop",
      header: "Shop",
      accessor: (transaction: any) => (
        <span className="text-gray-400 text-xs truncate block max-w-[80px]">
          {transaction.shopName || "—"}
        </span>
      ),
      className: "text-xs hidden md:table-cell",
      headerClassName: "hidden md:table-cell",
    },
    {
      key: "type",
      header: "Type",
      accessor: (transaction: any) => (
        <span
          className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full ${
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
        if (
          transaction.type === "rejected_redemption" ||
          transaction.type === "cancelled_redemption"
        ) {
          return (
            <span className="text-xs font-medium text-gray-400">
              {transaction.metadata?.originalRequestAmount || 0} RCN
            </span>
          );
        }
        return (
          <span
            className={`text-xs font-bold ${
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

  // Get address from Thirdweb account OR from session cache (userProfile)
  // This allows fetching immediately on page refresh without waiting for Thirdweb
  const walletAddress = account?.address || userProfile?.address;

  // Fetch data when wallet address becomes available (from either source)
  // This is critical for page refresh where Thirdweb takes time to restore wallet
  useEffect(() => {
    if (walletAddress) {
      // Check if we need to fetch - either no data or data is for different address
      const currentDataAddress = customerData?.address?.toLowerCase();
      const connectedAddress = walletAddress.toLowerCase();

      if (!customerData || currentDataAddress !== connectedAddress) {
        console.log('[OverviewTab] Wallet address available, fetching customer data for:', connectedAddress, '(source:', account?.address ? 'Thirdweb' : 'session cache', ')');
        fetchCustomerData(true); // Force fetch to ensure fresh data
      }
    }
  }, [walletAddress, customerData, fetchCustomerData, account?.address]);

  // Update blockchain balance from contract
  useEffect(() => {
    if (tokenBalance !== undefined) {
      const formattedBalance = Number(tokenBalance) / 1e18;
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

    if (amount > 10000) {
      toast.error("Maximum mint amount is 10,000 RCN per transaction");
      return;
    }

    setIsMinting(true);
    setMintResult(null);

    try {
      const result = (await apiClient.post(
        `/customers/balance/${account.address}/instant-mint`,
        { amount }
      )) as {
        success: boolean;
        data?: { transactionHash?: string; amount?: number };
        error?: string;
      };

      if (result.success) {
        setMintResult({
          success: true,
          transactionHash: result.data?.transactionHash,
          amount: result.data?.amount || amount,
        });
        toast.success(`Successfully minted ${amount} RCN to your wallet!`);
        setMintAmount("");
        fetchCustomerData(true);
      } else {
        toast.error(result.error || "Failed to mint tokens");
        setMintResult(null);
      }
    } catch (error) {
      console.error("Mint error:", error);
      const axiosError = error as {
        response?: { data?: { error?: string } };
        message?: string;
      };
      const errorMessage =
        axiosError?.response?.data?.error ||
        axiosError?.message ||
        "Failed to process mint request";
      toast.error(errorMessage);
      setMintResult(null);
    } finally {
      setIsMinting(false);
    }
  };

  const handleCloseMintModal = () => {
    setShowMintModal(false);
    setMintAmount("");
    setMintResult(null);
  };

  const getExplorerUrl = (txHash: string) => {
    return `https://sepolia.basescan.org/tx/${txHash}`;
  };

  const handleMaxMint = () => {
    setMintAmount(balanceData?.availableBalance?.toString() || "0");
  };

  const handleMintButtonClick = () => {
    if (isSuspended) {
      setShowSuspendedModal(true);
    } else {
      setShowMintModal(true);
    }
  };

  // Handle service view - navigate to marketplace with service selected
  const handleViewService = (service: ShopServiceWithShopInfo) => {
    router.push(`/customer?tab=marketplace&service=${service.serviceId}`);
  };

  // Loading state
  if (isLoading && !customerData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-yellow-400 border-t-transparent"></div>
      </div>
    );
  }

  // Error state
  if (error && !customerData) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-xl p-6 text-center">
        <p className="text-red-400">{error}</p>
        <button
          onClick={() => fetchCustomerData(true)}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Header Section */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">
          Hello There!{" "}
          <span className="text-[#FFCC00]">{customerData?.name || "Guest"}</span>
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Welcome back! Here&apos;s a quick look at your RepairCoin activity and
          rewards.
        </p>
      </div>

      {/* Stats Grid - 4 compact cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <CompactStatCard
          icon={<Wallet className="w-5 h-5 text-[#FFCC00]" />}
          value={`${balanceData?.availableBalance || 0} RCN`}
          label="Available Balance"
          sublabel="Off-chain balance"
        />
        <CompactStatCard
          icon={<CircleCheck className="w-5 h-5 text-green-400" />}
          value={`${blockchainBalance || 0} RCN`}
          label="Wallet Balance"
          sublabel="On-chain balance"
        />
        <CompactStatCard
          icon={<TrendingUp className="w-5 h-5 text-[#FFCC00]" />}
          value={balanceData?.lifetimeEarned || 0}
          label="Tokens Earned"
        />
        <CompactStatCard
          icon={<Gift className="w-5 h-5 text-[#FFCC00]" />}
          value={balanceData?.totalRedeemed || 0}
          label="Tokens Redeemed"
        />
      </div>

      {/* Two-column layout - 3:2 ratio for wider right column */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column - Trending Services & Transaction History */}
        <div className="lg:col-span-3 space-y-6">
          {/* Trending Services */}
          <TrendingServicesList onViewService={handleViewService} />

          {/* Transaction History */}
          <div className="bg-[#212121] rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-800">
              <Coins className="w-5 h-5 text-[#FFCC00]" />
              <h3 className="text-white font-semibold text-base">Transaction History</h3>
            </div>
            <div className="p-4">
              <DataTable
                data={displayTransactions.slice(0, 5)}
                columns={transactionColumns}
                keyExtractor={(transaction) => transaction.id}
                emptyMessage="No transactions yet"
                emptyIcon={
                  <div className="text-center py-6">
                    <div className="text-4xl mb-3">📋</div>
                    <p className="text-gray-400 text-sm">No transactions yet</p>
                    <p className="text-gray-500 text-xs mt-1">
                      Start earning RCN by booking services!
                    </p>
                  </div>
                }
                className="w-full"
                headerClassName="bg-gray-800/50 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Right Column - Tier, Mint, Campaigns */}
        <div className="lg:col-span-2 space-y-4">
          {/* Your Tier Level */}
          <YourTierLevelCard
            tier={customerData?.tier || "BRONZE"}
            lifetimeEarned={balanceData?.lifetimeEarned || 0}
          />

          {/* Mint RCN to Wallet */}
          {balanceData && balanceData.availableBalance > 0 && (
            <MintRCNCard
              availableBalance={balanceData.availableBalance}
              onMintClick={handleMintButtonClick}
              disabled={isSuspended}
            />
          )}

          {/* Campaigns & Promos */}
          <CampaignsPromosCard />
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
              {mintResult?.success ? (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <div className="bg-green-500/20 p-4 rounded-full">
                      <CheckCircle className="w-12 h-12 text-green-500" />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-white text-lg font-medium mb-2">
                      {mintResult.amount} RCN Minted!
                    </p>
                    <p className="text-gray-400 text-sm">
                      Your tokens have been successfully minted to your wallet.
                    </p>
                  </div>
                  {mintResult.transactionHash && (
                    <div className="bg-[#2F2F2F] p-4 rounded-lg">
                      <p className="text-gray-400 text-xs mb-2">
                        Transaction Hash:
                      </p>
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
                  <button
                    onClick={handleCloseMintModal}
                    className="w-full px-4 py-2 bg-[#FFCC00] text-black rounded-lg hover:bg-yellow-500 transition-colors font-medium"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-[#2F2F2F] p-4 rounded-lg">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">Available Balance:</span>
                      <span className="text-[#FFCC00] font-medium">
                        {balanceData?.availableBalance || 0} RCN
                      </span>
                    </div>
                  </div>
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
                  <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-3 flex items-start gap-3">
                    <Coins className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-200">
                      <p className="font-medium mb-1">Instant Minting</p>
                      <p>
                        Your tokens will be minted directly to your wallet. Gas
                        fees are covered by the platform.
                      </p>
                    </div>
                  </div>
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
