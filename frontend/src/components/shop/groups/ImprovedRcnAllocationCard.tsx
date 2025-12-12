"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { Coins, RefreshCw, ArrowUpCircle, ArrowDownCircle, TrendingUp, Users, PieChart } from "lucide-react";
import * as shopGroupsAPI from "../../../services/api/affiliateShopGroups";

interface ImprovedRcnAllocationCardProps {
  groupId: string;
  shopRcnBalance: number;
  currentShopId?: string;
  onAllocationChange?: () => void;
}

export default function ImprovedRcnAllocationCard({
  groupId,
  shopRcnBalance,
  currentShopId,
  onAllocationChange,
}: ImprovedRcnAllocationCardProps) {
  const [allocation, setAllocation] = useState<shopGroupsAPI.ShopGroupRcnAllocation | null>(null);
  const [members, setMembers] = useState<shopGroupsAPI.AffiliateShopGroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [groupId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allocationData, membersData] = await Promise.all([
        shopGroupsAPI.getGroupRcnAllocation(groupId),
        shopGroupsAPI.getGroupMembers(groupId, "active"),
      ]);
      setAllocation(allocationData);
      setMembers(Array.isArray(membersData) ? membersData : []);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load RCN allocation data");
    } finally {
      setLoading(false);
    }
  };

  const handleAllocate = async () => {
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (amountNum > shopRcnBalance) {
      toast.error(`Insufficient balance. You have ${shopRcnBalance.toFixed(2)} RCN available`);
      return;
    }

    try {
      setSubmitting(true);
      await shopGroupsAPI.allocateRcnToGroup(groupId, amountNum);
      toast.success(`Successfully allocated ${amountNum} RCN to this group!`);
      setShowAllocateModal(false);
      setAmount("");
      await loadData();
      onAllocationChange?.();
    } catch (error: any) {
      console.error("Error allocating RCN:", error);
      toast.error(error?.response?.data?.error || "Failed to allocate RCN");
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (allocation && amountNum > allocation.availableRcn) {
      toast.error(`Only ${allocation.availableRcn.toFixed(2)} RCN is available for withdrawal`);
      return;
    }

    try {
      setSubmitting(true);
      await shopGroupsAPI.deallocateRcnFromGroup(groupId, amountNum);
      toast.success(`Successfully withdrew ${amountNum} RCN to your shop balance!`);
      setShowWithdrawModal(false);
      setAmount("");
      await loadData();
      onAllocationChange?.();
    } catch (error: any) {
      console.error("Error withdrawing RCN:", error);
      toast.error(error?.response?.data?.error || "Failed to withdraw RCN");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#101010] rounded-xl p-6">
        <div className="animate-pulse">
          <div className="h-5 bg-[#1e1f22] rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="h-32 bg-[#1e1f22] rounded-lg"></div>
            <div className="h-32 bg-[#1e1f22] rounded-lg"></div>
          </div>
          <div className="h-20 bg-[#1e1f22] rounded-lg"></div>
        </div>
      </div>
    );
  }

  // Calculate totals from all active members
  const totalGroupAllocated = members.reduce((sum, m) => sum + (m.allocatedRcn || 0), 0);
  const totalGroupUsed = members.reduce((sum, m) => sum + (m.usedRcn || 0), 0);
  const totalGroupAvailable = members.reduce((sum, m) => sum + (m.availableRcn || 0), 0);

  // Your individual stats
  const yourAllocated = allocation?.allocatedRcn || 0;
  const yourUsed = allocation?.usedRcn || 0;
  const yourAvailable = allocation?.availableRcn || 0;

  // Contribution percentage
  const yourContributionPercent = totalGroupAllocated > 0
    ? ((yourAllocated / totalGroupAllocated) * 100).toFixed(1)
    : "0.0";

  return (
    <>
      <div className="bg-[#101010] rounded-xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-[#FFCC00]" />
            <div>
              <h3 className="text-[#FFCC00] font-semibold">RCN Allocations</h3>
              <p className="text-sm text-gray-400">Manage your group token backing</p>
            </div>
          </div>
          <button
            onClick={loadData}
            className="p-2 rounded-lg bg-[#1e1f22] hover:bg-[#2a2b2f] transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* YOUR ALLOCATION */}
          <div className="bg-[#1e1f22] border border-[#FFCC00]/20 rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-white font-medium flex items-center gap-2">
                <div className="w-2 h-2 bg-[#FFCC00] rounded-full"></div>
                Your Allocation
              </h4>
              <span className="text-xs font-medium px-2 py-1 bg-[#FFCC00]/10 text-[#FFCC00] rounded">
                {yourContributionPercent}% of total
              </span>
            </div>

            <div className="space-y-3 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Allocated:</span>
                <span className="text-lg font-semibold text-[#FFCC00]">{yourAllocated.toLocaleString()} RCN</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Used (Backing):</span>
                <span className="text-base font-medium text-blue-400">{yourUsed.toLocaleString()} RCN</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-gray-700">
                <span className="text-sm font-medium text-gray-300">Available:</span>
                <span className="text-lg font-semibold text-green-400">{yourAvailable.toLocaleString()} RCN</span>
              </div>
            </div>

            <p className="text-xs text-gray-500 italic">
              Available RCN can be used to issue tokens or withdrawn back to your shop.
            </p>
          </div>

          {/* TOTAL GROUP POOL */}
          <div className="bg-[#1e1f22] rounded-lg p-5">
            <h4 className="text-white font-medium flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-gray-400" />
              Total Group Pool
            </h4>

            <div className="space-y-3 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Total Allocated:</span>
                <span className="text-lg font-semibold text-white">{totalGroupAllocated.toLocaleString()} RCN</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Total Used:</span>
                <span className="text-base font-medium text-blue-400">{totalGroupUsed.toLocaleString()} RCN</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-gray-700">
                <span className="text-sm font-medium text-gray-300">Total Available:</span>
                <span className="text-lg font-semibold text-green-400">{totalGroupAvailable.toLocaleString()} RCN</span>
              </div>
            </div>

            <p className="text-xs text-gray-500 italic">
              Combined resources from all {members.length} active member{members.length !== 1 ? 's' : ''}.
            </p>
          </div>
        </div>

        {/* Shop Main Balance */}
        <div className="bg-[#1e1f22] border border-blue-500/20 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400 mb-1">Your Shop's Main RCN Balance</p>
              <p className="text-xl font-bold text-[#FFCC00]">{shopRcnBalance.toLocaleString()} RCN</p>
            </div>
            <PieChart className="w-6 h-6 text-gray-600" />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Allocate RCN from your main balance to this group to issue tokens
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => setShowAllocateModal(true)}
            className="flex-1 bg-[#FFCC00] hover:bg-[#FFD700] text-[#101010] font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <ArrowUpCircle className="w-4 h-4" />
            Allocate to Group
          </button>

          {yourAvailable > 0 && (
            <button
              onClick={() => setShowWithdrawModal(true)}
              className="flex-1 bg-[#1e1f22] hover:bg-[#2a2b2f] text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 border border-gray-700"
            >
              <ArrowDownCircle className="w-4 h-4" />
              Withdraw ({yourAvailable.toLocaleString()} RCN)
            </button>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-[#1e1f22] rounded-lg p-4">
          <h5 className="text-sm font-medium text-white mb-2 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#FFCC00]" />
            How It Works
          </h5>
          <ul className="space-y-1.5 text-xs text-gray-400">
            <li>• Each shop allocates RCN independently - your allocation is yours alone</li>
            <li>• You can only issue tokens using YOUR allocated RCN (1:2 ratio: 100 tokens = 50 RCN)</li>
            <li>• Used RCN backs active tokens and cannot be withdrawn until tokens are redeemed</li>
            <li>• Unused RCN can be withdrawn back to your shop at any time</li>
          </ul>
        </div>
      </div>

      {/* Allocate Modal */}
      {showAllocateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#101010] rounded-xl border border-gray-800 p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold text-white mb-6">Allocate RCN to Group</h3>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Amount to Allocate
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3 bg-[#1e1f22] border border-gray-700 rounded-lg text-white text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
                  min="0"
                  step="0.01"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">RCN</span>
              </div>
              <p className="text-sm text-gray-400 mt-2 flex items-center justify-between">
                <span>Available in shop:</span>
                <span className="text-white font-semibold">{shopRcnBalance.toLocaleString()} RCN</span>
              </p>
            </div>

            <div className="bg-[#1e1f22] border border-[#FFCC00]/20 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-300">
                This moves RCN from your shop's main balance to this group, allowing you to issue group tokens.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAllocateModal(false);
                  setAmount("");
                }}
                className="flex-1 bg-[#1e1f22] hover:bg-[#2a2b2f] text-white font-medium py-3 px-4 rounded-lg transition-colors border border-gray-700"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={handleAllocate}
                disabled={submitting || !amount}
                className="flex-1 bg-[#FFCC00] hover:bg-[#FFD700] text-[#101010] font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Allocating..." : "Allocate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#101010] rounded-xl border border-gray-800 p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold text-white mb-6">Withdraw RCN to Shop</h3>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Amount to Withdraw
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3 bg-[#1e1f22] border border-gray-700 rounded-lg text-white text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
                  min="0"
                  step="0.01"
                  max={yourAvailable}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">RCN</span>
              </div>
              <p className="text-sm text-gray-400 mt-2 flex items-center justify-between">
                <span>Available to withdraw:</span>
                <span className="text-green-400 font-semibold">{yourAvailable.toLocaleString()} RCN</span>
              </p>
            </div>

            <div className="bg-[#1e1f22] border border-blue-500/20 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-300">
                Only unused RCN can be withdrawn. RCN backing active tokens ({yourUsed.toLocaleString()} RCN) must stay in the pool.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowWithdrawModal(false);
                  setAmount("");
                }}
                className="flex-1 bg-[#1e1f22] hover:bg-[#2a2b2f] text-white font-medium py-3 px-4 rounded-lg transition-colors border border-gray-700"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={handleWithdraw}
                disabled={submitting || !amount}
                className="flex-1 bg-[#FFCC00] hover:bg-[#FFD700] text-[#101010] font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Withdrawing..." : "Withdraw"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
