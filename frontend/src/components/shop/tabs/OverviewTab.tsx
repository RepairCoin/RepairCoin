"use client";

import React, { useState, useEffect, useCallback } from "react";
import { WalletIcon } from "../../icon/index";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatCard } from "@/components/ui/StatCard";
import { ChevronDown } from "lucide-react";
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

// Purchase columns for DataTable
const purchaseColumns: Column<PurchaseHistory>[] = [
  {
    key: "date",
    header: "Date",
    sortable: true,
    accessor: (purchase) => (
      <div>
        <div className="text-sm text-gray-300">
          {new Date(purchase.createdAt).toLocaleDateString('en-US', { timeZone: 'America/Chicago' })}
        </div>
        <div className="text-xs text-gray-500">
          {new Date(purchase.createdAt).toLocaleTimeString('en-US', { timeZone: 'America/Chicago' })}
        </div>
      </div>
    ),
  },
  {
    key: "amount",
    header: "Credits",
    sortable: true,
    accessor: (purchase) => (
      <span className="text-sm font-semibold text-yellow-400">
        {purchase.amount} RCN
      </span>
    ),
  },
  {
    key: "cost",
    header: "Cost",
    sortable: true,
    accessor: (purchase) => (
      <span className="text-sm text-gray-300">
        ${purchase.totalCost?.toFixed(2) || "N/A"}
      </span>
    ),
  },
  {
    key: "method",
    header: "Payment Method",
    accessor: (purchase) => (
      <span className="text-sm text-gray-300">
        {purchase.paymentMethod.toUpperCase()}
      </span>
    ),
  },
  {
    key: "status",
    header: "Status",
    accessor: (purchase) => {
      const statusColors = {
        completed: "bg-green-500/10 text-green-400",
        pending: "bg-yellow-500/10 text-yellow-400",
        failed: "bg-red-500/10 text-red-400",
        cancelled: "bg-red-500/10 text-red-400",
        minted: "bg-blue-500/10 text-blue-400",
      };

      const statusLabels = {
        completed: "completed",
        pending: "pending",
        failed: "expired",
        cancelled: "cancelled",
        minted: "minted",
      };

      // Check if pending purchase is very recent (< 2 minutes) - show as "in progress"
      if (purchase.status === 'pending') {
        const purchaseTime = new Date(purchase.createdAt).getTime();
        const ageMinutes = Math.floor((Date.now() - purchaseTime) / 60000);

        if (ageMinutes < 2) {
          return (
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 flex items-center gap-1">
              <span className="animate-pulse w-1.5 h-1.5 bg-blue-400 rounded-full"></span>
              in progress
            </span>
          );
        }

        // Older pending purchases are treated as cancelled (Stripe auto-cancels)
        return (
          <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400">
            cancelled
          </span>
        );
      }

      return (
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            statusColors[purchase.status as keyof typeof statusColors] ||
            statusColors.pending
          }`}
        >
          {statusLabels[purchase.status as keyof typeof statusLabels] || purchase.status}
        </span>
      );
    },
  },
  {
    key: "runningBalance",
    header: "Balance",
    sortable: true,
    accessor: (purchase: PurchaseHistory & { runningBalance?: number }) => (
      <span className="text-sm font-semibold text-green-400">
        {purchase.runningBalance ? `${purchase.runningBalance} RCN` : "0 RCN"}
      </span>
    ),
  },
  {
    key: "actions",
    header: "Actions",
    accessor: (purchase: PurchaseHistory & {
      onToggleMenu?: (id: string | number) => void;
      onContinuePayment?: (id: string | number) => void;
      onCancelPayment?: (id: string | number) => void;
      continuingPayment?: string | null;
      cancellingPayment?: string | null;
      showMenu?: string | null;
    }) => {
      if (purchase.status === 'pending') {
        // Check if purchase is very recent (< 2 minutes) - show processing
        const purchaseTime = new Date(purchase.createdAt).getTime();
        const ageMinutes = Math.floor((Date.now() - purchaseTime) / 60000);

        if (ageMinutes < 2) {
          return (
            <span className="text-xs text-gray-500 italic">
              Processing...
            </span>
          );
        }

        // Older pending purchases will be auto-cancelled, no actions needed
        return (
          <span className="text-xs text-gray-500 italic">
            Auto-cancelled
          </span>
        );
      }
      return null;
    },
  },
];

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
    return <div>Loading shop data...</div>;
  }

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Shop Statistics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Operational RCN"
              value={(Number(shopData.purchasedRcnBalance) || 0).toFixed(2)}
              icon={<WalletIcon />}
            />
            <StatCard
              title="Total Purchased"
              value={(Number(shopData.totalRcnPurchased) || 0).toFixed(2)}
              icon={<WalletIcon />}
            />
            <StatCard
              title="Tokens Issued"
              value={shopData.totalTokensIssued || 0}
              icon={<WalletIcon />}
            />
            <StatCard
              title="RCG Balance"
              value={formatRCGBalance(rcgInfo?.balance || 0)}
              icon={<WalletIcon />}
            />
          </div>

          {/* Profit Chart - Full Width */}
          <div className="w-full">
            <ProfitChart shopId={shopData.shopId} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Recent Credit Purchases with DataTable */}
            <div className="bg-[#212121] rounded-3xl lg:col-span-3 h-auto">
              <div
                className="w-full flex justify-between items-center gap-2 px-4 md:px-8 py-4 text-white rounded-t-3xl"
                style={{
                  backgroundImage: `url('/img/cust-ref-widget3.png')`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                }}
              >
                <p className="text-base sm:text-lg md:text-xl text-gray-900 font-semibold">
                  Recent Credit Purchases
                </p>
                {/* Filter Dropdown */}
                <div className="relative filter-dropdown-container">
                  <button
                    onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                    className="px-4 py-2 bg-[#101010] rounded-3xl transition-colors flex items-center gap-2"
                    title="Filter purchases"
                  >
                    <span className="hidden sm:inline capitalize">
                      {filter === "all" ? "All" : filter}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${
                        showFilterDropdown ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {/* Dropdown Menu */}
                  {showFilterDropdown && (
                    <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50">
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
                                ? "bg-yellow-500/20 text-yellow-400"
                                : "text-gray-300 hover:bg-gray-700"
                            } ${filterOption === "all" ? "rounded-t-lg" : ""} ${
                              filterOption === "failed" ? "rounded-b-lg" : ""
                            }`}
                          >
                            <span className="capitalize">{filterOption}</span>
                            {filter === filterOption && (
                              <span className="ml-2">✓</span>
                            )}
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4 py-8">
                <DataTable
                  data={purchasesWithBalance}
                  columns={purchaseColumns}
                  keyExtractor={(purchase) => purchase.id as string}
                  loading={false}
                  loadingRows={5}
                  emptyMessage="No purchases yet"
                  className=""
                  headerClassName="bg-[#3D3D3D]"
                  showPagination={true}
                  itemsPerPage={5}
                  paginationClassName=""
                  rowClassName={(purchase) =>
                    purchase.status === "failed" ? "bg-red-900/10" : ""
                  }
                />
              </div>
            </div>

            {/* Status Card */}
            <div className="bg-[#212121] rounded-3xl lg:col-span-2 flex flex-col  lg:max-h-[100px] h-auto">
              <StatusCard shopData={shopData} />
            </div>
          </div>
        </div>
      </div>

    </>
  );
};

