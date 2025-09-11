"use client";

import React, { useState } from "react";
import {
  CreditCard,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  ShoppingCart,
  Coins,
  Wallet,
  Info,
  ChevronRight,
  Package,
  Receipt,
  Calculator,
  Zap,
  Shield,
  Star,
  ArrowRight,
  Plus,
  Minus,
  History,
  ChevronDown,
  ExternalLink,
  Sparkles,
  Gift,
} from "lucide-react";

interface PurchaseHistory {
  id: string;
  amount: number;
  totalCost?: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
  transactionHash?: string;
}

interface PurchaseTabProps {
  purchaseAmount: number;
  setPurchaseAmount: (amount: number) => void;
  paymentMethod: "usdc" | "eth";
  setPaymentMethod: (method: "usdc" | "eth") => void;
  purchasing: boolean;
  purchases: PurchaseHistory[];
  onInitiatePurchase: () => void;
  shopBalance?: number;
  shopName?: string;
}

export const PurchaseTab: React.FC<PurchaseTabProps> = ({
  purchaseAmount,
  setPurchaseAmount,
  paymentMethod,
  setPaymentMethod,
  purchasing,
  purchases,
  onInitiatePurchase,
  shopBalance = 0,
  shopName = "Your Shop",
}) => {
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // Quick purchase amounts
  const quickAmounts = [100, 500, 1000, 5000, 10000];

  // Calculate pricing
  const unitPrice = 0.1;
  const totalCost = purchaseAmount * unitPrice;
  const bonusAmount =
    purchaseAmount >= 10000
      ? Math.floor(purchaseAmount * 0.05)
      : purchaseAmount >= 5000
      ? Math.floor(purchaseAmount * 0.03)
      : purchaseAmount >= 1000
      ? Math.floor(purchaseAmount * 0.02)
      : 0;
  const totalTokens = purchaseAmount + bonusAmount;

  // Calculate total purchased
  const totalPurchased = purchases
    .filter((p) => p.status === "completed")
    .reduce((sum, p) => sum + (p.amount || 0), 0);

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
          {/* Purchase Form */}
          <div className="space-y-6">
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
                                Tokens are instantly added to your shop's
                                balance
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
                                Customers can redeem tokens at your shop ($1
                                value per RCN)
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

                {/* Payment Method */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setPaymentMethod("usdc")}
                      className={`relative p-4 rounded-xl border-2 transition-all ${
                        paymentMethod === "usdc"
                          ? "border-[#FFCC00] bg-[#2F2F2F]/10"
                          : "border-gray-700 bg-[#2F2F2F] hover:border-gray-600"
                      }`}
                    >
                      {paymentMethod === "usdc" && (
                        <div className="absolute top-2 left-2">
                          <CheckCircle className="w-4 h-4 text-[#FFCC00]" />
                        </div>
                      )}
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                          <svg
                            width="44"
                            height="44"
                            viewBox="0 0 44 44"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            xmlnsXlink="http://www.w3.org/1999/xlink"
                          >
                            <rect
                              width="44"
                              height="44"
                              fill="url(#pattern0_4318_6638)"
                            />
                            <defs>
                              <pattern
                                id="pattern0_4318_6638"
                                patternContentUnits="objectBoundingBox"
                                width="1"
                                height="1"
                              >
                                <use
                                  xlinkHref="#image0_4318_6638"
                                  transform="scale(0.00277778)"
                                />
                              </pattern>
                              <image
                                id="image0_4318_6638"
                                width="360"
                                height="360"
                                preserveAspectRatio="none"
                                xlinkHref="data:image/png;base64,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"
                              />
                            </defs>
                          </svg>
                        </div>
                        <div>
                          <p className="font-semibold text-white">USDC</p>
                          <p className="text-xs text-gray-400">Stablecoin</p>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => setPaymentMethod("eth")}
                      className={`relative p-4 rounded-xl border-2 transition-all ${
                        paymentMethod === "eth"
                          ? "border-[#FFCC00] bg-[#2F2F2F]/10"
                          : "border-gray-700 bg-[#2F2F2F] hover:border-gray-600"
                      }`}
                    >
                      {paymentMethod === "eth" && (
                        <div className="absolute top-2 left-2">
                          <CheckCircle className="w-4 h-4 text-[#FFCC00]" />
                        </div>
                      )}
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
                          <svg
                            width="32"
                            height="32"
                            viewBox="0 0 32 32"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <circle cx="16" cy="16" r="16" fill="#EDF0F4" />
                            <path
                              d="M15.9554 6.40039L15.8281 6.83273V19.3772L15.9554 19.5042L21.7783 16.0622L15.9554 6.40039Z"
                              fill="#343434"
                            />
                            <path
                              d="M15.9558 6.40039L10.1328 16.0622L15.9558 19.5042V13.4154V6.40039Z"
                              fill="#8C8C8C"
                            />
                            <path
                              d="M15.9565 20.6062L15.8848 20.6937V25.1622L15.9565 25.3716L21.7829 17.166L15.9565 20.6062Z"
                              fill="#3C3C3B"
                            />
                            <path
                              d="M15.9558 25.3716V20.6062L10.1328 17.166L15.9558 25.3716Z"
                              fill="#8C8C8C"
                            />
                            <path
                              d="M15.957 19.5038L21.7799 16.0618L15.957 13.415V19.5038Z"
                              fill="#141414"
                            />
                            <path
                              d="M10.1328 16.0618L15.9558 19.5038V13.415L10.1328 16.0618Z"
                              fill="#393939"
                            />
                          </svg>
                        </div>
                        <div>
                          <p className="font-semibold text-white">ETH</p>
                          <p className="text-xs text-gray-400">Ethereum</p>
                        </div>
                      </div>
                    </button>
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
                      <span className="text-green-400 flex items-center gap-1">
                        <Gift className="w-3 h-3" />
                        Volume Bonus
                      </span>
                      <span className="text-green-400 font-medium">
                        +{bonusAmount.toLocaleString()} RCN
                      </span>
                    </div>
                  )}
                  <div className="border-t border-gray-500 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300 font-medium">
                        Total Tokens
                      </span>
                      <span className="text-xl font-bold text-[#FFCC00]">
                        {totalTokens.toLocaleString()} RCN
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-gray-400 text-sm">Total Cost</span>
                      <span className="text-lg font-semibold text-white">
                        ${totalCost.toFixed(2)} USD
                      </span>
                    </div>
                  </div>
                </div>

                {/* Purchase Button */}
                <button
                  onClick={onInitiatePurchase}
                  disabled={purchasing || purchaseAmount < 1}
                  className="w-full bg-[#FFCC00] text-gray-900 font-bold py-4 px-6 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-lg hover:shadow-[#FFCC00]/20 transform hover:scale-[1.02] flex items-center justify-center gap-2"
                >
                  {purchasing ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
                      <span>Processing Purchase...</span>
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="w-5 h-5" />
                      <span>Purchase {totalTokens.toLocaleString()} RCN</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Purchase History */}
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-[#1C1C1C] to-[#252525] rounded-2xl border border-gray-800 overflow-hidden">
              <div className="p-6 border-b border-gray-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M11.4405 2C8.87693 2.00731 6.41404 2.99891 4.56055 4.77V3C4.56055 2.73478 4.45519 2.48043 4.26765 2.29289C4.08012 2.10536 3.82576 2 3.56055 2C3.29533 2 3.04098 2.10536 2.85344 2.29289C2.6659 2.48043 2.56055 2.73478 2.56055 3V7.5C2.56055 7.76522 2.6659 8.01957 2.85344 8.20711C3.04098 8.39464 3.29533 8.5 3.56055 8.5H8.06055C8.32576 8.5 8.58012 8.39464 8.76765 8.20711C8.95519 8.01957 9.06055 7.76522 9.06055 7.5C9.06055 7.23478 8.95519 6.98043 8.76765 6.79289C8.58012 6.60536 8.32576 6.5 8.06055 6.5H5.66055C6.57226 5.53701 7.70905 4.81576 8.96868 4.40114C10.2283 3.98651 11.5712 3.89152 12.8767 4.1247C14.1821 4.35788 15.4091 4.91193 16.4473 5.73699C17.4855 6.56205 18.3023 7.63226 18.8243 8.85133C19.3462 10.0704 19.5569 11.4001 19.4374 12.7208C19.318 14.0415 18.872 15.3118 18.1398 16.4174C17.4076 17.5231 16.412 18.4293 15.2426 19.0547C14.0732 19.68 12.7666 20.0049 11.4405 20C11.1753 20 10.921 20.1054 10.7334 20.2929C10.5459 20.4804 10.4405 20.7348 10.4405 21C10.4405 21.2652 10.5459 21.5196 10.7334 21.7071C10.921 21.8946 11.1753 22 11.4405 22C14.0927 22 16.6363 20.9464 18.5116 19.0711C20.387 17.1957 21.4405 14.6522 21.4405 12C21.4405 9.34784 20.387 6.8043 18.5116 4.92893C16.6363 3.05357 14.0927 2 11.4405 2ZM11.4405 8C11.1753 8 10.921 8.10536 10.7334 8.29289C10.5459 8.48043 10.4405 8.73478 10.4405 9V12C10.4405 12.2652 10.5459 12.5196 10.7334 12.7071C10.921 12.8946 11.1753 13 11.4405 13H13.4405C13.7058 13 13.9601 12.8946 14.1477 12.7071C14.3352 12.5196 14.4405 12.2652 14.4405 12C14.4405 11.7348 14.3352 11.4804 14.1477 11.2929C13.9601 11.1054 13.7058 11 13.4405 11H12.4405V9C12.4405 8.73478 12.3352 8.48043 12.1477 8.29289C11.9601 8.10536 11.7058 8 11.4405 8Z"
                        fill="#FFCC00"
                      />
                    </svg>
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        Purchase History
                      </h3>
                      <p className="text-sm text-gray-400">
                        {purchases.length} total transactions
                      </p>
                    </div>
                  </div>
                  {purchases.length > 5 && (
                    <button
                      onClick={() => setShowAllHistory(!showAllHistory)}
                      className="text-sm text-[#FFCC00] hover:text-[#FFB800] transition-colors flex items-center gap-1"
                    >
                      {showAllHistory ? "Show Less" : "Show All"}
                      <ChevronDown
                        className={`w-4 h-4 transition-transform ${
                          showAllHistory ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                  )}
                </div>
              </div>

              <div className="p-6">
                {purchases.length > 0 ? (
                  <div className="space-y-3">
                    {(showAllHistory ? purchases : purchases.slice(0, 5)).map(
                      (purchase) => {
                        const status = getStatusDetails(purchase.status);
                        return (
                          <div
                            key={purchase.id}
                            className="bg-[#0D0D0D] rounded-xl p-4 border border-gray-800 hover:border-gray-700 transition-all"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex gap-4">
                                <svg
                                  width="24"
                                  height="24"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path
                                    d="M21 16H7C6.73478 16 6.48043 15.8946 6.29289 15.7071C6.10536 15.5196 6 15.2652 6 15C6 14.7348 6.10536 14.4804 6.29289 14.2929C6.48043 14.1054 6.73478 14 7 14H17.44C18.1087 14 18.7582 13.7767 19.2854 13.3654C19.8126 12.9542 20.1873 12.3786 20.35 11.73L22 5.24C22.0375 5.09241 22.0407 4.93821 22.0095 4.78917C21.9783 4.64013 21.9135 4.50018 21.82 4.38C21.7227 4.25673 21.5978 4.1581 21.4554 4.09208C21.3129 4.02606 21.1569 3.99452 21 4H6.76C6.55369 3.41645 6.17193 2.911 5.66707 2.55294C5.1622 2.19488 4.55894 2.00174 3.94 2H3C2.73478 2 2.48043 2.10536 2.29289 2.29289C2.10536 2.48043 2 2.73478 2 3C2 3.26522 2.10536 3.51957 2.29289 3.70711C2.48043 3.89464 2.73478 4 3 4H3.94C4.16843 3.99334 4.39226 4.06513 4.57421 4.20341C4.75615 4.34169 4.88525 4.53812 4.94 4.76L5 5.24L6.73 12C5.93435 12.0358 5.18551 12.3862 4.64822 12.9741C4.11093 13.5621 3.8292 14.3394 3.865 15.135C3.9008 15.9306 4.25121 16.6795 4.83914 17.2168C5.42707 17.7541 6.20435 18.0358 7 18H7.18C7.01554 18.4531 6.96269 18.9392 7.02593 19.4171C7.08917 19.895 7.26665 20.3506 7.54332 20.7454C7.81999 21.1401 8.18772 21.4624 8.61535 21.6849C9.04299 21.9074 9.51795 22.0235 10 22.0235C10.4821 22.0235 10.957 21.9074 11.3846 21.6849C11.8123 21.4624 12.18 21.1401 12.4567 20.7454C12.7334 20.3506 12.9108 19.895 12.9741 19.4171C13.0373 18.9392 12.9845 18.4531 12.82 18H15.18C15.0155 18.4531 14.9627 18.9392 15.0259 19.4171C15.0892 19.895 15.2666 20.3506 15.5433 20.7454C15.82 21.1401 16.1877 21.4624 16.6154 21.6849C17.043 21.9074 17.5179 22.0235 18 22.0235C18.4821 22.0235 18.957 21.9074 19.3846 21.6849C19.8123 21.4624 20.18 21.1401 20.4567 20.7454C20.7334 20.3506 20.9108 19.895 20.9741 19.4171C21.0373 18.9392 20.9845 18.4531 20.82 18H21C21.2652 18 21.5196 17.8946 21.7071 17.7071C21.8946 17.5196 22 17.2652 22 17C22 16.7348 21.8946 16.4804 21.7071 16.2929C21.5196 16.1054 21.2652 16 21 16ZM19.72 6L18.41 11.24C18.3552 11.4619 18.2262 11.6583 18.0442 11.7966C17.8623 11.9349 17.6384 12.0067 17.41 12H8.78L7.28 6H19.72ZM10 20C9.80222 20 9.60888 19.9414 9.44443 19.8315C9.27998 19.7216 9.15181 19.5654 9.07612 19.3827C9.00043 19.2 8.98063 18.9989 9.01921 18.8049C9.0578 18.6109 9.15304 18.4327 9.29289 18.2929C9.43275 18.153 9.61093 18.0578 9.80491 18.0192C9.99889 17.9806 10.2 18.0004 10.3827 18.0761C10.5654 18.1518 10.7216 18.28 10.8315 18.4444C10.9414 18.6089 11 18.8022 11 19C11 19.2652 10.8946 19.5196 10.7071 19.7071C10.5196 19.8946 10.2652 20 10 20ZM18 20C17.8022 20 17.6089 19.9414 17.4444 19.8315C17.28 19.7216 17.1518 19.5654 17.0761 19.3827C17.0004 19.2 16.9806 18.9989 17.0192 18.8049C17.0578 18.6109 17.153 18.4327 17.2929 18.2929C17.4327 18.153 17.6109 18.0578 17.8049 18.0192C17.9989 17.9806 18.2 18.0004 18.3827 18.0761C18.5654 18.1518 18.7216 18.28 18.8315 18.4444C18.9414 18.6089 19 18.8022 19 19C19 19.2652 18.8946 19.5196 18.7071 19.7071C18.5196 19.8946 18.2652 20 18 20Z"
                                    fill="#FFCC00"
                                  />
                                </svg>
                                <div className="flex items-center gap-3">
                                  <div>
                                    <p className="font-semibold text-white">
                                      {purchase.amount.toLocaleString()} RCN
                                    </p>
                                    <p className="text-sm text-gray-400">
                                      {new Date(
                                        purchase.createdAt
                                      ).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </p>
                                    <p className="text-gray-400">
                                      Cost:{" "}
                                      <span className="text-white font-medium">
                                        ${(purchase.totalCost || 0).toFixed(2)}
                                      </span>
                                    </p>
                                    <p className="text-gray-400">
                                      Via:{" "}
                                      <span className="text-white font-medium">
                                        {purchase.paymentMethod.toUpperCase()}
                                      </span>
                                    </p>
                                  </div>
                                </div>
                              </div>
                              <div
                                className={`px-3 py-1 rounded-full border ${status.color} flex items-center gap-1.5`}
                              >
                                {status.icon}
                                <span className="text-xs font-medium">
                                  {status.label}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Package className="w-10 h-10 text-gray-600" />
                    </div>
                    <h4 className="text-lg font-semibold text-white mb-2">
                      No purchases yet
                    </h4>
                    <p className="text-sm text-gray-400 mb-6">
                      Start purchasing RCN tokens to reward your customers
                    </p>
                    <div className="inline-flex items-center gap-2 text-sm text-[#FFCC00]">
                      <ArrowRight className="w-4 h-4" />
                      <span>Make your first purchase above</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
