"use client";

import React, { useState, useEffect } from "react";
import {
  HomeIcon,
  Wallet,
  ShoppingCart,
  Activity,
  Banknote,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  BookOpenCheck,
  CreditCard,
  Info,
  HelpCircle,
} from "lucide-react";
import { useRCGBalance } from "@/hooks/useRCGBalance";
import { formatRCGBalance } from "@/lib/utils";
import { ProfitChart } from "@/components/shop/ProfitChart";

interface ShopData {
  shopId: string;
  name: string;
  active: boolean;
  verified: boolean;
  crossShopEnabled: boolean;
  totalTokensIssued: number;
  totalRedemptions: number;
  purchasedRcnBalance: number;
  totalRcnPurchased: number;
  lastPurchaseDate?: string;
  walletAddress?: string;
  operational_status?:
    | "pending"
    | "rcg_qualified"
    | "subscription_qualified"
    | "not_qualified";
  rcg_tier?: string;
  rcg_balance?: number;
}

interface PurchaseHistory {
  id: string | number;
  amount: number;
  totalCost?: number;
  paymentMethod: string;
  paymentReference?: string;
  status: string;
  createdAt: string;
}

interface OverviewTabProps {
  shopData: ShopData | null;
  purchases: PurchaseHistory[];
  onRefreshData?: () => void;
  authToken?: string;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  shopData,
  purchases,
}) => {
  const { rcgInfo } = useRCGBalance(shopData?.shopId);

  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [filter, setFilter] = useState<
    "all" | "completed" | "pending" | "failed"
  >("all");

  // Filter purchases based on selected filter
  const filteredPurchases = purchases.filter((purchase) => {
    if (filter === "all") return true;
    return purchase.status === filter;
  });

  // Calculate running balances for purchases
  const purchasesWithBalance = React.useMemo(() => {
    if (!purchases || purchases.length === 0) return [];

    // Sort purchases by date (newest first)
    const sortedPurchases = [...filteredPurchases].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Start from current balance and work backwards
    let runningBalance = shopData?.purchasedRcnBalance || 0;

    const purchasesWithRunningBalance = sortedPurchases.map(
      (purchase, index) => {
        // For the first item (most recent), the running balance is current balance + amount
        // For subsequent items, we add the previous purchase amount
        if (
          index > 0 &&
          (sortedPurchases[index - 1].status === "completed" ||
            sortedPurchases[index - 1].status === "minted")
        ) {
          runningBalance += sortedPurchases[index - 1].amount;
        }

        // Include current purchase in balance if it's completed
        const balanceAfterPurchase =
          purchase.status === "completed" || purchase.status === "minted"
            ? runningBalance + purchase.amount
            : runningBalance;

        return {
          ...purchase,
          runningBalance: balanceAfterPurchase,
        };
      }
    );

    return purchasesWithRunningBalance;
  }, [purchases, filteredPurchases, shopData?.purchasedRcnBalance]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".filter-dropdown-container")) {
        setShowFilterDropdown(false);
      }
    };

    if (showFilterDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showFilterDropdown]);

  if (!shopData) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="space-y-6">
          {/* Loading skeleton for header */}
          <div className="animate-pulse">
            <div className="h-6 bg-gray-700 rounded w-6 mb-2"></div>
            <div className="h-4 bg-gray-700 rounded w-96 max-w-full"></div>
          </div>
          {/* Loading skeleton for stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-[#101010] rounded-[20px] p-5 animate-pulse h-[97px]">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-gray-700 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-3 bg-gray-700 rounded w-20 mb-2"></div>
                    <div className="h-6 bg-gray-700 rounded w-12"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Loading skeleton for chart */}
          <div className="bg-[#101010] rounded-[20px] p-6 animate-pulse">
            <div className="h-4 bg-gray-700 rounded w-32 mb-4"></div>
            <div className="h-64 bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="border-b border-[#303236] pb-4">
          <HomeIcon className="w-6 h-6 text-white mb-2" />
          <p className="text-sm text-[#ddd]">
            Monitor your shop&apos;s token activity, balances, and performance in real time.
          </p>
        </div>

        {/* Shop Statistics - New Design */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <OverviewStatCard
            title="Operational RCN"
            value={(Number(shopData.purchasedRcnBalance) || 0).toFixed(2)}
            icon={<Wallet className="w-6 h-6 text-[#101010]" />}
            tooltip="Your current available RCN balance that can be used to issue rewards to customers. This is your purchased RCN minus any tokens already issued."
          />
          <OverviewStatCard
            title="Total Purchased"
            value={(Number(shopData.totalRcnPurchased) || 0).toFixed(2)}
            icon={<ShoppingCart className="w-6 h-6 text-[#101010]" />}
            tooltip="The total amount of RCN tokens you have purchased since your shop was created. This includes all completed credit purchases."
          />
          <OverviewStatCard
            title="Tokens Issued"
            value={(shopData.totalTokensIssued || 0).toString()}
            icon={<Activity className="w-6 h-6 text-[#101010]" />}
            tooltip="The total number of RCN tokens you have issued as rewards to your customers. Each reward transaction is counted here."
          />
          <OverviewStatCard
            title="RCG Balance"
            value={formatRCGBalance(rcgInfo?.balance || 0)}
            icon={<Banknote className="w-6 h-6 text-[#101010]" />}
            tooltip="Your RepairCoin Governance (RCG) token balance. Higher RCG balances unlock better pricing tiers and additional platform benefits."
          />
        </div>

        {/* Profit Chart - Full Width - UNCHANGED */}
        <div className="w-full">
          <ProfitChart shopId={shopData.shopId} />
        </div>

        {/* Recent Credit Purchases - Full Width Table */}
        <RecentPurchasesTable
          purchases={purchasesWithBalance}
          filter={filter}
          showFilterDropdown={showFilterDropdown}
          setShowFilterDropdown={setShowFilterDropdown}
          setFilter={setFilter}
        />

        {/* Bottom Section: Shop Status */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Shop Status Card */}
          <ShopStatusCard shopData={shopData} />
        </div>
      </div>
    </div>
  );
};