const StatusCard: React.FC<{ shopData: ShopData }> = ({ shopData }) => {
  return (
    <div
      className="rounded-2xl shadow-xl p-6"
      style={{
        backgroundImage: `url('/img/stat-card.png')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <h3 className="text-2xl font-bold text-[#FFCC00] mb-4">Shop Status</h3>
      <div className="space-y-3">
        <StatusRow
          label="Operational Status"
          value={
            shopData.operational_status === "rcg_qualified"
              ? "RCG Qualified"
              : shopData.operational_status === "subscription_qualified"
              ? "Subscription Active"
              : shopData.operational_status === "pending"
              ? "Pending"
              : "Not Qualified"
          }
          status={
            shopData.operational_status === "rcg_qualified" ||
            shopData.operational_status === "subscription_qualified"
              ? "success"
              : shopData.operational_status === "pending"
              ? "warning"
              : "error"
          }
        />
        <StatusRow
          label="Active Status"
          value={shopData.active ? "Active" : "Inactive"}
          status={shopData.active ? "success" : "error"}
        />
        <StatusRow
          label="Verification"
          value={shopData.verified ? "Verified" : "Pending"}
          status={shopData.verified ? "info" : "warning"}
        />
        <StatusRow
          label="Cross-Shop Redemption"
          value={shopData.crossShopEnabled ? "Enabled" : "Disabled"}
          status={shopData.crossShopEnabled ? "success" : "neutral"}
        />
      </div>
    </div>
  );
};

const StatusRow: React.FC<{ label: string; value: string; status: string }> = ({
  label,
  value,
  status,
}) => {
  const statusColors = {
    success: "bg-green-900 text-green-300",
    error: "bg-red-900 text-red-300",
    info: "bg-blue-900 text-blue-300",
    warning: "bg-yellow-900 text-yellow-300",
    neutral: "bg-gray-700 text-gray-300",
  };

  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-400 text-base">{label}</span>
      <span
        className={`px-6 py-1 rounded-full text-sm font-semibold ${
          statusColors[status as keyof typeof statusColors]
        }`}
      >
        {value}
      </span>
    </div>
  );
};
