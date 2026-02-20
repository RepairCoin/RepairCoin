"use client";

import React, { useState, useEffect } from "react";
import {
  Wallet,
  DollarSign,
  TrendingUp,
  Calendar,
  Download,
  AlertCircle,
  CheckCircle,
  Copy,
  ExternalLink,
  CreditCard,
  Building2,
  Plus,
  Edit,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAuthStore } from "@/stores/authStore";

interface PayoutMethod {
  id: string;
  type: "bank_account" | "crypto_wallet";
  label: string;
  details: string;
  isDefault: boolean;
}

interface PayoutHistory {
  id: string;
  amount: number;
  currency: string;
  status: "pending" | "processing" | "completed" | "failed";
  method: string;
  createdAt: string;
  completedAt?: string;
}

interface WalletStats {
  availableBalance: number;
  pendingBalance: number;
  totalEarnings: number;
  lastPayoutDate?: string;
  lastPayoutAmount?: number;
}

export const WalletPayoutsTab: React.FC = () => {
  const { walletAddress } = useAuthStore();
  const [activeSection, setActiveSection] = useState<"overview" | "methods" | "history">("overview");
  const [loading, setLoading] = useState(true);
  const [showAddMethod, setShowAddMethod] = useState(false);

  // Mock data - replace with actual API calls
  const [walletStats] = useState<WalletStats>({
    availableBalance: 1250.50,
    pendingBalance: 342.75,
    totalEarnings: 15892.30,
    lastPayoutDate: "2026-02-15T10:30:00Z",
    lastPayoutAmount: 1500.00,
  });

  const [payoutMethods] = useState<PayoutMethod[]>([
    {
      id: "1",
      type: "bank_account",
      label: "Chase Bank ****1234",
      details: "Checking account ending in 1234",
      isDefault: true,
    },
    {
      id: "2",
      type: "crypto_wallet",
      label: "ETH Wallet",
      details: "0x742d...9A3c",
      isDefault: false,
    },
  ]);

  const [payoutHistory] = useState<PayoutHistory[]>([
    {
      id: "1",
      amount: 1500.00,
      currency: "USD",
      status: "completed",
      method: "Chase Bank ****1234",
      createdAt: "2026-02-15T10:30:00Z",
      completedAt: "2026-02-16T14:20:00Z",
    },
    {
      id: "2",
      amount: 2100.50,
      currency: "USD",
      status: "completed",
      method: "Chase Bank ****1234",
      createdAt: "2026-02-01T09:15:00Z",
      completedAt: "2026-02-02T11:45:00Z",
    },
    {
      id: "3",
      amount: 850.00,
      currency: "USD",
      status: "processing",
      method: "ETH Wallet",
      createdAt: "2026-02-19T16:00:00Z",
    },
  ]);

  useEffect(() => {
    // Simulate loading
    setTimeout(() => setLoading(false), 500);
  }, []);

  const copyWalletAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      toast.success("Wallet address copied to clipboard");
    }
  };

  const getStatusColor = (status: PayoutHistory["status"]) => {
    switch (status) {
      case "completed":
        return "text-green-400 bg-green-400/10 border-green-400/20";
      case "processing":
        return "text-blue-400 bg-blue-400/10 border-blue-400/20";
      case "pending":
        return "text-yellow-400 bg-yellow-400/10 border-yellow-400/20";
      case "failed":
        return "text-red-400 bg-red-400/10 border-red-400/20";
      default:
        return "text-gray-400 bg-gray-400/10 border-gray-400/20";
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Wallet & Payouts</h2>
        <p className="text-gray-400 mt-1">Manage your wallet and payout settings</p>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-2 border-b border-gray-700">
        <button
          onClick={() => setActiveSection("overview")}
          className={`px-4 py-3 font-medium transition-colors border-b-2 ${
            activeSection === "overview"
              ? "text-yellow-500 border-yellow-500"
              : "text-gray-400 border-transparent hover:text-white"
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveSection("methods")}
          className={`px-4 py-3 font-medium transition-colors border-b-2 ${
            activeSection === "methods"
              ? "text-yellow-500 border-yellow-500"
              : "text-gray-400 border-transparent hover:text-white"
          }`}
        >
          Payout Methods
        </button>
        <button
          onClick={() => setActiveSection("history")}
          className={`px-4 py-3 font-medium transition-colors border-b-2 ${
            activeSection === "history"
              ? "text-yellow-500 border-yellow-500"
              : "text-gray-400 border-transparent hover:text-white"
          }`}
        >
          History
        </button>
      </div>

      {/* Overview Section */}
      {activeSection === "overview" && (
        <div className="space-y-6">
          {/* Wallet Info Card */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border border-gray-700/50">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">Connected Wallet</h3>
                <p className="text-gray-400 text-sm">Your primary wallet for receiving payments</p>
              </div>
              <Wallet className="w-8 h-8 text-yellow-500" />
            </div>
            <div className="bg-gray-900/50 rounded-lg p-4 flex items-center justify-between">
              <code className="text-white font-mono text-sm">{walletAddress || "Not connected"}</code>
              <button
                onClick={copyWalletAddress}
                className="p-2 text-gray-400 hover:text-yellow-500 hover:bg-yellow-500/10 rounded-lg transition-colors"
                title="Copy address"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Available Balance */}
            <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 rounded-xl p-6 border border-green-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-green-400 text-sm font-medium">Available Balance</span>
                <DollarSign className="w-5 h-5 text-green-400" />
              </div>
              <div className="text-3xl font-bold text-white">{formatCurrency(walletStats.availableBalance)}</div>
              <p className="text-gray-400 text-sm mt-1">Ready for payout</p>
            </div>

            {/* Pending Balance */}
            <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 rounded-xl p-6 border border-yellow-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-yellow-400 text-sm font-medium">Pending Balance</span>
                <Calendar className="w-5 h-5 text-yellow-400" />
              </div>
              <div className="text-3xl font-bold text-white">{formatCurrency(walletStats.pendingBalance)}</div>
              <p className="text-gray-400 text-sm mt-1">Processing transactions</p>
            </div>

            {/* Total Earnings */}
            <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 rounded-xl p-6 border border-blue-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-blue-400 text-sm font-medium">Total Earnings</span>
                <TrendingUp className="w-5 h-5 text-blue-400" />
              </div>
              <div className="text-3xl font-bold text-white">{formatCurrency(walletStats.totalEarnings)}</div>
              <p className="text-gray-400 text-sm mt-1">All-time revenue</p>
            </div>
          </div>

          {/* Last Payout Info */}
          {walletStats.lastPayoutDate && (
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <h3 className="text-white font-semibold">Last Payout</h3>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-white">{formatCurrency(walletStats.lastPayoutAmount || 0)}</p>
                  <p className="text-gray-400 text-sm mt-1">{formatDate(walletStats.lastPayoutDate)}</p>
                </div>
                <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm font-medium flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Download Receipt
                </button>
              </div>
            </div>
          )}

          {/* Request Payout Button */}
          <button className="w-full px-6 py-4 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2 text-lg">
            <Download className="w-5 h-5" />
            Request Payout
          </button>

          {/* Info Box */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-300">
                <p className="font-medium mb-1">Payout Schedule</p>
                <p className="text-blue-400">
                  Payouts are processed within 2-5 business days. Available balance must be at least $50 to request a payout.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payout Methods Section */}
      {activeSection === "methods" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-white">Payout Methods</h3>
              <p className="text-gray-400 text-sm mt-1">Add and manage your payout methods</p>
            </div>
            <button
              onClick={() => setShowAddMethod(true)}
              className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg hover:from-yellow-600 hover:to-orange-600 transition-all flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Method
            </button>
          </div>

          {/* Methods List */}
          <div className="space-y-4">
            {payoutMethods.map((method) => (
              <div
                key={method.id}
                className={`bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-6 border-2 transition-all ${
                  method.isDefault
                    ? "border-yellow-500 shadow-lg shadow-yellow-500/20"
                    : "border-gray-700/50 hover:border-gray-600"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-lg flex items-center justify-center text-white flex-shrink-0">
                      {method.type === "bank_account" ? (
                        <Building2 className="w-6 h-6" />
                      ) : (
                        <Wallet className="w-6 h-6" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-white font-semibold">{method.label}</h4>
                        {method.isDefault && (
                          <span className="px-2 py-1 bg-yellow-500/20 text-yellow-500 text-xs font-medium rounded border border-yellow-500/30">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-gray-400 text-sm mt-1">{method.details}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!method.isDefault && (
                      <>
                        <button className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {!method.isDefault && (
                  <button className="w-full mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm font-medium">
                    Set as Default
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payout History Section */}
      {activeSection === "history" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-white">Payout History</h3>
              <p className="text-gray-400 text-sm mt-1">View all your payout transactions</p>
            </div>
            <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>

          {/* History Table */}
          <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-900/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Method
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                  {payoutHistory.map((payout) => (
                    <tr key={payout.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-white font-medium">{formatDate(payout.createdAt)}</div>
                        {payout.completedAt && (
                          <div className="text-gray-400 text-xs mt-1">
                            Completed: {formatDate(payout.completedAt)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-white font-semibold">{formatCurrency(payout.amount)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-gray-300">{payout.method}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium border capitalize ${getStatusColor(
                            payout.status
                          )}`}
                        >
                          {payout.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button className="text-yellow-500 hover:text-yellow-400 text-sm font-medium flex items-center gap-1 ml-auto">
                          View Details
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {payoutHistory.length === 0 && (
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No payout history</h3>
              <p className="text-gray-400">Your payout transactions will appear here</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
