"use client";

import React, { useState, useEffect } from "react";
import { WalletIcon } from "../../icon/index";
import { DataTable, Column } from "@/components/ui/DataTable";
import { StatCard } from "@/components/ui/StatCard";
import { ChevronDown, Download } from "lucide-react";
import { RCGBalanceCard } from "@/components/shop/RCGBalanceCard";
import { useRCGBalance } from "@/hooks/useRCGBalance";
import { formatRCGBalance } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DepositModal } from "@/components/shop/DepositModal";
import { PurchaseSyncButton } from "@/components/shop/PurchaseSyncButton";

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
  blockchainBalance?: number;
  onRefreshData?: () => void;
}

// Purchase columns for DataTable
const purchaseColumns: Column<PurchaseHistory>[] = [
  {
    key: "date",
    header: "Date",
    sortable: true,
    accessor: (purchase) => (
      <span className="text-sm text-gray-300">
        {new Date(purchase.createdAt).toLocaleDateString()}
      </span>
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
        minted: "bg-blue-500/10 text-blue-400",
      };

      return (
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${
              statusColors[purchase.status as keyof typeof statusColors] ||
              statusColors.pending
            }`}
          >
            {purchase.status}
          </span>
          {purchase.status === "pending" && (
            <PurchaseSyncButton
              purchaseId={String(purchase.id)}
              amount={purchase.amount}
            />
          )}
        </div>
      );
    },
  },
];

export const OverviewTab: React.FC<OverviewTabProps> = ({
  shopData,
  purchases,
  blockchainBalance = 0,
  onRefreshData,
}) => {
  const { rcgInfo } = useRCGBalance(shopData?.shopId);

  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [filter, setFilter] = useState<
    "all" | "completed" | "pending" | "failed"
  >("all");
  const [showDepositModal, setShowDepositModal] = useState(false);

  // Filter purchases based on selected filter
  const filteredPurchases = purchases.filter((purchase) => {
    if (filter === "all") return true;
    return purchase.status === filter;
  });

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
    return <div>Loading shop data...</div>;
  }

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="space-y-8">
        {/* Shop Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <div className="relative">
            <StatCard
              title="Operational RCN"
              value={(Number(shopData.purchasedRcnBalance) || 0).toFixed(2)}
              icon={<WalletIcon />}
              subtitle="For rewards"
            />
            <Button
              size="sm"
              className="absolute top-2 right-2 h-8 w-8 p-0 bg-yellow-500 hover:bg-yellow-600 text-black"
              onClick={() => {
                const token = localStorage.getItem('shopAuthToken') || sessionStorage.getItem('shopAuthToken');
                if (!token) {
                  console.error('[OverviewTab] No auth token found when trying to open deposit modal');
                  alert('Please refresh the page to authenticate');
                  return;
                }
                console.log('[OverviewTab] Opening deposit modal with auth token present');
                setShowDepositModal(true);
              }}
              title="Deposit RCN"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
          <StatCard
            title="Total Purchased"
            value={(Number(shopData.totalRcnPurchased) || 0).toFixed(2)}
            icon={<WalletIcon />}
            subtitle="Lifetime"
          />
          <StatCard
            title="Tokens Issued"
            value={shopData.totalTokensIssued || 0}
            icon={<WalletIcon />}
          />
          <StatCard
            title="Redemptions"
            value={shopData.totalRedemptions || 0}
            icon={<WalletIcon />}
          />
          <StatCard
            title="RCG Balance"
            value={formatRCGBalance(rcgInfo?.balance || 0)}
            icon={<WalletIcon />}
          />
        </div>

        {/* Status Cards and RCG Balance */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <StatusCard shopData={shopData} />
          <BalanceAlertCard balance={blockchainBalance} />
          {/* <RCGBalanceCard shopId={shopData.shopId} /> */}
        </div>

        {/* Recent Credit Purchases with DataTable */}
        <div className="bg-[#212121] rounded-3xl">
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
              data={filteredPurchases}
              columns={purchaseColumns}
              keyExtractor={(purchase) => purchase.id}
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
      </div>
    </div>
    
    {/* Deposit Modal */}
    {shopData && (
      <DepositModal
        isOpen={showDepositModal}
        onClose={() => setShowDepositModal(false)}
        shopData={{
          shopId: shopData.shopId,
          walletAddress: shopData.walletAddress || '',
          purchasedRcnBalance: shopData.purchasedRcnBalance
        }}
        onDepositComplete={() => {
          setShowDepositModal(false);
          if (onRefreshData) {
            onRefreshData();
          }
        }}
      />
    )}
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

const BalanceAlertCard: React.FC<{ balance: number }> = ({ balance }) => {
  return (
    <div
      className="bg-gray-800 bg-opacity-90 rounded-lg p-6"
      style={{
        backgroundImage: `url('/img/stat-card.png')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <h3 className="text-2xl font-bold text-[#FFCC00] mb-4">Balance Alert</h3>
      <div className="space-y-3">
        {balance < 50 ? (
          <div className="rounded-lg p-2">
            <div className="flex flex-col gap-4">
              <div className="flex items-center">
                <div className="bg-red-900 p-2 rounded-full text-base mr-3">
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 15 15"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M13.4766 4.6875H10.8984V4.33594C10.8977 3.44939 10.551 2.59812 9.9321 1.96338C9.31317 1.32864 8.47092 0.960555 7.58467 0.9375H7.41533C6.52908 0.960555 5.68683 1.32864 5.0679 1.96338C4.44897 2.59812 4.10226 3.44939 4.10156 4.33594V4.6875H1.52344C1.49236 4.6875 1.46255 4.69985 1.44057 4.72182C1.4186 4.7438 1.40625 4.77361 1.40625 4.80469V13.5938C1.40625 13.7181 1.45564 13.8373 1.54354 13.9252C1.63145 14.0131 1.75068 14.0625 1.875 14.0625H13.125C13.2493 14.0625 13.3685 14.0131 13.4565 13.9252C13.5444 13.8373 13.5938 13.7181 13.5938 13.5938V4.80469C13.5938 4.77361 13.5814 4.7438 13.5594 4.72182C13.5374 4.69985 13.5076 4.6875 13.4766 4.6875ZM5.27344 4.36523C5.27344 3.13945 6.25225 2.12227 7.47803 2.10938C7.77218 2.10678 8.06394 2.16245 8.33648 2.27315C8.60902 2.38386 8.85695 2.54742 9.06597 2.7544C9.275 2.96138 9.44099 3.2077 9.55436 3.47913C9.66774 3.75057 9.72626 4.04177 9.72656 4.33594V4.6875H5.27344V4.36523ZM6.76201 11.7516L4.96406 9.65039L5.67627 9.04072L6.73828 10.2806L9.30205 7.07549L10.0345 7.66143L6.76201 11.7516Z"
                      fill="white"
                    />
                  </svg>
                </div>
                <p className="text-base font-medium text-red-300">
                  Low Balance
                </p>
              </div>
              <p className="text-base text-gray-400">
                Your RCN balance is running low. Purchase more to continue
                offering tier bonuses.
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-lg p-2">
            <div className="flex flex-col gap-4">
              <div className="flex items-center">
                <div className="bg-[#00880E] p-2 rounded-full text-base mr-3">
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 15 15"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M13.4766 4.6875H10.8984V4.33594C10.8977 3.44939 10.551 2.59812 9.9321 1.96338C9.31317 1.32864 8.47092 0.960555 7.58467 0.9375H7.41533C6.52908 0.960555 5.68683 1.32864 5.0679 1.96338C4.44897 2.59812 4.10226 3.44939 4.10156 4.33594V4.6875H1.52344C1.49236 4.6875 1.46255 4.69985 1.44057 4.72182C1.4186 4.7438 1.40625 4.77361 1.40625 4.80469V13.5938C1.40625 13.7181 1.45564 13.8373 1.54354 13.9252C1.63145 14.0131 1.75068 14.0625 1.875 14.0625H13.125C13.2493 14.0625 13.3685 14.0131 13.4565 13.9252C13.5444 13.8373 13.5938 13.7181 13.5938 13.5938V4.80469C13.5938 4.77361 13.5814 4.7438 13.5594 4.72182C13.5374 4.69985 13.5076 4.6875 13.4766 4.6875ZM5.27344 4.36523C5.27344 3.13945 6.25225 2.12227 7.47803 2.10938C7.77218 2.10678 8.06394 2.16245 8.33648 2.27315C8.60902 2.38386 8.85695 2.54742 9.06597 2.7544C9.275 2.96138 9.44099 3.2077 9.55436 3.47913C9.66774 3.75057 9.72626 4.04177 9.72656 4.33594V4.6875H5.27344V4.36523ZM6.76201 11.7516L4.96406 9.65039L5.67627 9.04072L6.73828 10.2806L9.30205 7.07549L10.0345 7.66143L6.76201 11.7516Z"
                      fill="white"
                    />
                  </svg>
                </div>
                <p className="text-base font-medium text-[#00C814]">
                  Healthy Balance
                </p>
              </div>
              <p className="text-base text-gray-400">
                Your RCN balance is sufficient for tier bonuses.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// RecentPurchasesCard component removed - replaced with DataTable
