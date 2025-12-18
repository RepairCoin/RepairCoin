"use client";

import React from "react";
import { Copy, ExternalLink, User } from "lucide-react";

interface CustomerSearchResult {
  address: string;
  name?: string;
  tier: "BRONZE" | "SILVER" | "GOLD";
  lifetime_earnings: number;
  last_transaction_date?: string;
  total_transactions: number;
  isActive: boolean;
  suspended?: boolean;
}

interface CustomerCardProps {
  customer: CustomerSearchResult;
  onViewProfile: (address: string) => void;
  onCopyAddress: (address: string) => void;
}

// Helper function to get relative time
const getRelativeTime = (dateString: string | undefined): string => {
  if (!dateString) return "No activity";

  const now = new Date();
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  }
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  }
  if (diffInSeconds < 172800) return "Yesterday";
  if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} day${days > 1 ? "s" : ""} ago`;
  }

  // Format as "Dec 15, 2024"
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

// Helper function to truncate wallet address
const truncateAddress = (address: string): string => {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

// Helper function to get tier badge styles
const getTierBadgeStyles = (tier: "BRONZE" | "SILVER" | "GOLD") => {
  switch (tier) {
    case "GOLD":
      return "bg-[#F7B500] text-black";
    case "SILVER":
      return "bg-[#6B7280] text-white";
    case "BRONZE":
      return "bg-[#CD7F32] text-white";
    default:
      return "bg-gray-500 text-white";
  }
};

export default function CustomerCard({
  customer,
  onViewProfile,
  onCopyAddress,
}: CustomerCardProps) {
  const isActive = customer.isActive && !customer.suspended;
  const customerName = customer.name || "Anonymous Customer";
  const customerInitial = customer.name ? customer.name.charAt(0).toUpperCase() : "?";
  const redemptionValue = (customer.lifetime_earnings * 0.1).toFixed(2);

  const handleCopyAddress = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCopyAddress(customer.address);
  };

  const handleViewProfile = (e: React.MouseEvent) => {
    e.stopPropagation();
    onViewProfile(customer.address);
  };

  return (
    <div className="bg-[#2a2a2a] border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-all duration-200 hover:shadow-lg">
      <div className="flex items-start justify-between gap-4">
        {/* Left side - Customer info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3">
            {/* Avatar */}
            <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
              {customerInitial}
            </div>

            {/* Customer details */}
            <div className="flex-1 min-w-0">
              {/* Name and badges row */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <h3 className="font-bold text-white text-lg truncate">
                  {customerName}
                </h3>

                {/* Tier badge */}
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getTierBadgeStyles(
                    customer.tier
                  )}`}
                >
                  {customer.tier}
                </span>

                {/* Status badge */}
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    isActive
                      ? "bg-[#22C55E] text-white"
                      : "bg-red-500 text-white"
                  }`}
                >
                  {isActive ? "Active" : "Suspended"}
                </span>
              </div>

              {/* Last activity */}
              <p className="text-gray-400 text-sm mb-2">
                Last Activity: {getRelativeTime(customer.last_transaction_date)}
              </p>

              {/* Wallet address with copy button */}
              <div className="flex items-center gap-2 mb-2">
                <code className="text-gray-300 text-sm font-mono bg-black/30 px-2 py-1 rounded">
                  {truncateAddress(customer.address)}
                </code>
                <button
                  onClick={handleCopyAddress}
                  className="p-1 hover:bg-gray-700 rounded transition-colors"
                  title="Copy address"
                >
                  <Copy className="w-4 h-4 text-gray-400 hover:text-white" />
                </button>
              </div>

              {/* View profile link */}
              <button
                onClick={handleViewProfile}
                className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
              >
                View Profile
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right side - Metrics */}
        <div className="flex-shrink-0 text-right">
          <div className="mb-3">
            <p className="text-gray-400 text-xs mb-1">Lifetime RCN</p>
            <p className="text-white font-bold text-xl">
              {customer.lifetime_earnings.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-gray-400 text-xs mb-1">Redemption Value</p>
            <p className="text-green-400 font-semibold text-lg">
              ${redemptionValue}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
