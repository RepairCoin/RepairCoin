"use client";

import React, { useEffect, useState } from "react";
import { useReadContract, useActiveAccount } from "thirdweb/react";
import { getContract, createThirdwebClient } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";
import { Coins, X, Loader2, CheckCircle, ExternalLink } from "lucide-react";
import { useCustomer } from "@/hooks/useCustomer";
import { useCustomerStore } from "@/stores/customerStore";
import { useAuthStore } from "@/stores/authStore";
import { toast } from "react-hot-toast";
import apiClient from "@/services/api/client";
import { SuspendedActionModal } from "./SuspendedActionModal";
import {
  TrendingServicesList,
  YourTierLevelCard,
  MintRCNCard,
  WalletSummaryCard,
  AskAICustomerCard,
  ActiveServicesCard,
  RecommendedShopsCard,
  TrustedProfessionalsCard,
  PopularServicesCard,
} from "./overview";
import { ShopServiceWithShopInfo, ServiceOrderWithDetails } from "@/services/api/services";
import { ShopMapData } from "@/services/api/shop";
import { useRouter } from "next/navigation";
import { useBlockchainEnabled } from "@/contexts/AppConfigContext";

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

export const OverviewTab: React.FC = () => {
  const router = useRouter();
  const account = useActiveAccount();
  const { userProfile, switchingAccount } = useAuthStore();
  const {
    customerData,
    balanceData,
    blockchainBalance,
    isLoading,
    error,
    fetchCustomerData,
  } = useCustomer();

  // Mint to Wallet state
  const [showMintModal, setShowMintModal] = useState(false);
  // Blockchain-only feature: hide "Mint to Wallet" in database-only mode
  const blockchainEnabled = useBlockchainEnabled();
  const [mintAmount, setMintAmount] = useState("");
  const [isMinting, setIsMinting] = useState(false);
  const [showSuspendedModal, setShowSuspendedModal] = useState(false);
  const [mintResult, setMintResult] = useState<{
    success: boolean;
    transactionHash?: string;
    amount?: number;
  } | null>(null);

  const isSuspended = userProfile?.suspended || false;

  // Read token balance from contract
  const { data: tokenBalance, refetch: refetchTokenBalance } = useReadContract({
    contract,
    method: "function balanceOf(address) view returns (uint256)",
    params: customerData?.address ? [customerData.address] : [""],
  });

  const walletAddress = account?.address || userProfile?.address;

  // Fetch data when wallet address becomes available
  useEffect(() => {
    if (switchingAccount) return;
    if (walletAddress) {
      const currentDataAddress = customerData?.address?.toLowerCase();
      const connectedAddress = walletAddress.toLowerCase();
      if (!customerData || currentDataAddress !== connectedAddress) {
        fetchCustomerData(true);
      }
    }
  }, [walletAddress, customerData, fetchCustomerData, account?.address, switchingAccount]);

  // Update blockchain balance from contract
  useEffect(() => {
    if (tokenBalance !== undefined) {
      const formattedBalance = Number(tokenBalance) / 1e18;
      useCustomerStore.getState().setBlockchainBalance(formattedBalance);
    }
  }, [tokenBalance]);

  const handleMintToWallet = async () => {
    if (!walletAddress) {
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
        `/customers/balance/${walletAddress}/instant-mint`,
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
        setTimeout(() => refetchTokenBalance(), 3000);
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

  const getExplorerUrl = (txHash: string) => `https://sepolia.basescan.org/tx/${txHash}`;
  const handleMaxMint = () => setMintAmount(balanceData?.availableBalance?.toString() || "0");
  const handleMintButtonClick = () => {
    if (isSuspended) setShowSuspendedModal(true);
    else setShowMintModal(true);
  };

  // Navigation handlers
  const handleViewService = (service: ShopServiceWithShopInfo) =>
    router.push(`/customer?tab=marketplace&service=${service.serviceId}`);
  const handleViewOrder = (_order: ServiceOrderWithDetails) =>
    router.push(`/customer?tab=bookings`);
  const handleViewShop = (shop: ShopMapData) =>
    router.push(`/customer?tab=marketplace&shop=${shop.shopId}`);
  const handleSelectCategory = (category: string) =>
    router.push(`/customer?tab=marketplace&category=${category}`);
  const handleSeeMoreCategories = () => router.push(`/customer?tab=marketplace`);

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
      <div className="max-w-[1080px] mx-auto space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        {/* ============================= LEFT COLUMN ============================= */}
        <div className="rounded-2xl border border-[#262626] bg-[#161616] p-5">
          <div className="space-y-5">
            <AskAICustomerCard />

            <ActiveServicesCard onViewOrder={handleViewOrder} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <TrendingServicesList onViewService={handleViewService} />
              <RecommendedShopsCard onViewShop={handleViewShop} />
            </div>
          </div>
        </div>

        {/* ============================= RIGHT COLUMN ============================= */}
        <div className="space-y-5">
          <WalletSummaryCard
            availableBalance={balanceData?.availableBalance || 0}
            walletBalance={blockchainBalance || 0}
            tokensEarned={balanceData?.lifetimeEarned || 0}
            tokensRedeemed={balanceData?.totalRedeemed || 0}
          />

          <YourTierLevelCard
            tier={customerData?.tier || "BRONZE"}
            lifetimeEarned={balanceData?.lifetimeEarned || 0}
          />

          {/* Mint RCN to Wallet (blockchain-only; hidden in database-only mode) */}
          {blockchainEnabled && balanceData && balanceData.availableBalance > 0 && (
            <MintRCNCard
              availableBalance={balanceData.availableBalance}
              onMintClick={handleMintButtonClick}
              disabled={isSuspended}
            />
          )}
        </div>
      </div>

        <TrustedProfessionalsCard
          onSelectCategory={handleSelectCategory}
          onSeeMore={handleSeeMoreCategories}
        />

        <PopularServicesCard
          onViewService={handleViewService}
          onSeeMore={handleSeeMoreCategories}
        />
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
