"use client";

import React from "react";
import {
  Wallet,
  Phone,
  Mail,
  Copy,
  MessageSquare,
  User,
} from "lucide-react";
import toast from "react-hot-toast";

interface CustomerInfoCardProps {
  customer: {
    address: string;
    name?: string;
    email?: string;
    phone?: string;
    profile_image_url?: string;
    tier: "BRONZE" | "SILVER" | "GOLD";
    isActive: boolean;
    suspended?: boolean;
    currentBalance: number;
    lifetimeEarnings: number;
    totalRedemptions: number;
  };
  bookingsCount: number;
  activeBookingsCount: number;
}

const TierBadge: React.FC<{ tier: "BRONZE" | "SILVER" | "GOLD" }> = ({ tier }) => {
  const styles = {
    GOLD: "bg-[#FFCC00] text-[#101010]",
    SILVER: "bg-[#E8E8E8] text-[#101010]",
    BRONZE: "bg-[#CE8946] text-[#101010]",
  };
  return (
    <span className={`inline-flex items-center justify-center px-3 py-0.5 rounded-[10px] text-xs font-semibold ${styles[tier]}`}>
      {tier}
    </span>
  );
};

export const CustomerInfoCard: React.FC<CustomerInfoCardProps> = ({
  customer,
  bookingsCount,
  activeBookingsCount,
}) => {
  const formatAddress = (address: string) =>
    `${address.slice(0, 6)}...${address.slice(-4)}`;

  const copyAddress = () => {
    navigator.clipboard.writeText(customer.address);
    toast.success("Address copied!");
  };

  const isActive = customer.isActive && !customer.suspended;

  const stats = [
    { label: "RCN Balance", value: `${(customer.currentBalance ?? 0).toFixed(1)}` },
    { label: "Lifetime Earned", value: `${(customer.lifetimeEarnings ?? 0).toFixed(1)}` },
    { label: "Redeemable", value: `$${((customer.currentBalance ?? 0) * 0.1).toFixed(2)}` },
    { label: "Total Services", value: `${bookingsCount}` },
    { label: "Active Bookings", value: `${activeBookingsCount}` },
  ];

  return (
    <div className="bg-[#101010] rounded-[20px] p-6 border border-[#303236]">
      {/* Top Section: Avatar + Info */}
      <div className="flex items-start gap-4 mb-6">
        {/* Avatar */}
        <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0 bg-gray-700">
          {customer.profile_image_url ? (
            <img
              src={customer.profile_image_url}
              alt={customer.name || "Customer"}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#FFCC00] to-[#FFD700] flex items-center justify-center">
              <User className="w-8 h-8 text-[#101010]" />
            </div>
          )}
        </div>

        {/* Name, badges, send SMS */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h2 className="text-xl font-bold text-white truncate">
              {customer.name || customer.email || "Anonymous Customer"}
            </h2>
            <TierBadge tier={customer.tier} />
            <span
              className={`px-2.5 py-0.5 rounded text-xs font-semibold ${
                isActive
                  ? "bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/30"
                  : "bg-red-500/20 text-red-400 border border-red-500/30"
              }`}
            >
              {isActive ? "Active" : "Inactive"}
            </span>
          </div>

          {/* Wallet */}
          <button
            onClick={copyAddress}
            className="flex items-center gap-1.5 text-gray-400 hover:text-[#FFCC00] text-sm transition-colors mb-2"
          >
            <Wallet className="w-3.5 h-3.5" />
            <span className="font-mono">{formatAddress(customer.address)}</span>
            <Copy className="w-3 h-3" />
          </button>

          {/* Contact Info */}
          <div className="flex items-center gap-4 text-sm text-gray-400">
            {customer.phone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" />
                {customer.phone}
              </span>
            )}
            {customer.email && (
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" />
                {customer.email}
              </span>
            )}
          </div>
        </div>

        {/* Send SMS Button */}
        <button className="px-4 py-2 bg-[#1a1a1a] border border-gray-700 rounded-lg text-white text-sm font-medium hover:bg-[#2a2a2a] transition-colors flex items-center gap-2 flex-shrink-0">
          <MessageSquare className="w-4 h-4" />
          Send SMS
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-[#0A0A0A] rounded-xl p-3 border border-[#303236]"
          >
            <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
            <p className="text-lg font-bold text-white">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
