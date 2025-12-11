"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  HomeIcon,
  Wallet,
  ShoppingCart,
  Activity,
  Banknote,
  ChevronDown,
  BookOpenCheck,
  CreditCard,
  FileSearch,
  Info,
  HelpCircle,
} from "lucide-react";
import { useRCGBalance } from "@/hooks/useRCGBalance";
import { formatRCGBalance } from "@/lib/utils";
import { ProfitChart } from "@/components/shop/ProfitChart";
import { toast } from "react-hot-toast";

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
  onRefreshData,
  authToken,
}) => {
  const { rcgInfo } = useRCGBalance(shopData?.shopId);

  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [filter, setFilter] = useState<
    "all" | "completed" | "pending" | "failed"
  >("all");
  const [continuingPayment, setContinuingPayment] = useState<string | null>(null);
  const [cancellingPayment, setCancellingPayment] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState<string | null>(null);

  // Filter purchases based on selected filter
  const filteredPurchases = purchases.filter((purchase) => {
    if (filter === "all") return true;
    return purchase.status === filter;
  });

  // Handle continue payment
  const handleContinuePayment = useCallback(async (purchaseId: string) => {
    if (!authToken) {
      toast.error('Authentication required');
      return;
    }

    setContinuingPayment(purchaseId);
    setShowMenu(null);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/shops/purchase/${purchaseId}/continue`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Redirect to Stripe checkout
        window.location.href = result.data.paymentUrl;
      } else {
        toast.error(result.error || 'Failed to continue payment');
      }
    } catch (error) {
      console.error('Error continuing payment:', error);
      toast.error('Failed to continue payment');
    } finally {
      setContinuingPayment(null);
    }
  }, [authToken]);

  // Handle cancel payment
  const handleCancelPayment = useCallback(async (purchaseId: string) => {
    if (!authToken) {
      toast.error('Authentication required');
      return;
    }

    setCancellingPayment(purchaseId);
    setShowMenu(null);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/shops/purchase/${purchaseId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast.success('Purchase cancelled successfully');
        // Refresh the data to show updated status
        if (onRefreshData) {
          onRefreshData();
        }
      } else {
        toast.error(result.error || 'Failed to cancel payment');
      }
    } catch (error) {
      console.error('Error cancelling payment:', error);
      toast.error('Failed to cancel payment');
    } finally {
      setCancellingPayment(null);
    }
  }, [authToken, onRefreshData]);

  // Handle toggle menu
  const handleToggleMenu = useCallback((purchaseId: string) => {
    setShowMenu(showMenu === purchaseId ? null : purchaseId);
  }, [showMenu]);

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
          onContinuePayment: handleContinuePayment,
          onCancelPayment: handleCancelPayment,
          onToggleMenu: handleToggleMenu,
          continuingPayment: continuingPayment,
          cancellingPayment: cancellingPayment,
          showMenu: showMenu,
        };
      }
    );

    return purchasesWithRunningBalance;
  }, [purchases, filteredPurchases, shopData?.purchasedRcnBalance, handleContinuePayment, handleCancelPayment, handleToggleMenu, continuingPayment, cancellingPayment, showMenu]);

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

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".actions-menu-container") && showMenu) {
        setShowMenu(null);
      }
    };

    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showMenu]);

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

        {/* Bottom Section: Shop Status + Recent Credit Purchases */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Shop Status Card */}
          <div className="lg:col-span-5">
            <ShopStatusCard shopData={shopData} />
          </div>

          {/* Recent Credit Purchases */}
          <div className="lg:col-span-7">
            <RecentPurchasesCard
              purchases={purchasesWithBalance.slice(0, 3)}
              filter={filter}
              showFilterDropdown={showFilterDropdown}
              setShowFilterDropdown={setShowFilterDropdown}
              setFilter={setFilter}
            />
          </div>
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

// Recent Purchases Card Component
interface RecentPurchasesCardProps {
  purchases: Array<PurchaseHistory & { runningBalance?: number }>;
  filter: "all" | "completed" | "pending" | "failed";
  showFilterDropdown: boolean;
  setShowFilterDropdown: (show: boolean) => void;
  setFilter: (filter: "all" | "completed" | "pending" | "failed") => void;
}

const RecentPurchasesCard: React.FC<RecentPurchasesCardProps> = ({
  purchases,
  filter,
  showFilterDropdown,
  setShowFilterDropdown,
  setFilter,
}) => {
  return (
    <div className="bg-[#101010] rounded-[20px] p-6 h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <CreditCard className="w-6 h-6 text-[#FFCC00]" />
          <h3 className="text-[#FFCC00] text-base font-medium">
            Recent Credit Purchases
          </h3>
        </div>

        {/* Filter Dropdown */}
        <div className="relative filter-dropdown-container">
          <button
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className="px-3 py-1.5 bg-white border border-[#dde2e4] rounded-md transition-colors flex items-center gap-1 text-sm"
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

      {/* Purchase List */}
      <div className="space-y-0">
        {purchases.length > 0 ? (
          purchases.map((purchase, index) => (
            <PurchaseListItem
              key={purchase.id}
              purchase={purchase}
              isLast={index === purchases.length - 1}
            />
          ))
        ) : (
          <div className="text-center py-8 text-gray-500">
            No purchases yet
          </div>
        )}
      </div>
    </div>
  );
};

// Purchase List Item Component
const PurchaseListItem: React.FC<{
  purchase: PurchaseHistory & { runningBalance?: number };
  isLast: boolean;
}> = ({ purchase, isLast }) => {
  const formattedDate = new Date(purchase.createdAt).toLocaleDateString("en-US", {
    month: "long",
    day: "2-digit",
    year: "numeric",
    timeZone: "America/Chicago",
  });

  // Generate a reference ID based on purchase ID
  const referenceId = `RCN-${String(purchase.id).padStart(10, "0")}`;

  return (
    <div
      className={`flex justify-between items-center py-4 ${
        !isLast ? "border-b border-[#303236]" : ""
      }`}
    >
      {/* Left side - Date and Reference */}
      <div>
        <p className="text-white text-sm font-medium">{formattedDate}</p>
        <p className="text-[#999] text-xs mt-0.5">{referenceId}</p>
      </div>

      {/* Right side - Amount and Cost */}
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-white text-sm font-medium">{purchase.amount} RCN</p>
          <p className="text-white text-sm font-medium">
            ${purchase.totalCost?.toFixed(0) || "0"}
          </p>
        </div>
        <button className="text-white hover:text-gray-300 transition-colors">
          <FileSearch className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};
