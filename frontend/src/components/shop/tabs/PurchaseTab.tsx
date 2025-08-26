'use client';

import React, { useState } from 'react';
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
  Gift
} from 'lucide-react';

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
  paymentMethod: 'usdc' | 'eth';
  setPaymentMethod: (method: 'usdc' | 'eth') => void;
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
  shopName = "Your Shop"
}) => {
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // Quick purchase amounts
  const quickAmounts = [100, 500, 1000, 5000, 10000];

  // Calculate pricing
  const unitPrice = 0.10;
  const totalCost = purchaseAmount * unitPrice;
  const bonusAmount = purchaseAmount >= 10000 ? Math.floor(purchaseAmount * 0.05) :
    purchaseAmount >= 5000 ? Math.floor(purchaseAmount * 0.03) :
      purchaseAmount >= 1000 ? Math.floor(purchaseAmount * 0.02) : 0;
  const totalTokens = purchaseAmount + bonusAmount;

  // Calculate total purchased
  const totalPurchased = purchases
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const getStatusDetails = (status: string) => {
    switch (status) {
      case 'completed':
        return {
          color: 'text-green-400 bg-green-400/10 border-green-400/20',
          icon: <CheckCircle className="w-3 h-3" />,
          label: 'Completed'
        };
      case 'pending':
        return {
          color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
          icon: <Clock className="w-3 h-3" />,
          label: 'Pending'
        };
      case 'failed':
        return {
          color: 'text-red-400 bg-red-400/10 border-red-400/20',
          icon: <AlertCircle className="w-3 h-3" />,
          label: 'Failed'
        };
      default:
        return {
          color: 'text-gray-400 bg-gray-400/10 border-gray-400/20',
          icon: <AlertCircle className="w-3 h-3" />,
          label: status
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
            <div className="bg-gradient-to-br from-[#1C1C1C] to-[#252525] rounded-2xl border border-gray-800 overflow-hidden">
              <div className="bg-gradient-to-r from-[#FFCC00] to-[#FFB800] p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-1">Purchase RCN Tokens</h3>
                      <p className="text-sm text-gray-800">Buy tokens to reward your customers</p>
                    </div>
                  </div>
                  <ShoppingCart className="w-8 h-8 text-gray-900" />
                </div>
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
                        animation: 'fadeIn 0.2s ease-in-out',
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
                                <span className="text-xs font-bold text-blue-400">1</span>
                              </div>
                              <span className="text-gray-300">Purchase RCN tokens at a fixed rate of $0.10 per token</span>
                            </li>
                            <li className="flex items-start gap-3">
                              <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-xs font-bold text-blue-400">2</span>
                              </div>
                              <span className="text-gray-300">Tokens are instantly added to your shop's balance</span>
                            </li>
                            <li className="flex items-start gap-3">
                              <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-xs font-bold text-blue-400">3</span>
                              </div>
                              <span className="text-gray-300">Use tokens to reward customers for repairs and services</span>
                            </li>
                            <li className="flex items-start gap-3">
                              <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-xs font-bold text-blue-400">4</span>
                              </div>
                              <span className="text-gray-300">Customers can redeem tokens at your shop ($1 value per RCN)</span>
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
                      type="text"
                      min="1"
                      max="100000"
                      onChange={(e) => setPurchaseAmount(Math.max(1, parseInt(e.target.value) || 1))}
                      placeholder="Enter amount"
                      className="w-full px-6 py-4 bg-[#0D0D0D] border border-gray-700 rounded-xl text-xl font-semibold text-white placeholder-gray-500 focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent "
                    />
                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-none">
                      <span className="text-sm text-gray-400 font-medium">RCN</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Minimum: 1 RCN • Maximum: 100,000 RCN</p>
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
                        className={`py-2 px-3 rounded-lg text-sm font-semibold transition-all ${purchaseAmount === amount
                            ? 'bg-[#FFCC00] text-gray-900'
                            : 'bg-[#0D0D0D] text-gray-400 border border-gray-700 hover:border-gray-600 hover:text-white'
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
                      onClick={() => setPaymentMethod('usdc')}
                      className={`relative p-4 rounded-xl border-2 transition-all ${paymentMethod === 'usdc'
                          ? 'border-[#FFCC00] bg-[#FFCC00]/10'
                          : 'border-gray-700 bg-[#0D0D0D] hover:border-gray-600'
                        }`}
                    >
                      {paymentMethod === 'usdc' && (
                        <div className="absolute top-2 right-2">
                          <CheckCircle className="w-4 h-4 text-[#FFCC00]" />
                        </div>
                      )}
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                          <span className="text-lg font-bold text-blue-400">$</span>
                        </div>
                        <div>
                          <p className="font-semibold text-white">USDC</p>
                          <p className="text-xs text-gray-400">Stablecoin</p>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => setPaymentMethod('eth')}
                      className={`relative p-4 rounded-xl border-2 transition-all ${paymentMethod === 'eth'
                          ? 'border-[#FFCC00] bg-[#FFCC00]/10'
                          : 'border-gray-700 bg-[#0D0D0D] hover:border-gray-600'
                        }`}
                    >
                      {paymentMethod === 'eth' && (
                        <div className="absolute top-2 right-2">
                          <CheckCircle className="w-4 h-4 text-[#FFCC00]" />
                        </div>
                      )}
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
                          <span className="text-lg font-bold text-purple-400">Ξ</span>
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
                <div className="bg-[#0D0D0D] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Base Amount</span>
                    <span className="text-white font-medium">{purchaseAmount.toLocaleString()} RCN</span>
                  </div>
                  {bonusAmount > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-green-400 flex items-center gap-1">
                        <Gift className="w-3 h-3" />
                        Volume Bonus
                      </span>
                      <span className="text-green-400 font-medium">+{bonusAmount.toLocaleString()} RCN</span>
                    </div>
                  )}
                  <div className="border-t border-gray-800 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300 font-medium">Total Tokens</span>
                      <span className="text-xl font-bold text-[#FFCC00]">{totalTokens.toLocaleString()} RCN</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-gray-400 text-sm">Total Cost</span>
                      <span className="text-lg font-semibold text-white">${totalCost.toFixed(2)} USD</span>
                    </div>
                  </div>
                </div>

                {/* Purchase Button */}
                <button
                  onClick={onInitiatePurchase}
                  disabled={purchasing || purchaseAmount < 1}
                  className="w-full bg-gradient-to-r from-[#FFCC00] to-[#FFB800] text-gray-900 font-bold py-4 px-6 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-lg hover:shadow-[#FFCC00]/20 transform hover:scale-[1.02] flex items-center justify-center gap-2"
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
                    <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                      <History className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">Purchase History</h3>
                      <p className="text-sm text-gray-400">{purchases.length} total transactions</p>
                    </div>
                  </div>
                  {purchases.length > 5 && (
                    <button
                      onClick={() => setShowAllHistory(!showAllHistory)}
                      className="text-sm text-[#FFCC00] hover:text-[#FFB800] transition-colors flex items-center gap-1"
                    >
                      {showAllHistory ? 'Show Less' : 'Show All'}
                      <ChevronDown className={`w-4 h-4 transition-transform ${showAllHistory ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                </div>
              </div>

              <div className="p-6">
                {purchases.length > 0 ? (
                  <div className="space-y-3">
                    {(showAllHistory ? purchases : purchases.slice(0, 5)).map((purchase) => {
                      const status = getStatusDetails(purchase.status);
                      return (
                        <div
                          key={purchase.id}
                          className="bg-[#0D0D0D] rounded-xl p-4 border border-gray-800 hover:border-gray-700 transition-all"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-[#FFCC00]/10 rounded-lg flex items-center justify-center">
                                <Coins className="w-5 h-5 text-[#FFCC00]" />
                              </div>
                              <div>
                                <p className="font-semibold text-white">{purchase.amount.toLocaleString()} RCN</p>
                                <p className="text-sm text-gray-400">
                                  {new Date(purchase.createdAt).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                              </div>
                            </div>
                            <div className={`px-3 py-1 rounded-full border ${status.color} flex items-center gap-1.5`}>
                              {status.icon}
                              <span className="text-xs font-medium">{status.label}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4 text-sm">
                              <span className="text-gray-400">
                                Cost: <span className="text-white font-medium">${(purchase.totalCost || 0).toFixed(2)}</span>
                              </span>
                              <span className="text-gray-400">
                                Via: <span className="text-white font-medium">{purchase.paymentMethod.toUpperCase()}</span>
                              </span>
                            </div>
                            {purchase.transactionHash && (
                              <button className="text-[#FFCC00] hover:text-[#FFB800] transition-colors">
                                <ExternalLink className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Package className="w-10 h-10 text-gray-600" />
                    </div>
                    <h4 className="text-lg font-semibold text-white mb-2">No purchases yet</h4>
                    <p className="text-sm text-gray-400 mb-6">Start purchasing RCN tokens to reward your customers</p>
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