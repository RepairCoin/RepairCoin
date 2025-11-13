"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { Coins, TrendingUp, TrendingDown, RefreshCw, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import * as shopGroupsAPI from "../../../services/api/affiliateShopGroups";

interface RcnAllocationCardProps {
  groupId: string;
  shopRcnBalance: number;
  onAllocationChange?: () => void;
}

export default function RcnAllocationCard({
  groupId,
  shopRcnBalance,
  onAllocationChange,
}: RcnAllocationCardProps) {
  const [allocation, setAllocation] = useState<shopGroupsAPI.ShopGroupRcnAllocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadAllocation();
  }, [groupId]);

  const loadAllocation = async () => {
    try {
      setLoading(true);
      const data = await shopGroupsAPI.getGroupRcnAllocation(groupId);
      setAllocation(data);
    } catch (error) {
      console.error("Error loading allocation:", error);
      toast.error("Failed to load RCN allocation");
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
      await loadAllocation();
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
      await loadAllocation();
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
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="h-20 bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  const allocatedRcn = allocation?.allocatedRcn || 0;
  const usedRcn = allocation?.usedRcn || 0;
  const availableRcn = allocation?.availableRcn || 0;

  return (
    <>
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Coins className="w-6 h-6 text-[#FFCC00]" />
            Group RCN Pool
          </h3>
          <button
            onClick={loadAllocation}
            className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4 text-gray-300" />
          </button>
        </div>

        {/* Allocation Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">Total Allocated</p>
            <p className="text-2xl font-bold text-white">{allocatedRcn.toFixed(2)} RCN</p>
          </div>

          <div className="bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">Used (Backing Tokens)</p>
            <p className="text-2xl font-bold text-orange-400">{usedRcn.toFixed(2)} RCN</p>
          </div>

          <div className="bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">Available</p>
            <p className="text-2xl font-bold text-green-400">{availableRcn.toFixed(2)} RCN</p>
          </div>
        </div>

        {/* Shop Balance */}
        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-300 mb-1">Your Shop's Main RCN Balance</p>
          <p className="text-xl font-bold text-blue-400">{shopRcnBalance.toFixed(2)} RCN</p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => setShowAllocateModal(true)}
            className="flex-1 bg-[#FFCC00] hover:bg-[#FFD700] text-black font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <ArrowUpCircle className="w-5 h-5" />
            Allocate RCN to Group
          </button>

          {availableRcn > 0 && (
            <button
              onClick={() => setShowWithdrawModal(true)}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <ArrowDownCircle className="w-5 h-5" />
              Withdraw to Shop
            </button>
          )}
        </div>

        {/* Info Text */}
        <div className="mt-4 text-sm text-gray-400">
          <p className="mb-2">
            <strong className="text-gray-300">Allocated RCN</strong> is dedicated to this group for issuing tokens.
          </p>
          <p className="mb-2">
            <strong className="text-gray-300">Used RCN</strong> is currently backing issued tokens (1:2 ratio).
          </p>
          <p>
            <strong className="text-gray-300">Available RCN</strong> can be used to issue new tokens or withdrawn back to your shop.
          </p>
        </div>
      </div>

      {/* Allocate Modal */}
      {showAllocateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-2xl font-bold text-white mb-4">Allocate RCN to Group</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Amount to Allocate
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#FFCC00]"
                min="0"
                step="0.01"
              />
              <p className="text-sm text-gray-400 mt-2">
                Available in shop balance: <span className="text-white font-bold">{shopRcnBalance.toFixed(2)} RCN</span>
              </p>
            </div>

            <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-3 mb-4">
              <p className="text-sm text-yellow-300">
                This RCN will be moved from your shop's main balance to this group's pool and can be used to issue group tokens.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAllocateModal(false);
                  setAmount("");
                }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={handleAllocate}
                disabled={submitting || !amount}
                className="flex-1 bg-[#FFCC00] hover:bg-[#FFD700] text-black font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "Allocating..." : "Allocate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-2xl font-bold text-white mb-4">Withdraw RCN to Shop</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Amount to Withdraw
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#FFCC00]"
                min="0"
                step="0.01"
                max={availableRcn}
              />
              <p className="text-sm text-gray-400 mt-2">
                Available to withdraw: <span className="text-white font-bold">{availableRcn.toFixed(2)} RCN</span>
              </p>
            </div>

            <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-300">
                Only unused RCN can be withdrawn. RCN currently backing issued tokens ({usedRcn.toFixed(2)} RCN) must stay in the pool.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowWithdrawModal(false);
                  setAmount("");
                }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={handleWithdraw}
                disabled={submitting || !amount}
                className="flex-1 bg-[#FFCC00] hover:bg-[#FFD700] text-black font-bold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
