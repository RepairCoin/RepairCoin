"use client";

import React, { useState, useEffect } from "react";
import { X, Loader2, Wallet, TrendingUp, Clock, MapPin, Mail, Trophy, ArrowUpRight, ArrowDownRight } from "lucide-react";
import toast from "react-hot-toast";

interface CustomerTransaction {
  id: string;
  type: string;
  amount: number;
  shopId?: string;
  shopName?: string;
  timestamp?: string;
  createdAt?: string;
  transactionHash?: string;
  status?: string;
  description?: string;
}

interface CustomerDetails {
  address: string;
  name?: string;
  email?: string;
  profile_image_url?: string;
  tier: "BRONZE" | "SILVER" | "GOLD";
  currentBalance: number;
  lifetimeEarnings: number;
  totalRedemptions: number;
  lastTransaction?: string;
  joinDate?: string;
  isActive: boolean;
  suspended?: boolean;
}

interface CustomerAnalytics {
  // Fields from backend
  totalEarned?: number;
  totalSpent?: number;
  transactionCount?: number;
  favoriteShop?: string | null;
  successfulReferrals?: number;
  earningsTrend?: { date: string; amount: number }[];
  redemptionHistory?: { date: string; amount: number; shopId: string; shopName: string }[];
  // Legacy fields for backwards compatibility
  totalTransactions?: number;
  totalEarnings?: number;
  totalRedemptions?: number;
  averageTransactionValue?: number;
  monthlyActivity?: {
    month: string;
    earnings: number;
    redemptions: number;
  }[];
}

interface CustomerDetailsModalProps {
  customerAddress: string;
  shopId: string;
  onClose: () => void;
}

