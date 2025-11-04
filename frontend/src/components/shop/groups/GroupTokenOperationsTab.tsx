"use client";

import { useState } from "react";
import { toast } from "react-hot-toast";
import { Coins, TrendingUp, TrendingDown, Search } from "lucide-react";
import * as shopGroupsAPI from "@/services/api/shopGroups";

interface GroupTokenOperationsTabProps {
  groupId: string;
  tokenSymbol: string;
}

export default function GroupTokenOperationsTab({
  groupId,
  tokenSymbol,
}: GroupTokenOperationsTabProps) {
  const [operationType, setOperationType] = useState<"earn" | "redeem">("earn");
  const [customerAddress, setCustomerAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [customerBalance, setCustomerBalance] = useState<shopGroupsAPI.CustomerGroupBalance | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);
  const [loadingBalance, setLoadingBalance] = useState(false);

  const handleCheckBalance = async () => {
    if (!customerAddress) {
      toast.error("Please enter customer address");
      return;
    }

    try {
      setLoadingBalance(true);
      const balance = await shopGroupsAPI.getCustomerBalance(groupId, customerAddress);
      setCustomerBalance(balance);
      if (!balance) {
        toast.info("Customer has no balance in this group yet");
      }
    } catch (error) {
      console.error("Error checking balance:", error);
      toast.error("Failed to check balance");
    } finally {
      setLoadingBalance(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerAddress || !amount) {
      toast.error("Please fill in all required fields");
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    try {
      setSubmitting(true);

      if (operationType === "earn") {
        const result = await shopGroupsAPI.earnGroupTokens(groupId, {
          customerAddress,
          amount: amountNum,
          reason: reason || undefined,
        });
        toast.success(`Successfully issued ${amountNum} ${tokenSymbol}!`);
        if (result) {
          setCustomerBalance({
            ...result,
            customerAddress,
            groupId,
            balance: result.newBalance,
          } as shopGroupsAPI.CustomerGroupBalance);
        }
      } else {
        const result = await shopGroupsAPI.redeemGroupTokens(groupId, {
          customerAddress,
          amount: amountNum,
          reason: reason || undefined,
        });
        toast.success(`Successfully redeemed ${amountNum} ${tokenSymbol}!`);
        if (result) {
          setCustomerBalance({
            ...result,
            customerAddress,
            groupId,
            balance: result.newBalance,
          } as shopGroupsAPI.CustomerGroupBalance);
        }
      }

      // Reset form
      setAmount("");
      setReason("");
    } catch (error: any) {
      console.error("Error processing transaction:", error);
      toast.error(error?.response?.data?.error || `Failed to ${operationType} tokens`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
        <Coins className="w-6 h-6" />
        Token Operations
      </h3>

      {/* Operation Type Selector */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setOperationType("earn")}
          className={`flex-1 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
            operationType === "earn"
              ? "bg-green-600 text-white"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
        >
          <TrendingUp className="w-5 h-5" />
          Issue Tokens
        </button>
        <button
          onClick={() => setOperationType("redeem")}
          className={`flex-1 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
            operationType === "redeem"
              ? "bg-orange-600 text-white"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
          }`}
        >
          <TrendingDown className="w-5 h-5" />
          Redeem Tokens
        </button>
      </div>

      {/* Customer Lookup */}
      <div className="bg-gray-900 rounded-lg p-4 mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Customer Wallet Address *
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={customerAddress}
            onChange={(e) => setCustomerAddress(e.target.value.toLowerCase())}
            placeholder="0x..."
            className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#FFCC00]"
          />
          <button
            onClick={handleCheckBalance}
            disabled={loadingBalance}
            className="px-4 py-2 bg-[#FFCC00] text-black rounded-lg hover:bg-[#FFD700] transition-colors disabled:opacity-50"
          >
            {loadingBalance ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div>
            ) : (
              <Search className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Customer Balance Display */}
        {customerBalance && (
          <div className="mt-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-gray-400 mb-1">Current Balance</p>
                <p className="text-2xl font-bold text-[#FFCC00]">
                  {customerBalance.balance} {tokenSymbol}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-1">Lifetime Earned</p>
                <p className="text-lg font-bold text-green-500">
                  {customerBalance.lifetimeEarned} {tokenSymbol}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-1">Lifetime Redeemed</p>
                <p className="text-lg font-bold text-orange-500">
                  {customerBalance.lifetimeRedeemed} {tokenSymbol}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Transaction Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Amount ({tokenSymbol}) *
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            min="0"
            step="0.01"
            required
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#FFCC00]"
          />
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Reason (optional)
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              operationType === "earn"
                ? "e.g., Oil change service"
                : "e.g., Discount on brake service"
            }
            className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#FFCC00]"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting}
          className={`w-full py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            operationType === "earn"
              ? "bg-green-600 hover:bg-green-700 text-white"
              : "bg-orange-600 hover:bg-orange-700 text-white"
          }`}
        >
          {submitting
            ? "Processing..."
            : operationType === "earn"
            ? `Issue ${amount || "0"} ${tokenSymbol}`
            : `Redeem ${amount || "0"} ${tokenSymbol}`}
        </button>
      </form>

      {/* Info Box */}
      <div className="mt-6 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <p className="text-sm text-blue-300">
          {operationType === "earn" ? (
            <>
              <strong>Issue Tokens:</strong> Give custom tokens to customers for purchases or
              services. These tokens can only be redeemed at member shops.
            </>
          ) : (
            <>
              <strong>Redeem Tokens:</strong> Allow customers to use their custom tokens for
              discounts or rewards at your shop.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
