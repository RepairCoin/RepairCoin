"use client";

import React from "react";
import {
  CreditCard,
  Clock,
  CheckCircle,
  AlertCircle,
  ShoppingCart,
  HelpCircle,
  History,
} from "lucide-react";
import Tooltip from "../../ui/tooltip";

interface PurchaseHistory {
  id: string;
  amount: number;
  totalCost?: number;
  status: string;
  createdAt: string;
  transactionHash?: string;
}

interface PurchaseTabProps {
  purchaseAmount: number;
  setPurchaseAmount: (amount: number) => void;
  purchasing: boolean;
  purchases: PurchaseHistory[];
  onInitiatePurchase: () => void;
  onCheckPurchaseStatus?: (purchaseId: string) => void;
  shopBalance?: number;
  shopName?: string;
  isBlocked?: boolean;
  blockReason?: string;
}

export const PurchaseTab: React.FC<PurchaseTabProps> = ({
  purchaseAmount,
  setPurchaseAmount,
  purchasing,
  purchases,
  onInitiatePurchase,
  onCheckPurchaseStatus,
  isBlocked = false,
  blockReason = "This action is currently blocked",
}) => {

  // Quick purchase amounts (minimum 5 due to Stripe requirements)
  const quickAmounts = [5, 10, 50, 100, 500, 1000, 5000];

  // Calculate pricing
  const bonusAmount =
    purchaseAmount >= 10000
      ? Math.floor(purchaseAmount * 0.05)
      : purchaseAmount >= 5000
      ? Math.floor(purchaseAmount * 0.03)
      : purchaseAmount >= 1000
      ? Math.floor(purchaseAmount * 0.02)
      : 0;

  const getStatusDetails = (status: string, createdAt: string) => {
    // Check if purchase is very recent (< 2 minutes) and still pending
    const purchaseTime = new Date(createdAt).getTime();
    const ageMinutes = Math.floor((Date.now() - purchaseTime) / 60000);

    if (status === "pending" && ageMinutes < 2) {
      return {
        color: "text-blue-400 bg-blue-400/10 border-blue-400/20",
        icon: <Clock className="w-3 h-3 animate-pulse" />,
        label: "In Progress",
      };
    }

    switch (status) {
      case "completed":
        return {
          color: "text-green-400 bg-green-400/10 border-green-400/20",
          icon: <CheckCircle className="w-3 h-3" />,
          label: "Completed",
        };
      case "pending":
        return {
          color: "text-gray-400 bg-gray-400/10 border-gray-400/20",
          icon: <AlertCircle className="w-3 h-3" />,
          label: "Cancelled",
        };
      case "failed":
        return {
          color: "text-red-400 bg-red-400/10 border-red-400/20",
          icon: <AlertCircle className="w-3 h-3" />,
          label: "Expired",
        };
      case "cancelled":
        return {
          color: "text-gray-400 bg-gray-400/10 border-gray-400/20",
          icon: <AlertCircle className="w-3 h-3" />,
          label: "Cancelled",
        };
      default:
        return {
          color: "text-gray-400 bg-gray-400/10 border-gray-400/20",
          icon: <AlertCircle className="w-3 h-3" />,
          label: status,
        };
    }
  };

  return (
    <div className=" mx-auto px-2 py-2">
      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Purchase Card */}
        <div className="bg-[#101010] border border-gray-800 rounded-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5">
            <div className="flex items-center gap-3">
              <ShoppingCart className="w-5 h-5 text-[#FFCC00]" />
              <h3 className="text-lg font-semibold text-[#FFCC00]">
                Purchase RCN Tokens
              </h3>
            </div>
            <Tooltip
              title="How it works"
              position="left"
              className=""
              content={
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-blue-400">1</span>
                    </div>
                    <span className="text-gray-300">
                      Purchase RCN tokens at a fixed rate of $0.10 per token
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-blue-400">2</span>
                    </div>
                    <span className="text-gray-300">
                      Tokens are instantly added to your shop&apos;s balance
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-blue-400">3</span>
                    </div>
                    <span className="text-gray-300">
                      Use tokens to reward customers for repairs and services
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-blue-400">4</span>
                    </div>
                    <span className="text-gray-300">
                      Customers can redeem tokens at your shop ($1 value per RCN)
                    </span>
                  </li>
                </ul>
              }
            >
              <HelpCircle className="w-5 h-5 text-gray-500 hover:text-gray-400 cursor-pointer" />
            </Tooltip>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-800" />

          <div className="p-6 space-y-6">
            {/* Token Amount */}
            <div>
              <label className="block text-sm font-medium text-white mb-3">
                Token Amount
              </label>
              <input
                type="number"
                min="5"
                max="100000"
                value={purchaseAmount || ""}
                onChange={(e) => {
                  if (e.target.value) {
                    setPurchaseAmount(Math.max(1, parseInt(e.target.value) || 1));
                  } else {
                    setPurchaseAmount(0);
                  }
                }}
                placeholder="Enter RCN Amount"
                className="w-full px-4 py-3 bg-[#1A1A1A] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-2">
                Minimum: 5 RCN ($0.50) • Maximum: 100,000 RCN
              </p>
            </div>

            {/* Quick Select */}
            <div>
              <label className="block text-sm font-medium text-white mb-3">
                Quick Select
              </label>
              <div className="grid grid-cols-4 gap-2">
                {quickAmounts.slice(0, 4).map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setPurchaseAmount(amount)}
                    className={`py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                      purchaseAmount === amount
                        ? "bg-[#FFCC00] text-gray-900"
                        : "bg-transparent text-gray-400 border border-gray-700 hover:border-gray-500 hover:text-white"
                    }`}
                  >
                    {amount}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-2 mt-2">
                {quickAmounts.slice(4).map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setPurchaseAmount(amount)}
                    className={`py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
                      purchaseAmount === amount
                        ? "bg-[#FFCC00] text-gray-900"
                        : "bg-transparent text-gray-400 border border-gray-700 hover:border-gray-500 hover:text-white"
                    }`}
                  >
                    {amount}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-sm font-medium text-white mb-3">
                Payment Method
              </label>
              <div className="flex items-center justify-between p-4 rounded-xl border-2 border-[#FFCC00] bg-[#FFCC00]/5">
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 bg-[#FFCC00]/20 rounded-full flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-[#FFCC00]" />
                  </div>
                  <div>
                    <p className="font-medium text-white">Credit Card</p>
                    <p className="text-xs text-gray-500">
                      Secure payment via Stripe
                    </p>
                  </div>
                </div>
                <CheckCircle className="w-5 h-5 text-[#FFCC00]" />
              </div>
            </div>

            {/* Price Summary */}
            <div className="rounded-xl border border-gray-800 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-gray-400">Base Amount</span>
                <span className="text-white font-medium">
                  {purchaseAmount.toLocaleString()} RCN
                </span>
              </div>
              {bonusAmount > 0 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
                  <span className="text-gray-400">Tier Bonus</span>
                  <span className="text-green-400 font-medium">
                    +{bonusAmount.toLocaleString()} RCN
                  </span>
                </div>
              )}
              <div className="border-t border-gray-800">
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-white font-semibold">Total Cost</span>
                  <span className="text-[#FFCC00] font-bold">
                    $ {((purchaseAmount + bonusAmount) * 0.1).toFixed(2)} USD
                  </span>
                </div>
              </div>
            </div>

            {/* Purchase Button */}
            <button
              type="button"
              onClick={onInitiatePurchase}
              disabled={purchasing || purchaseAmount < 5 || isBlocked}
              className={`w-full py-4 px-6 rounded-xl font-semibold transition-all ${
                purchasing || purchaseAmount < 5 || isBlocked
                  ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                  : "bg-[#FFCC00] text-gray-900 hover:bg-[#FFCC00]/90"
              }`}
              title={isBlocked ? blockReason : undefined}
            >
              {purchasing
                ? "Processing..."
                : isBlocked
                ? "Purchase Blocked"
                : "Complete Purchase"}
            </button>
            {isBlocked && (
              <p className="text-sm text-red-400 text-center">{blockReason}</p>
            )}
          </div>
        </div>

        {/* Recent Purchases Section */}
        <div className="bg-[#101010] border border-gray-800 rounded-2xl flex flex-col max-h-[50vh] lg:max-h-[800px]">
          {/* Header */}
          <div className="flex items-center gap-3 px-6 py-5 flex-shrink-0">
            <History className="w-5 h-5 text-[#FFCC00]" />
            <h3 className="text-lg font-semibold text-[#FFCC00]">
              Recent Purchases
            </h3>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-800" />

          <div className="p-6 flex-1 overflow-hidden">
            {purchasing ? (
              <div className="text-center text-gray-400">Loading...</div>
            ) : purchases.length === 0 ? (
              <p className="text-gray-400 text-center">No purchases yet</p>
            ) : (
              <div className="space-y-4 overflow-y-auto h-full pr-2">
                {purchases.map((purchase) => {
                  const statusInfo = getStatusDetails(
                    purchase.status,
                    purchase.createdAt
                  );
                  return (
                    <div
                      key={purchase.id}
                      className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-4"
                    >
                      {/* Top Row: RCN Amount and Price */}
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-white font-semibold text-lg">
                          {purchase.amount.toLocaleString()} RCN
                        </p>
                        <p className="text-[#FFCC00] font-semibold">
                          ${" "}
                          {(purchase.totalCost || purchase.amount * 0.1).toFixed(
                            2
                          )}
                        </p>
                      </div>

                      {/* Divider */}
                      <div className="border-t border-gray-700 mb-3" />

                      {/* Bottom Row: Date and Status */}
                      <div className="flex items-center justify-between">
                        <p className="text-gray-400 text-sm">
                          <span className="text-gray-500">Date Purchased:</span>{" "}
                          {new Date(purchase.createdAt).toLocaleDateString()}
                        </p>
                        <span
                          className={`text-xs flex items-center gap-1 ${statusInfo.color} px-3 py-1 rounded-full border`}
                        >
                          {statusInfo.icon}
                          {statusInfo.label}
                        </span>
                      </div>

                      {/* In Progress Message */}
                      {purchase.status === "pending" &&
                        (() => {
                          const purchaseTime = new Date(
                            purchase.createdAt
                          ).getTime();
                          const now = Date.now();
                          const ageMinutes = Math.floor(
                            (now - purchaseTime) / 60000
                          );
                          const isVeryRecent = ageMinutes < 2;

                          if (isVeryRecent) {
                            return (
                              <div className="mt-3 pt-3 border-t border-gray-700">
                                <div className="flex items-center gap-2">
                                  <div className="animate-pulse w-2 h-2 bg-blue-400 rounded-full"></div>
                                  <p className="text-xs text-gray-400">
                                    Payment in progress... Complete your purchase
                                    in the Stripe window
                                  </p>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