export const CustomerDetailsModal: React.FC<CustomerDetailsModalProps> = ({
  customerAddress,
  shopId,
  onClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [customerDetails, setCustomerDetails] = useState<CustomerDetails | null>(null);
  const [transactions, setTransactions] = useState<CustomerTransaction[]>([]);
  const [analytics, setAnalytics] = useState<CustomerAnalytics | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "transactions" | "history">("overview");

  useEffect(() => {
    loadCustomerData();
  }, [customerAddress]);

  const loadCustomerData = async () => {
    setLoading(true);
    try {
      // Fetch customer details, balance, transactions, and analytics in parallel
      const [detailsRes, balanceRes, transactionsRes, analyticsRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/customers/${customerAddress}`, {
          credentials: "include",
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/tokens/balance/${customerAddress}`, {
          credentials: "include",
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/customers/${customerAddress}/transactions?limit=10`, {
          credentials: "include",
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/customers/${customerAddress}/analytics`, {
          credentials: "include",
        }),
      ]);

      if (!detailsRes.ok) throw new Error("Failed to load customer details");

      const detailsData = await detailsRes.json();
      const balanceData = balanceRes.ok ? await balanceRes.json() : { data: null };
      const transactionsData = transactionsRes.ok ? await transactionsRes.json() : { data: { transactions: [] } };
      const analyticsData = analyticsRes.ok ? await analyticsRes.json() : { data: null };

      // API returns { data: { customer, tierBenefits, ... } }, extract customer object
      const customerData = detailsData.data?.customer || detailsData.data;

      // Use accurate balance from /tokens/balance endpoint
      if (balanceData.data) {
        customerData.currentBalance = balanceData.data.availableBalance;
        customerData.lifetimeEarnings = balanceData.data.lifetimeEarned;
        customerData.totalRedemptions = balanceData.data.totalRedeemed;
      }

      setCustomerDetails(customerData);
      // Transactions API returns { data: { transactions: [...], count, customer } }
      const txArray = transactionsData.data?.transactions || transactionsData.data || [];
      setTransactions(Array.isArray(txArray) ? txArray : []);
      setAnalytics(analyticsData.data);
    } catch (error) {
      console.error("Error loading customer data:", error);
      toast.error("Failed to load customer details");
    } finally {
      setLoading(false);
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "GOLD":
        return "text-yellow-400 bg-yellow-400/10 border-yellow-400/20";
      case "SILVER":
        return "text-gray-300 bg-gray-300/10 border-gray-300/20";
      default:
        return "text-orange-400 bg-orange-400/10 border-orange-400/20";
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case "GOLD":
        return "👑";
      case "SILVER":
        return "⭐";
      default:
        return "🥉";
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(customerAddress);
    toast.success("Address copied!");
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-[#1A1A1A] rounded-2xl border border-gray-800 p-12 max-w-md w-full">
          <div className="flex flex-col items-center">
            <Loader2 className="w-12 h-12 text-[#FFCC00] animate-spin mb-4" />
            <p className="text-white text-lg">Loading customer details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!customerDetails) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-[#1A1A1A] rounded-2xl border border-gray-800 p-8 max-w-md w-full">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mb-4">
              <X className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Customer Not Found</h3>
            <p className="text-gray-400 text-center mb-6">
              Unable to load details for this customer
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-[#FFCC00] text-black rounded-lg font-semibold hover:bg-[#FFD700] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-[#1A1A1A] rounded-2xl border border-gray-800 w-full max-w-4xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl overflow-hidden">
              {customerDetails.profile_image_url ? (
                <img
                  src={customerDetails.profile_image_url}
                  alt={customerDetails.name || "Customer"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#FFCC00] to-[#FFD700] flex items-center justify-center">
                  {getTierIcon(customerDetails.tier)}
                </div>
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">
                {customerDetails.name || "Anonymous Customer"}
              </h2>
              <button
                onClick={copyAddress}
                className="text-gray-400 hover:text-[#FFCC00] text-sm flex items-center gap-1 transition-colors"
              >
                <Wallet className="w-3 h-3" />
                {formatAddress(customerAddress)}
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 border-b border-gray-800">
          <div className="bg-[#0A0A0A] rounded-xl p-4 border border-gray-800">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-4 h-4 text-[#FFCC00]" />
              <span className="text-gray-400 text-sm">Tier</span>
            </div>
            <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border text-sm font-semibold ${getTierColor(customerDetails.tier)}`}>
              {getTierIcon(customerDetails.tier)} {customerDetails.tier}
            </div>
          </div>

          <div className="bg-[#0A0A0A] rounded-xl p-4 border border-gray-800">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-4 h-4 text-[#FFCC00]" />
              <span className="text-gray-400 text-sm">Balance</span>
            </div>
            <p className="text-2xl font-bold text-white">{(customerDetails.currentBalance ?? 0).toFixed(2)} RCN</p>
          </div>

          <div className="bg-[#0A0A0A] rounded-xl p-4 border border-gray-800">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className="text-gray-400 text-sm">Lifetime Earned</span>
            </div>
            <p className="text-2xl font-bold text-green-400">{(customerDetails.lifetimeEarnings ?? 0).toFixed(2)} RCN</p>
          </div>

          <div className="bg-[#0A0A0A] rounded-xl p-4 border border-gray-800">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-blue-500 rotate-180" />
              <span className="text-gray-400 text-sm">Redeemed</span>
            </div>
            <p className="text-2xl font-bold text-blue-400">{(customerDetails.totalRedemptions ?? 0).toFixed(2)} RCN</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-800 px-6">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab("overview")}
              className={`pb-3 font-semibold transition-colors relative ${
                activeTab === "overview" ? "text-[#FFCC00]" : "text-gray-400 hover:text-gray-300"
              }`}
            >
              Overview
              {activeTab === "overview" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FFCC00]" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("transactions")}
              className={`pb-3 font-semibold transition-colors relative ${
                activeTab === "transactions" ? "text-[#FFCC00]" : "text-gray-400 hover:text-gray-300"
              }`}
            >
              Recent Transactions ({transactions.length})
              {activeTab === "transactions" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FFCC00]" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`pb-3 font-semibold transition-colors relative ${
                activeTab === "history" ? "text-[#FFCC00]" : "text-gray-400 hover:text-gray-300"
              }`}
            >
              History
              {activeTab === "history" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FFCC00]" />
              )}
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6 max-h-[500px] overflow-y-auto">
          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-[#0A0A0A] rounded-xl p-4 border border-gray-800">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4 text-[#FFCC00]" />
                    <span className="text-gray-400 text-sm font-semibold">Last Transaction</span>
                  </div>
                  <p className="text-white">{formatDate(customerDetails.lastTransaction)}</p>
                </div>

                <div className="bg-[#0A0A0A] rounded-xl p-4 border border-gray-800">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4 text-[#FFCC00]" />
                    <span className="text-gray-400 text-sm font-semibold">Member Since</span>
                  </div>
                  <p className="text-white">{formatDate(customerDetails.joinDate)}</p>
                </div>

                {customerDetails.email && (
                  <div className="bg-[#0A0A0A] rounded-xl p-4 border border-gray-800">
                    <div className="flex items-center gap-2 mb-3">
                      <Mail className="w-4 h-4 text-[#FFCC00]" />
                      <span className="text-gray-400 text-sm font-semibold">Email</span>
                    </div>
                    <p className="text-white">{customerDetails.email}</p>
                  </div>
                )}

                <div className="bg-[#0A0A0A] rounded-xl p-4 border border-gray-800">
                  <div className="flex items-center gap-2 mb-3">
                    <MapPin className="w-4 h-4 text-[#FFCC00]" />
                    <span className="text-gray-400 text-sm font-semibold">Status</span>
                  </div>
                  <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold ${
                    customerDetails.isActive && !customerDetails.suspended
                      ? "bg-green-900/20 text-green-400 border border-green-700"
                      : "bg-red-900/20 text-red-400 border border-red-700"
                  }`}>
                    {customerDetails.isActive && !customerDetails.suspended ? "✓ Active" : "⚠ Inactive"}
                  </span>
                </div>
              </div>

              {analytics && (
                <div className="bg-[#0A0A0A] rounded-xl p-6 border border-gray-800">
                  <h3 className="text-lg font-semibold text-white mb-4">Analytics Summary</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Total Transactions</p>
                      <p className="text-2xl font-bold text-white">{analytics.transactionCount ?? analytics.totalTransactions ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Referrals</p>
                      <p className="text-2xl font-bold text-white">{analytics.successfulReferrals ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Total Earned</p>
                      <p className="text-2xl font-bold text-green-400">{(analytics.totalEarned ?? analytics.totalEarnings ?? 0).toFixed(1)} RCN</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Total Redeemed</p>
                      <p className="text-2xl font-bold text-blue-400">{(analytics.totalSpent ?? analytics.totalRedemptions ?? 0).toFixed(1)} RCN</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Transactions Tab */}
          {activeTab === "transactions" && (
            <div className="space-y-3">
              {transactions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <TrendingUp className="w-8 h-8 text-gray-600" />
                  </div>
                  <h3 className="text-white text-lg font-medium mb-2">No Transactions Yet</h3>
                  <p className="text-gray-400 text-sm">
                    This customer hasn't made any transactions yet.
                  </p>
                </div>
              ) : (
                transactions.map((tx) => {
                  // Handle both "earn"/"earned" naming conventions
                  const isEarning = tx.type === "earn" || tx.type === "earned" || tx.type === "gift_received" || tx.type === "referral" || tx.type === "tier_bonus";
                  const txDate = tx.timestamp || tx.createdAt;

                  return (
                    <div
                      key={tx.id}
                      className="bg-[#0A0A0A] rounded-xl p-4 border border-gray-800 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          isEarning ? "bg-green-900/20" : "bg-blue-900/20"
                        }`}>
                          {isEarning ? (
                            <ArrowDownRight className="w-5 h-5 text-green-400" />
                          ) : (
                            <ArrowUpRight className="w-5 h-5 text-blue-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-white font-semibold capitalize">{tx.type.replace("_", " ")}</p>
                          <p className="text-gray-400 text-sm">{tx.shopName || tx.shopId || "RepairCoin"}</p>
                          <p className="text-gray-500 text-xs">{formatDate(txDate)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-bold ${isEarning ? "text-green-400" : "text-blue-400"}`}>
                          {isEarning ? "+" : "-"}{(tx.amount || 0).toFixed(2)} RCN
                        </p>
                        {tx.status && (
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            tx.status === "confirmed" || tx.status === "completed"
                              ? "bg-green-900/20 text-green-400"
                              : "bg-yellow-900/20 text-yellow-400"
                          }`}>
                            {tx.status}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* History Tab - Uses loaded transactions data */}
          {activeTab === "history" && (
            <div className="space-y-6">
              {transactions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Clock className="w-8 h-8 text-gray-600" />
                  </div>
                  <h3 className="text-white text-lg font-medium mb-2">No History Yet</h3>
                  <p className="text-gray-400 text-sm">
                    Transaction history will appear here once the customer has activity.
                  </p>
                </div>
              ) : (
                <>
                  {/* Earnings History */}
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                      <ArrowDownRight className="w-5 h-5 text-green-400" />
                      Earnings History
                    </h3>
                    {(() => {
                      const earnings = transactions.filter(tx =>
                        tx.type === "earn" || tx.type === "earned" || tx.type === "gift_received" ||
                        tx.type === "referral" || tx.type === "tier_bonus"
                      );
                      if (earnings.length === 0) {
                        return (
                          <div className="text-center py-6 bg-[#0A0A0A] rounded-xl border border-gray-800">
                            <p className="text-gray-400">No earnings recorded</p>
                          </div>
                        );
                      }
                      return (
                        <div className="space-y-2">
                          {earnings.map((tx) => (
                            <div
                              key={tx.id}
                              className="bg-[#0A0A0A] rounded-xl p-3 border border-gray-800 flex items-center justify-between"
                            >
                              <div>
                                <p className="text-white text-sm font-medium capitalize">{tx.type.replace("_", " ")}</p>
                                <p className="text-gray-500 text-xs">{tx.shopName || tx.shopId || "RepairCoin"}</p>
                                <p className="text-gray-600 text-xs">{formatDate(tx.timestamp || tx.createdAt)}</p>
                              </div>
                              <span className="text-lg font-bold text-green-400">+{(tx.amount || 0).toFixed(2)} RCN</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Redemptions History */}
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                      <ArrowUpRight className="w-5 h-5 text-blue-400" />
                      Redemptions History
                    </h3>
                    {(() => {
                      const redemptions = transactions.filter(tx =>
                        tx.type === "redeem" || tx.type === "redeemed" || tx.type === "gift_sent"
                      );
                      if (redemptions.length === 0) {
                        return (
                          <div className="text-center py-6 bg-[#0A0A0A] rounded-xl border border-gray-800">
                            <p className="text-gray-400">No redemptions recorded</p>
                          </div>
                        );
                      }
                      return (
                        <div className="space-y-2">
                          {redemptions.map((tx) => (
                            <div
                              key={tx.id}
                              className="bg-[#0A0A0A] rounded-xl p-3 border border-gray-800 flex items-center justify-between"
                            >
                              <div>
                                <p className="text-white text-sm font-medium capitalize">{tx.type.replace("_", " ")}</p>
                                <p className="text-gray-500 text-xs">{tx.shopName || tx.shopId || "Unknown Shop"}</p>
                                <p className="text-gray-600 text-xs">{formatDate(tx.timestamp || tx.createdAt)}</p>
                              </div>
                              <span className="text-lg font-bold text-blue-400">-{(tx.amount || 0).toFixed(2)} RCN</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-800">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-800 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
