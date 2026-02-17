"use client";

import React, { useState } from "react";
import {
  ClipboardCheck,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Trophy,
  StickyNote,
  Coins,
} from "lucide-react";

// --- Types ---

interface BookingOrder {
  orderId: string;
  serviceName: string;
  serviceDescription?: string;
  serviceCategory?: string;
  status: string;
  totalPrice: number;
  rcnDiscount: number;
  finalPrice: number;
  rcnEarned: number;
  paymentMethod?: string;
  bookingTimeSlot?: string;
  bookingEndTime?: string;
  createdAt: string;
  completedAt?: string;
  shopName?: string;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  shopId?: string;
  shopName?: string;
  createdAt: string;
  description?: string;
  transactionHash?: string;
  status?: string;
}

interface CustomerAnalytics {
  totalTransactions: number;
  totalEarnings: number;
  totalRedemptions: number;
  averageTransactionValue: number;
  monthlyActivity: {
    month: string;
    earnings: number;
    redemptions: number;
  }[];
}

interface CustomerProfileTabsProps {
  bookings: BookingOrder[];
  transactions: Transaction[];
  analytics: CustomerAnalytics | null;
  customerBalance: number;
  customerTier: "BRONZE" | "SILVER" | "GOLD";
  shopId: string;
  customerAddress: string;
  selectedBookingId: string | null;
  onSelectBooking: (orderId: string | null) => void;
}

