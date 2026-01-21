// frontend/src/components/customer/StakingTab.tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  Lock,
  Unlock,
  Clock,
  DollarSign,
  Award,
  Info,
  Loader2,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { useActiveAccount, useReadContract } from "thirdweb/react";
import { prepareContractCall, sendTransaction, getContract } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";
import { rcgClient } from "@/utils/thirdweb";
import { RCG_CONTRACT_ADDRESS, TOKEN_CONFIG } from "@/config/contracts";
import { toast } from "react-hot-toast";

const rcgContract = getContract({
  client: rcgClient,
  address: RCG_CONTRACT_ADDRESS,
  chain: baseSepolia,
});

export const StakingTab: React.FC = () => {
  const account = useActiveAccount();
  const [stakeAmount, setStakeAmount] = useState("");
  const [unstakeAmount, setUnstakeAmount] = useState("");
  const [isStaking, setIsStaking] = useState(false);
  const [isUnstaking, setIsUnstaking] = useState(false);
  const [activeAction, setActiveAction] = useState<"stake" | "unstake">("stake");

  // Read RCG balance
  const { data: balance, isLoading: balanceLoading, refetch: refetchBalance } = useReadContract({
    contract: rcgContract,
    method: "function balanceOf(address) view returns (uint256)",
    params: account?.address ? [account.address] : undefined,
  });

  // Mock staking data (in production, this would come from a staking contract)
  const [stakingData, setStakingData] = useState({
    stakedAmount: 0,
    stakingRewards: 0,
    apr: 12.5, // 12.5% APR (10% revenue share divided among stakers)
    lockEndDate: null as Date | null,
    isLocked: false,
  });

  const rcgBalance = balance ? Number(balance) / 10**18 : 0;
  const minStake = TOKEN_CONFIG.RCG.minStake;
  const lockPeriodDays = TOKEN_CONFIG.RCG.lockPeriod;

  const handleStake = async () => {
    if (!account) {
      toast.error("Please connect your wallet");
      return;
    }

    const amount = parseFloat(stakeAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (amount < minStake) {
      toast.error(`Minimum stake is ${minStake.toLocaleString()} RCG`);
      return;
    }

    if (amount > rcgBalance) {
      toast.error("Insufficient RCG balance");
      return;
    }

    try {
      setIsStaking(true);

      // In production, this would call the actual staking contract
      // For now, we'll show a success message
      toast.success(`Successfully staked ${amount.toLocaleString()} RCG!`);

      // Update local state (in production, this would be read from the blockchain)
      setStakingData(prev => ({
        ...prev,
        stakedAmount: prev.stakedAmount + amount,
        lockEndDate: new Date(Date.now() + lockPeriodDays * 24 * 60 * 60 * 1000),
        isLocked: true,
      }));

      setStakeAmount("");
      refetchBalance();
    } catch (error) {
      console.error("Staking error:", error);
      toast.error("Failed to stake RCG");
    } finally {
      setIsStaking(false);
    }
  };

  const handleUnstake = async () => {
    if (!account) {
      toast.error("Please connect your wallet");
      return;
    }

    const amount = parseFloat(unstakeAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (amount > stakingData.stakedAmount) {
      toast.error("Insufficient staked balance");
      return;
    }

    if (stakingData.isLocked) {
      toast.error(`Tokens are locked until ${stakingData.lockEndDate?.toLocaleDateString()}`);
      return;
    }

    try {
      setIsUnstaking(true);

      // In production, this would call the actual staking contract
      toast.success(`Successfully unstaked ${amount.toLocaleString()} RCG!`);

      setStakingData(prev => ({
        ...prev,
        stakedAmount: prev.stakedAmount - amount,
      }));

      setUnstakeAmount("");
      refetchBalance();
    } catch (error) {
      console.error("Unstaking error:", error);
      toast.error("Failed to unstake RCG");
    } finally {
      setIsUnstaking(false);
    }
  };

  const handleClaimRewards = async () => {
    if (!account) {
      toast.error("Please connect your wallet");
      return;
    }

    if (stakingData.stakingRewards === 0) {
      toast.error("No rewards to claim");
      return;
    }

    try {
      toast.success(`Successfully claimed ${stakingData.stakingRewards.toFixed(2)} RCG rewards!`);
      setStakingData(prev => ({ ...prev, stakingRewards: 0 }));
      refetchBalance();
    } catch (error) {
      console.error("Claim rewards error:", error);
      toast.error("Failed to claim rewards");
    }
  };

  // Calculate estimated annual rewards
  const estimatedAnnualRewards = stakingData.stakedAmount * (stakingData.apr / 100);
  const estimatedMonthlyRewards = estimatedAnnualRewards / 12;
  const estimatedDailyRewards = estimatedAnnualRewards / 365;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">RCG Staking</h1>
        <p className="text-gray-400">
          Stake your RCG tokens to earn rewards from platform revenue sharing
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-r from-[#FFCC00] to-[#FFD700] rounded-full flex items-center justify-center">
              <Lock className="w-5 h-5 text-black" />
            </div>
            <span className="text-gray-400 text-sm">Staked Balance</span>
          </div>
          <p className="text-3xl font-bold text-white">
            {stakingData.stakedAmount.toLocaleString()} <span className="text-lg text-gray-400">RCG</span>
          </p>
        </div>

        <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-green-600 rounded-full flex items-center justify-center">
              <Award className="w-5 h-5 text-white" />
            </div>
            <span className="text-gray-400 text-sm">Pending Rewards</span>
          </div>
          <p className="text-3xl font-bold text-white">
            {stakingData.stakingRewards.toFixed(2)} <span className="text-lg text-gray-400">RCG</span>
          </p>
        </div>

        <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <span className="text-gray-400 text-sm">Current APR</span>
          </div>
          <p className="text-3xl font-bold text-white">
            {stakingData.apr.toFixed(1)}%
          </p>
        </div>

        <div className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <span className="text-gray-400 text-sm">Available Balance</span>
          </div>
          <p className="text-3xl font-bold text-white">
            {balanceLoading ? "..." : rcgBalance.toLocaleString()} <span className="text-lg text-gray-400">RCG</span>
          </p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-gradient-to-r from-[#FFCC00]/10 to-[#FFD700]/5 border border-[#FFCC00]/30 rounded-xl p-6 mb-8">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-[#FFCC00]/20 rounded-full flex items-center justify-center flex-shrink-0">
            <Info className="w-6 h-6 text-[#FFCC00]" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white mb-2">How RCG Staking Works</h3>
            <ul className="space-y-2 text-gray-300">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span>Stake a minimum of {minStake.toLocaleString()} RCG tokens to start earning rewards</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span>Earn 10% of platform revenue shared among all stakers</span>
              </li>
              <li className="flex items-start gap-2">
                <Clock className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <span>Tokens are locked for {lockPeriodDays} days after staking</span>
              </li>
              <li className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <span>Rewards are distributed daily based on your stake percentage</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Staking Form */}
        <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-6">
          {/* Action Tabs */}
          <div className="flex gap-4 mb-6 border-b border-gray-800">
            <button
              onClick={() => setActiveAction("stake")}
              className={`pb-4 px-2 font-semibold transition-colors relative ${
                activeAction === "stake" ? "text-[#FFCC00]" : "text-gray-400 hover:text-gray-300"
              }`}
            >
              Stake
              {activeAction === "stake" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FFCC00]" />
              )}
            </button>
            <button
              onClick={() => setActiveAction("unstake")}
              className={`pb-4 px-2 font-semibold transition-colors relative ${
                activeAction === "unstake" ? "text-[#FFCC00]" : "text-gray-400 hover:text-gray-300"
              }`}
            >
              Unstake
              {activeAction === "unstake" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FFCC00]" />
              )}
            </button>
          </div>

          {activeAction === "stake" ? (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Amount to Stake
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    placeholder={`Min: ${minStake.toLocaleString()} RCG`}
                    className="w-full px-4 py-3 bg-[#0A0A0A] border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] transition-colors pr-20"
                  />
                  <button
                    onClick={() => setStakeAmount(rcgBalance.toString())}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#FFCC00] hover:text-[#FFD700] text-sm font-semibold"
                  >
                    MAX
                  </button>
                </div>
                <p className="mt-2 text-sm text-gray-400">
                  Available: {rcgBalance.toLocaleString()} RCG
                </p>
              </div>

              <button
                onClick={handleStake}
                disabled={isStaking || !stakeAmount || parseFloat(stakeAmount) < minStake}
                className="w-full py-4 bg-gradient-to-r from-[#FFCC00] to-[#FFD700] text-black font-bold rounded-xl hover:from-[#FFD700] hover:to-[#FFCC00] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isStaking ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Staking...
                  </>
                ) : (
                  <>
                    <Lock className="w-5 h-5" />
                    Stake RCG
                  </>
                )}
              </button>

              <div className="bg-[#0A0A0A] border border-gray-800 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-2">Lock Period:</p>
                <p className="text-white font-semibold">{lockPeriodDays} days</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Amount to Unstake
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={unstakeAmount}
                    onChange={(e) => setUnstakeAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-3 bg-[#0A0A0A] border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] transition-colors pr-20"
                  />
                  <button
                    onClick={() => setUnstakeAmount(stakingData.stakedAmount.toString())}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#FFCC00] hover:text-[#FFD700] text-sm font-semibold"
                  >
                    MAX
                  </button>
                </div>
                <p className="mt-2 text-sm text-gray-400">
                  Staked: {stakingData.stakedAmount.toLocaleString()} RCG
                </p>
              </div>

              {stakingData.isLocked && stakingData.lockEndDate && (
                <div className="bg-yellow-900 bg-opacity-20 border border-yellow-700 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-yellow-400 font-semibold mb-1">Tokens Locked</p>
                      <p className="text-sm text-yellow-300">
                        Available for withdrawal on {stakingData.lockEndDate.toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleUnstake}
                disabled={isUnstaking || !unstakeAmount || stakingData.isLocked}
                className="w-full py-4 bg-gradient-to-r from-gray-700 to-gray-800 text-white font-bold rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isUnstaking ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Unstaking...
                  </>
                ) : (
                  <>
                    <Unlock className="w-5 h-5" />
                    Unstake RCG
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Rewards Section */}
        <div className="space-y-6">
          <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-6">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Award className="w-6 h-6 text-[#FFCC00]" />
              Your Rewards
            </h3>

            <div className="space-y-4">
              <div className="bg-[#0A0A0A] border border-gray-800 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-1">Pending Rewards</p>
                <p className="text-2xl font-bold text-white">
                  {stakingData.stakingRewards.toFixed(4)} RCG
                </p>
              </div>

              <button
                onClick={handleClaimRewards}
                disabled={stakingData.stakingRewards === 0}
                className="w-full py-3 bg-gradient-to-r from-green-600 to-green-700 text-white font-bold rounded-xl hover:from-green-500 hover:to-green-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Claim Rewards
              </button>
            </div>
          </div>

          {stakingData.stakedAmount > 0 && (
            <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-6">
              <h3 className="text-xl font-bold text-white mb-4">Estimated Earnings</h3>

              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-gray-800">
                  <span className="text-gray-400">Daily</span>
                  <span className="text-white font-semibold">
                    {estimatedDailyRewards.toFixed(4)} RCG
                  </span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-gray-800">
                  <span className="text-gray-400">Monthly</span>
                  <span className="text-white font-semibold">
                    {estimatedMonthlyRewards.toFixed(2)} RCG
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Annually</span>
                  <span className="text-white font-semibold">
                    {estimatedAnnualRewards.toFixed(2)} RCG
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-800">
                <p className="text-xs text-gray-500 text-center">
                  * Estimates based on current APR of {stakingData.apr}%. Actual rewards may vary based on platform revenue.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StakingTab;