// New Stat Card Component matching Figma design
const OverviewStatCard: React.FC<{
  title: string;
  value: string;
  icon: React.ReactNode;
  tooltip?: string;
}> = ({ title, value, icon, tooltip }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className={`bg-[#101010] rounded-[20px] p-4 sm:p-5 h-[97px] relative ${showTooltip ? 'z-50 overflow-visible' : 'overflow-hidden'}`}>
      <div className="flex items-start gap-3">
        {/* Icon with yellow gradient background */}
        <div className="relative flex-shrink-0">
          <div className="w-8 h-8 bg-gradient-to-br from-[#FFCC00] to-[#FFD633] rounded-full flex items-center justify-center shadow-lg shadow-yellow-500/20">
            {icon}
          </div>
        </div>
        {/* Text content */}
        <div className="flex flex-col min-w-0 flex-1">
          <p className="text-white text-sm font-medium leading-tight truncate">
            {title}
          </p>
          <p className="text-white text-xl sm:text-2xl font-bold mt-1 tracking-tight">
            {value}
          </p>
        </div>
      </div>
      {/* Help icon with tooltip */}
      <div className="absolute top-3 right-3">
        <button
          className="text-[#505050] hover:text-gray-400 transition-colors relative"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onClick={() => setShowTooltip(!showTooltip)}
        >
          <HelpCircle className="w-[18px] h-[18px]" />
        </button>
        {/* Tooltip */}
        {showTooltip && tooltip && (
          <div className="absolute right-0 top-6 z-[100] w-64 p-3 bg-[#2a2a2a] border border-[#404040] rounded-lg shadow-xl">
            <div className="absolute -top-1.5 right-2 w-3 h-3 bg-[#2a2a2a] border-l border-t border-[#404040] transform rotate-45"></div>
            <p className="text-sm text-gray-300 leading-relaxed">{tooltip}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// New Shop Status Card matching Figma design
const ShopStatusCard: React.FC<{ shopData: ShopData }> = ({ shopData }) => {
  const getOperationalStatusBadge = () => {
    if (
      shopData.operational_status === "rcg_qualified" ||
      shopData.operational_status === "subscription_qualified"
    ) {
      return {
        text:
          shopData.operational_status === "rcg_qualified"
            ? "RCG Qualified"
            : "Subscription Active",
        className: "bg-[#16a34a] text-white",
      };
    }
    if (shopData.operational_status === "pending") {
      return {
        text: "Pending",
        className: "bg-[#ca8a04] text-white",
      };
    }
    return {
      text: "Not Qualified",
      className: "bg-[#dc2626] text-white",
    };
  };

  const operationalBadge = getOperationalStatusBadge();

  return (
    <div className="bg-[#101010] rounded-[20px] p-6 h-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <BookOpenCheck className="w-6 h-6 text-[#FFCC00]" />
        <h3 className="text-[#FFCC00] text-base font-medium">Shop Status</h3>
      </div>

      {/* Status Rows */}
      <div className="space-y-0">
        <StatusRowNew
          label="Operational Status:"
          badge={{
            text: operationalBadge.text,
            className: operationalBadge.className,
            showIcon: shopData.operational_status !== "rcg_qualified" && shopData.operational_status !== "subscription_qualified",
          }}
        />
        <StatusRowNew
          label="Active Status:"
          badge={{
            text: shopData.active ? "Active" : "Inactive",
            className: shopData.active ? "bg-[#16a34a] text-white" : "bg-[#dc2626] text-white",
          }}
        />
        <StatusRowNew
          label="Verification:"
          badge={{
            text: shopData.verified ? "Verified" : "Pending",
            className: shopData.verified ? "bg-[#2563eb] text-white" : "bg-[#ca8a04] text-white",
          }}
        />
        <StatusRowNew
          label="Cross-Shop Redemption:"
          badge={{
            text: shopData.crossShopEnabled ? "Enabled" : "Disabled",
            className: shopData.crossShopEnabled
              ? "bg-[#16a34a] text-white"
              : "bg-[#979797] text-white",
            showIcon: !shopData.crossShopEnabled,
          }}
          isLast
        />
      </div>
    </div>
  );
};

// Status Row Component for Shop Status Card
const StatusRowNew: React.FC<{
  label: string;
  badge: {
    text: string;
    className: string;
    showIcon?: boolean;
  };
  isLast?: boolean;
}> = ({ label, badge, isLast = false }) => {
  return (
    <div
      className={`flex justify-between items-center py-3 ${
        !isLast ? "border-b border-[#303236]" : ""
      }`}
    >
      <span className="text-white text-sm font-medium">{label}</span>
      <span
        className={`px-3 py-1 rounded-full text-sm font-normal flex items-center gap-1 ${badge.className}`}
      >
        {badge.text}
        {badge.showIcon && <Info className="w-4 h-4" />}
      </span>
    </div>
  );
};

// Recent Purchases Table Component with full columns and pagination
interface RecentPurchasesTableProps {
  purchases: Array<PurchaseHistory & {
    runningBalance?: number;
  }>;
  filter: "all" | "completed" | "pending" | "failed";
  showFilterDropdown: boolean;
  setShowFilterDropdown: (show: boolean) => void;
  setFilter: (filter: "all" | "completed" | "pending" | "failed") => void;
}

const RecentPurchasesTable: React.FC<RecentPurchasesTableProps> = ({
  purchases,
  filter,
  showFilterDropdown,
  setShowFilterDropdown,
  setFilter,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Calculate pagination
  const totalPages = Math.ceil(purchases.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPurchases = purchases.slice(startIndex, endIndex);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
      case "minted":
        return { text: "completed", className: "text-green-400" };
      case "pending":
        return { text: "pending", className: "text-yellow-400" };
      case "cancelled":
        return { text: "cancelled", className: "text-red-400" };
      case "failed":
        return { text: "failed", className: "text-red-400" };
      default:
        return { text: status, className: "text-gray-400" };
    }
  };

  return (
    <div className="bg-[#101010] rounded-[20px] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <CreditCard className="w-6 h-6 text-[#FFCC00]" />
          <h3 className="text-[#FFCC00] text-lg font-medium">
            Recent Credit Purchases
          </h3>
        </div>

        {/* Filter Dropdown */}
        <div className="relative filter-dropdown-container">
          <button
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className="px-4 py-2 bg-white border border-[#dde2e4] rounded-lg transition-colors flex items-center gap-2 text-sm"
          >
            <span className="text-[#252c32] font-medium capitalize">
              {filter === "all" ? "All" : filter}
            </span>
            <ChevronDown
              className={`w-4 h-4 text-[#252c32] transition-transform ${
                showFilterDropdown ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Dropdown Menu */}
          {showFilterDropdown && (
            <div className="absolute right-0 mt-2 w-36 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
              {(["all", "completed", "pending", "failed"] as const).map(
                (filterOption) => (
                  <button
                    key={filterOption}
                    onClick={() => {
                      setFilter(filterOption);
                      setShowFilterDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                      filter === filterOption
                        ? "bg-yellow-50 text-yellow-600"
                        : "text-gray-700 hover:bg-gray-50"
                    } ${filterOption === "all" ? "rounded-t-lg" : ""} ${
                      filterOption === "failed" ? "rounded-b-lg" : ""
                    }`}
                  >
                    <span className="capitalize">{filterOption}</span>
                    {filter === filterOption && (
                      <span className="ml-2 text-yellow-500">✓</span>
                    )}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#303236]">
              <th className="text-left py-3 px-4 text-[#FFCC00] font-medium text-sm">DATE</th>
              <th className="text-left py-3 px-4 text-[#FFCC00] font-medium text-sm">CREDITS</th>
              <th className="text-left py-3 px-4 text-[#FFCC00] font-medium text-sm">COST</th>
              <th className="text-left py-3 px-4 text-[#FFCC00] font-medium text-sm">PAYMENT METHOD</th>
              <th className="text-left py-3 px-4 text-[#FFCC00] font-medium text-sm">STATUS</th>
              <th className="text-left py-3 px-4 text-[#FFCC00] font-medium text-sm">BALANCE</th>
            </tr>
          </thead>
          <tbody>
            {currentPurchases.length > 0 ? (
              currentPurchases.map((purchase) => {
                const statusBadge = getStatusBadge(purchase.status);
                const formattedDate = new Date(purchase.createdAt).toLocaleDateString("en-US", {
                  month: "2-digit",
                  day: "2-digit",
                  year: "numeric",
                });
                const formattedTime = new Date(purchase.createdAt).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: true,
                });

                return (
                  <tr key={purchase.id} className="border-b border-[#303236] hover:bg-[#1a1a1a]">
                    <td className="py-4 px-4">
                      <div className="text-white text-sm">{formattedDate}</div>
                      <div className="text-gray-500 text-xs">{formattedTime}</div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-[#FFCC00] font-medium">{purchase.amount}</span>
                      <span className="text-[#FFCC00] ml-1">RCN</span>
                    </td>
                    <td className="py-4 px-4 text-white">
                      ${purchase.totalCost?.toFixed(2) || "0.00"}
                    </td>
                    <td className="py-4 px-4 text-white uppercase text-sm">
                      {purchase.paymentMethod?.replace(/_/g, "_") || "N/A"}
                    </td>
                    <td className="py-4 px-4">
                      <span className={`${statusBadge.className} text-sm`}>
                        {statusBadge.text}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <span className="text-[#FFCC00] font-medium">
                        {purchase.runningBalance?.toLocaleString() || "0"}
                      </span>
                      <span className="text-[#FFCC00] ml-1">RCN</span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="py-12 text-center text-gray-500">
                  No purchases found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="p-2 rounded-lg border border-[#303236] text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                currentPage === page
                  ? "bg-[#FFCC00] text-[#101010]"
                  : "border border-[#303236] text-gray-400 hover:text-white hover:border-gray-500"
              }`}
            >
              {page}
            </button>
          ))}

          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="p-2 rounded-lg border border-[#303236] text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