// --- Helpers ---

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return "N/A";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatTime = (dateStr?: string): string => {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const styles: Record<string, string> = {
    pending: "bg-yellow-500/20 text-yellow-400",
    paid: "bg-blue-500/20 text-blue-400",
    completed: "bg-green-500/20 text-green-400",
    cancelled: "bg-red-500/20 text-red-400",
    refunded: "bg-gray-500/20 text-gray-400",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${styles[status] || styles.pending}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

// --- Tab Components ---

const BookingsTab: React.FC<{
  bookings: BookingOrder[];
  selectedBookingId: string | null;
  onSelectBooking: (orderId: string | null) => void;
}> = ({ bookings, selectedBookingId, onSelectBooking }) => {
  if (bookings.length === 0) {
    return (
      <div className="text-center py-12">
        <ClipboardCheck className="w-10 h-10 text-gray-600 mx-auto mb-3" />
        <p className="text-white font-medium mb-1">No Bookings</p>
        <p className="text-gray-500 text-sm">This customer has no bookings at your shop yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#303236]">
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Service</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Schedule</th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
            <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Cost</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking) => (
            <tr
              key={booking.orderId}
              onClick={() =>
                onSelectBooking(
                  selectedBookingId === booking.orderId ? null : booking.orderId
                )
              }
              className={`border-b border-[#303236]/50 cursor-pointer transition-colors ${
                selectedBookingId === booking.orderId
                  ? "bg-[#FFCC00]/5"
                  : "hover:bg-[#1a1a1a]"
              }`}
            >
              <td className="py-3 px-4">
                <p className="text-sm font-medium text-white">{booking.serviceName}</p>
                <p className="text-xs text-gray-500 font-mono">{booking.orderId.slice(0, 12)}...</p>
              </td>
              <td className="py-3 px-4">
                <p className="text-sm text-white">{formatDate(booking.bookingTimeSlot || booking.createdAt)}</p>
                {booking.bookingTimeSlot && (
                  <p className="text-xs text-gray-500">{formatTime(booking.bookingTimeSlot)}</p>
                )}
              </td>
              <td className="py-3 px-4">
                <StatusBadge status={booking.status} />
              </td>
              <td className="py-3 px-4 text-right">
                <p className="text-sm font-semibold text-white">${booking.totalPrice.toFixed(2)}</p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const TransactionsTab: React.FC<{ transactions: Transaction[] }> = ({ transactions }) => {
  const formatTxDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12">
        <TrendingUp className="w-10 h-10 text-gray-600 mx-auto mb-3" />
        <p className="text-white font-medium mb-1">No Transactions</p>
        <p className="text-gray-500 text-sm">No transaction history found for this customer.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {transactions.map((tx) => {
        const isEarn = tx.type === "earn" || tx.type === "gift_received" || tx.type === "mint";
        return (
          <div
            key={tx.id}
            className="flex items-center justify-between p-3 bg-[#0A0A0A] rounded-xl border border-[#303236]"
          >
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isEarn ? "bg-green-900/20" : "bg-blue-900/20"}`}>
                {isEarn ? (
                  <ArrowDownRight className="w-4 h-4 text-green-400" />
                ) : (
                  <ArrowUpRight className="w-4 h-4 text-blue-400" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-white capitalize">
                  {tx.type.replace("_", " ")}
                </p>
                <p className="text-xs text-gray-500">{tx.shopName || "Platform"}</p>
                <p className="text-xs text-gray-600">{formatTxDate(tx.createdAt)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-sm font-bold ${isEarn ? "text-green-400" : "text-blue-400"}`}>
                {isEarn ? "+" : "-"}{tx.amount.toFixed(2)} RCN
              </p>
              {tx.description && (
                <p className="text-[10px] text-gray-500 max-w-[120px] truncate">
                  {tx.description}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const RewardsTab: React.FC<{
  analytics: CustomerAnalytics | null;
  balance: number;
  tier: "BRONZE" | "SILVER" | "GOLD";
}> = ({ analytics, balance, tier }) => {
  const tierBonuses: Record<string, number> = {
    BRONZE: 0,
    SILVER: 2,
    GOLD: 5,
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#0A0A0A] rounded-xl p-4 border border-[#303236]">
          <p className="text-xs text-gray-500 mb-1">Total Earned</p>
          <p className="text-xl font-bold text-green-400">
            {(analytics?.totalEarnings ?? 0).toFixed(1)} RCN
          </p>
        </div>
        <div className="bg-[#0A0A0A] rounded-xl p-4 border border-[#303236]">
          <p className="text-xs text-gray-500 mb-1">Total Redeemed</p>
          <p className="text-xl font-bold text-blue-400">
            {(analytics?.totalRedemptions ?? 0).toFixed(1)} RCN
          </p>
        </div>
        <div className="bg-[#0A0A0A] rounded-xl p-4 border border-[#303236]">
          <p className="text-xs text-gray-500 mb-1">Redeemable Balance</p>
          <p className="text-xl font-bold text-white">{balance.toFixed(1)} RCN</p>
        </div>
        <div className="bg-[#0A0A0A] rounded-xl p-4 border border-[#303236]">
          <p className="text-xs text-gray-500 mb-1">Avg per Transaction</p>
          <p className="text-xl font-bold text-white">
            {(analytics?.averageTransactionValue ?? 0).toFixed(1)} RCN
          </p>
        </div>
      </div>

      {/* Tier Info */}
      <div className="bg-[#0A0A0A] rounded-xl p-4 border border-[#303236]">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-4 h-4 text-[#FFCC00]" />
          <span className="text-sm font-semibold text-white">Tier Breakdown</span>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div>
            <span className="text-gray-500">Current Tier:</span>{" "}
            <span className="text-white font-semibold">{tier}</span>
          </div>
          <div>
            <span className="text-gray-500">Bonus per Transaction:</span>{" "}
            <span className="text-[#FFCC00] font-semibold">+{tierBonuses[tier]} RCN</span>
          </div>
          <div>
            <span className="text-gray-500">Total Transactions:</span>{" "}
            <span className="text-white font-semibold">{analytics?.totalTransactions ?? 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const NotesTab: React.FC<{ shopId: string; customerAddress: string }> = ({
  shopId,
  customerAddress,
}) => {
  const storageKey = `${shopId}-${customerAddress}-notes`;
  const [notes, setNotes] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(storageKey) || "";
  });
  const [saved, setSaved] = useState(true);

  const handleSave = () => {
    localStorage.setItem(storageKey, notes);
    setSaved(true);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StickyNote className="w-4 h-4 text-[#FFCC00]" />
          <span className="text-sm font-semibold text-white">Shop Notes</span>
        </div>
        <button
          onClick={handleSave}
          disabled={saved}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            saved
              ? "bg-gray-800 text-gray-500 cursor-default"
              : "bg-[#FFCC00] text-[#101010] hover:bg-[#e6b800]"
          }`}
        >
          {saved ? "Saved" : "Save Notes"}
        </button>
      </div>
      <textarea
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          setSaved(false);
        }}
        placeholder="Add private notes about this customer..."
        className="w-full h-40 bg-[#0A0A0A] border border-[#303236] rounded-xl p-4 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#FFCC00] transition-colors resize-none"
      />
      <p className="text-xs text-gray-600">Notes are stored locally on this device.</p>
    </div>
  );
};

// --- Main Component ---

export const CustomerProfileTabs: React.FC<CustomerProfileTabsProps> = ({
  bookings,
  transactions,
  analytics,
  customerBalance,
  customerTier,
  shopId,
  customerAddress,
  selectedBookingId,
  onSelectBooking,
}) => {
  const [activeTab, setActiveTab] = useState<"bookings" | "transactions" | "rewards" | "notes">("bookings");

  const tabs = [
    { id: "bookings" as const, label: "Bookings", count: bookings.length },
    { id: "transactions" as const, label: "Transactions", count: transactions.length },
    { id: "rewards" as const, label: "Rewards" },
    { id: "notes" as const, label: "Notes" },
  ];

  return (
    <div className="bg-[#101010] rounded-[20px] border border-[#303236] overflow-hidden">
      {/* Tab Headers */}
      <div className="border-b border-[#303236] px-6">
        <div className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 text-sm font-semibold transition-colors relative ${
                activeTab === tab.id
                  ? "text-[#FFCC00]"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-1.5 text-xs text-gray-600">({tab.count})</span>
              )}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FFCC00]" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === "bookings" && (
          <BookingsTab
            bookings={bookings}
            selectedBookingId={selectedBookingId}
            onSelectBooking={onSelectBooking}
          />
        )}
        {activeTab === "transactions" && <TransactionsTab transactions={transactions} />}
        {activeTab === "rewards" && (
          <RewardsTab analytics={analytics} balance={customerBalance} tier={customerTier} />
        )}
        {activeTab === "notes" && (
          <NotesTab shopId={shopId} customerAddress={customerAddress} />
        )}
      </div>
    </div>
  );
};
