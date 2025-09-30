"use client";

import React, { useState } from "react";
import {
  CreditCard,
  Clock,
  CheckCircle,
  AlertCircle,
  Info,
  Sparkles,
} from "lucide-react";

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
}

export const PurchaseTab: React.FC<PurchaseTabProps> = ({
  purchaseAmount,
  setPurchaseAmount,
  purchasing,
  purchases,
  onInitiatePurchase,
  onCheckPurchaseStatus,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  // Quick purchase amounts
  const quickAmounts = [100, 500, 1000, 5000, 10000];

  // Calculate pricing
  const bonusAmount =
    purchaseAmount >= 10000
      ? Math.floor(purchaseAmount * 0.05)
      : purchaseAmount >= 5000
      ? Math.floor(purchaseAmount * 0.03)
      : purchaseAmount >= 1000
      ? Math.floor(purchaseAmount * 0.02)
      : 0;

  const getStatusDetails = (status: string) => {
    switch (status) {
      case "completed":
        return {
          color: "text-green-400 bg-green-400/10 border-green-400/20",
          icon: <CheckCircle className="w-3 h-3" />,
          label: "Completed",
        };
      case "pending":
        return {
          color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
          icon: <Clock className="w-3 h-3" />,
          label: "Pending",
        };
      case "failed":
        return {
          color: "text-red-400 bg-red-400/10 border-red-400/20",
          icon: <AlertCircle className="w-3 h-3" />,
          label: "Failed",
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
    <>
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Purchase Card */}
          <div className="bg-[#212121] rounded-3xl">
            <div
              className="w-full flex flex-col px-4 md:px-8 py-4 text-white rounded-t-3xl"
              style={{
                backgroundImage: `url('/img/cust-ref-widget3.png')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            >
              <h3 className="text-xl font-bold text-gray-900 mb-1">
                Purchase RCN Tokens
              </h3>
              <p className="text-sm text-gray-800">
                Buy tokens to reward your customers
              </p>
            </div>
            <div className="p-6 space-y-6">
              {/* How it Works - Info Icon with Tooltip */}
              <div className="relative">
                <button
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                  className="p-2 bg-gray-100/20 hover:bg-gray-100/30 rounded-lg transition-all group"
                >
                  <Info className="w-4 h-4 text-gray-100/70 group-hover:text-gray-100 transition-colors" />
                </button>

                {/* Tooltip */}
                {showTooltip && (
                  <div
                    className="absolute top-full left-0 mt-2 w-80 z-50"
                    style={{
                      animation: "fadeIn 0.2s ease-in-out",
                    }}
                  >
                    <div className="bg-[#252525] border border-gray-700 rounded-xl shadow-2xl shadow-black/50 overflow-hidden">
                      <div className="bg-gradient-to-r from-blue-500/20 to-blue-600/20 px-4 py-3 border-b border-gray-700">
                        <h4 className="text-sm font-semibold text-blue-400 flex items-center gap-2">
                          <Sparkles className="w-4 h-4" />
                          How it works
                        </h4>
                      </div>
                      <div className="p-4">
                        <ul className="space-y-3 text-sm">
                          <li className="flex items-start gap-3">
                            <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-xs font-bold text-blue-400">
                                1
                              </span>
                            </div>
                            <span className="text-gray-300">
                              Purchase RCN tokens at a fixed rate of $0.10 per
                              token
                            </span>
                          </li>
                          <li className="flex items-start gap-3">
                            <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-xs font-bold text-blue-400">
                                2
                              </span>
                            </div>
                            <span className="text-gray-300">
                              Tokens are instantly added to your shop's balance
                            </span>
                          </li>
                          <li className="flex items-start gap-3">
                            <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-xs font-bold text-blue-400">
                                3
                              </span>
                            </div>
                            <span className="text-gray-300">
                              Use tokens to reward customers for repairs and
                              services
                            </span>
                          </li>
                          <li className="flex items-start gap-3">
                            <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-xs font-bold text-blue-400">
                                4
                              </span>
                            </div>
                            <span className="text-gray-300">
                              Customers can redeem tokens at your shop ($1 value
                              per RCN)
                            </span>
                          </li>
                        </ul>
                      </div>
                    </div>
                    {/* Tooltip Arrow */}
                    <div className="absolute -top-2 left-4 w-4 h-4 bg-[#252525] border-l border-t border-gray-700 transform rotate-45"></div>
                  </div>
                )}
              </div>
              {/* Amount Input */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Token Amount
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="100000"
                    onChange={(e) =>
                      setPurchaseAmount(
                        Math.max(1, parseInt(e.target.value) || 1)
                      )
                    }
                    placeholder="Enter rcn amount"
                    className="w-full px-6 py-4 bg-[#2F2F2F] border border-gray-700 rounded-xl text-xl font-semibold text-[#FFCC00] placeholder-[#FFCC00] focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent "
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  <span className="text-[#FFCC00]">Minimum</span>: 1 RCN •{" "}
                  <span className="text-[#FFCC00]">Maximum</span>: 100,000 RCN
                </p>
              </div>

              {/* Quick Amount Buttons */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Quick Select
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {quickAmounts.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setPurchaseAmount(amount)}
                      className={`py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
                        purchaseAmount === amount
                          ? "bg-[#FFCC00] text-gray-900"
                          : "bg-[#0D0D0D] text-gray-400 border border-gray-700 hover:border-gray-600 hover:text-white"
                      }`}
                    >
                      {amount >= 1000 ? `${amount / 1000}k` : amount}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Method - Credit Card Only */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  Payment Method
                </label>
                <div className="grid grid-cols-1 gap-3">
                  <div className="relative p-4 rounded-xl border-2 border-[#FFCC00] bg-[#FFCC00]/10">
                    <div className="absolute top-2 left-2">
                      <CheckCircle className="w-4 h-4 text-[#FFCC00]" />
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                        <CreditCard className="w-6 h-6 text-blue-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-white">Credit Card</p>
                        <p className="text-xs text-gray-400">
                          Secure payment via Stripe
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="bg-[#2F2F2F] rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Base Amount</span>
                  <span className="text-white font-medium">
                    {purchaseAmount.toLocaleString()} RCN
                  </span>
                </div>
                {bonusAmount > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Tier Bonus</span>
                    <span className="text-green-400 font-medium">
                      +{bonusAmount.toLocaleString()} RCN
                    </span>
                  </div>
                )}
                <div className="pt-3 mt-3 border-t border-gray-700">
                  <div className="flex items-center justify-between">
                    <span className="text-white font-semibold">Total Cost</span>
                    <span className="text-[#FFCC00] font-bold text-lg">
                      ${((purchaseAmount + bonusAmount) * 0.1).toFixed(2)} USD
                    </span>
                  </div>
                </div>
              </div>

              {/* Purchase Button */}
              <button
                type="button"
                onClick={onInitiatePurchase}
                disabled={purchasing || purchaseAmount < 100}
                className={`w-full py-4 px-6 rounded-xl font-semibold transition-all ${
                  purchasing || purchaseAmount < 100
                    ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                    : "bg-[#FFCC00] text-[#1A1A1A] hover:bg-[#FFCC00]/90"
                }`}
              >
                {purchasing ? "Processing..." : "Complete Purchase"}
              </button>
            </div>
          </div>

          {/* Recent Purchases Section */}
          <div className="bg-[#212121] rounded-3xl p-6 flex flex-col max-h-[50vh] lg:max-h-[800px]">
            <h3 className="text-xl font-semibold text-white mb-6 flex-shrink-0">
              Recent Purchases
            </h3>
            {purchasing ? (
              <div className="text-center text-gray-400">Loading...</div>
            ) : purchases.length === 0 ? (
              <p className="text-gray-400 text-center">No purchases yet</p>
            ) : (
              <div className="space-y-3 overflow-y-auto flex-1 pr-2">
                {purchases.map((purchase) => {
                  const statusInfo = getStatusDetails(purchase.status);
                  return (
                    <div
                      key={purchase.id}
                      className="bg-[#2F2F2F] rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-medium">
                            {purchase.amount.toLocaleString()} RCN
                          </p>
                          <p className="text-gray-400 text-sm">
                            {new Date(purchase.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[#FFCC00] font-medium">
                            $
                            {(
                              purchase.totalCost || purchase.amount * 0.1
                            ).toFixed(2)}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={`text-sm flex items-center gap-1 ${statusInfo.color} px-2 py-1 rounded border`}
                            >
                              {statusInfo.icon}
                              {statusInfo.label}
                            </span>
                          </div>
                        </div>
                      </div>
                      {purchase.status === "pending" && (
                        <div className="mt-3 pt-3 border-t border-gray-700">
                          <button
                            onClick={() =>
                              onCheckPurchaseStatus
                                ? onCheckPurchaseStatus(purchase.id)
                                : window.location.reload()
                            }
                            className="text-sm bg-[#FFCC00] text-[#1A1A1A] hover:bg-[#FFCC00]/90 px-3 py-1 rounded font-medium"
                          >
                            Check Payment Status
                          </button>
                          <p className="text-xs text-gray-500 mt-1">
                            Payment may take a moment to process
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
