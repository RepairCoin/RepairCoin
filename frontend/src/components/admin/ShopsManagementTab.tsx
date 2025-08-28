"use client";

import React, { useState } from "react";
import { toast } from "react-hot-toast";
import {
  Store,
  ChevronDown,
  Search,
  Download,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Wallet,
  Mail,
  Phone,
  Calendar,
  Eye,
  Edit,
  Power,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  Send,
  Filter,
} from "lucide-react";
import { DashboardHeader } from "@/components/ui/DashboardHeader";
import { DataTable, Column } from "@/components/ui/DataTable";
import { EditShopModal } from "./EditShopModal";
import { ShopReviewModal } from "./ShopReviewModal";

interface Shop {
  shopId: string;
  shop_id?: string;
  name: string;
  active?: boolean;
  verified?: boolean;
  totalTokensIssued?: number;
  totalRedemptions?: number;
  crossShopEnabled?: boolean;
  cross_shop_enabled?: boolean;
  purchasedRcnBalance?: number;
  walletAddress?: string;
  wallet_address?: string;
  walletBalance?: number;
  email?: string;
  phone?: string;
  joinDate?: string;
  join_date?: string;
  suspended_at?: string;
  suspension_reason?: string;
  // Additional fields for UI
  monthlyVolume?: number;
  customerCount?: number;
  lastActivity?: string;
  // Location fields
  address?: string;
  city?: string;
  country?: string;
  website?: string;
}

interface ShopsManagementTabProps {
  activeShops: Shop[];
  pendingShops: Shop[];
  rejectedShops?: Shop[];
  onApproveShop: (shopId: string) => Promise<void>;
  onRejectShop?: (shopId: string, reason?: string) => Promise<void>;
  onVerifyShop: (shopId: string) => Promise<void>;
  onSuspendShop: (shopId: string) => Promise<void>;
  onUnsuspendShop: (shopId: string) => Promise<void>;
  onEditShop?: (shop: Shop) => void;
  onMintBalance?: (shopId: string) => Promise<void>;
  onRefresh: () => void;
  generateAdminToken?: () => Promise<string | null>;
}

export const ShopsManagementTab: React.FC<ShopsManagementTabProps> = ({
  activeShops,
  pendingShops,
  rejectedShops = [],
  onApproveShop,
  onRejectShop,
  onVerifyShop,
  onSuspendShop,
  onUnsuspendShop,
  onEditShop,
  onMintBalance,
  onRefresh,
  generateAdminToken,
}) => {
  const [viewMode, setViewMode] = useState<
    "all" | "active" | "pending" | "rejected"
  >("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    shop: Shop | null;
  }>({ isOpen: false, shop: null });
  const [reviewModal, setReviewModal] = useState<{
    isOpen: boolean;
    shop: Shop | null;
  }>({ isOpen: false, shop: null });
  const [isProcessing, setIsProcessing] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.filter-dropdown-container')) {
        setShowFilterDropdown(false);
      }
    };

    if (showFilterDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showFilterDropdown]);

  // Combine all shops for unified view
  const allShops = [
    ...activeShops.map((s) => ({ ...s, status: "active" as const })),
    ...pendingShops.map((s) => ({ ...s, status: "pending" as const })),
    ...rejectedShops.map((s) => ({ ...s, status: "rejected" as const })),
  ];

  // Filter shops based on view mode and search
  const filteredShops = allShops.filter((shop) => {
    // View mode filter
    if (viewMode !== "all" && shop.status !== viewMode) return false;

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const shopId = shop.shopId || shop.shop_id || "";
      const walletAddr = shop.walletAddress || shop.wallet_address || "";

      return (
        shop.name.toLowerCase().includes(term) ||
        shopId.toLowerCase().includes(term) ||
        shop.email?.toLowerCase().includes(term) ||
        walletAddr.toLowerCase().includes(term)
      );
    }

    return true;
  });

  const getStatusBadge = (shop: Shop & { status: string }) => {
    if (shop.status === "rejected") {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
          <XCircle className="w-3 h-3" />
          Rejected
        </span>
      );
    }

    if (shop.status === "pending") {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
          <Clock className="w-3 h-3" />
          Pending Approval
        </span>
      );
    }

    // Active shop statuses
    const badges = [];

    if (shop.verified) {
      badges.push(
        <span
          key="verified"
          className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20"
        >
          <ShieldCheck className="w-3 h-3" />
          Verified
        </span>
      );
    }

    if (shop.active) {
      badges.push(
        <span
          key="active"
          className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20"
        >
          <CheckCircle className="w-3 h-3" />
          Active
        </span>
      );
    } else if (shop.suspended_at) {
      badges.push(
        <span
          key="suspended"
          className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20"
        >
          <XCircle className="w-3 h-3" />
          Suspended
        </span>
      );
    }

    if (shop.crossShopEnabled || shop.cross_shop_enabled) {
      badges.push(
        <span
          key="crossshop"
          className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20"
        >
          <RefreshCw className="w-3 h-3" />
          Cross-Shop
        </span>
      );
    }

    return <div className="flex flex-wrap gap-2">{badges}</div>;
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? "N/A" : date.toLocaleDateString();
  };

  const handleAction = async (
    action: () => Promise<void>,
    successMessage: string
  ) => {
    setIsProcessing(true);
    try {
      await action();
      toast.success(successMessage);
      onRefresh();
    } catch (error) {
      console.error("Action failed:", error);
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setIsProcessing(false);
    }
  };

  // Define table columns
  const columns: Column<Shop & { status: string }>[] = [
    {
      key: "shop",
      header: "Shop",
      sortable: true,
      accessor: (shop) => {
        const shopId = shop.shopId || shop.shop_id || "";
        return (
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0 ${
                shop.status === "active"
                  ? shop.verified
                    ? "bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30"
                    : "bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/30"
                  : shop.status === "pending"
                  ? "bg-gradient-to-br from-yellow-500/20 to-amber-500/20 border border-yellow-500/30"
                  : "bg-gradient-to-br from-red-500/20 to-pink-500/20 border border-red-500/30"
              }`}
            >
              {shop.status === "active"
                ? shop.verified
                  ? "✓"
                  : "🏪"
                : shop.status === "pending"
                ? "⏳"
                : "❌"}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{shop.name}</p>
              <p className="text-xs text-gray-400 font-mono">{shopId}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      accessor: (shop) => getStatusBadge(shop),
    },
    {
      key: "contact",
      header: "Contact",
      sortable: true,
      accessor: (shop) => (
        <div className="text-xs">
          <p
            className="text-gray-300 truncate max-w-[150px]"
            title={shop.email || "Not provided"}
          >
            {shop.email || "No email"}
          </p>
          <p className="text-gray-400">{shop.phone || "No phone"}</p>
        </div>
      ),
    },
    {
      key: "wallet",
      header: "Wallet",
      accessor: (shop) => {
        const walletAddr = shop.walletAddress || shop.wallet_address;
        return (
          <p className="text-xs text-gray-300 font-mono">
            {walletAddr ? formatAddress(walletAddr) : "Not set"}
          </p>
        );
      },
    },
    {
      key: "tokens",
      header: "Tokens",
      sortable: true,
      accessor: (shop) => (
        <div className="text-xs">
          <p className="text-yellow-400 font-semibold">
            {(shop.totalTokensIssued || 0).toLocaleString()} RCN
          </p>
          {shop.purchasedRcnBalance && shop.purchasedRcnBalance > 0 && (
            <p className="text-gray-400">Balance: {shop.purchasedRcnBalance}</p>
          )}
        </div>
      ),
    },
    {
      key: "joined",
      header: "Joined",
      sortable: true,
      accessor: (shop) => (
        <p className="text-xs text-gray-300">
          {formatDate(shop.joinDate || shop.join_date)}
        </p>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      accessor: (shop) => {
        const shopId = shop.shopId || shop.shop_id || "";
        return (
          <div className="flex items-center gap-2">
            {shop.status === "pending" && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAction(
                      () => onApproveShop(shopId),
                      "Shop approved successfully"
                    );
                  }}
                  disabled={isProcessing}
                  className="p-1.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg hover:bg-green-500/20 transition-colors disabled:opacity-50"
                  title="Approve"
                >
                  <CheckCircle className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setReviewModal({ isOpen: true, shop });
                  }}
                  className="p-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-colors"
                  title="Review"
                >
                  <Eye className="w-4 h-4" />
                </button>
                {onRejectShop && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAction(
                        () =>
                          onRejectShop(shopId, "Does not meet requirements"),
                        "Shop rejected"
                      );
                    }}
                    disabled={isProcessing}
                    className="p-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-50"
                    title="Reject"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
              </>
            )}

            {shop.status === "active" && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditModal({ isOpen: true, shop });
                  }}
                  className="p-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-lg hover:bg-indigo-500/20 transition-colors"
                  title="Edit"
                >
                  <Edit className="w-4 h-4" />
                </button>
                {!shop.verified && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAction(
                        () => onVerifyShop(shopId),
                        "Shop verified successfully"
                      );
                    }}
                    disabled={isProcessing}
                    className="p-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                    title="Verify"
                  >
                    <ShieldCheck className="w-4 h-4" />
                  </button>
                )}
                {shop.active ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAction(
                        () => onSuspendShop(shopId),
                        "Shop suspended"
                      );
                    }}
                    disabled={isProcessing}
                    className="p-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-50"
                    title="Suspend"
                  >
                    <ShieldOff className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAction(
                        () => onUnsuspendShop(shopId),
                        "Shop unsuspended"
                      );
                    }}
                    disabled={isProcessing}
                    className="p-1.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg hover:bg-green-500/20 transition-colors disabled:opacity-50"
                    title="Unsuspend"
                  >
                    <Power className="w-4 h-4" />
                  </button>
                )}
              </>
            )}

            {shop.status === "rejected" && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setReviewModal({ isOpen: true, shop });
                  }}
                  className="p-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-colors"
                  title="View"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAction(
                      () => onApproveShop(shopId),
                      "Shop reconsidered and approved"
                    );
                  }}
                  disabled={isProcessing}
                  className="p-1.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg hover:bg-green-500/20 transition-colors disabled:opacity-50"
                  title="Reconsider"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        );
      },
    },
  ];

  // Render expanded content
  const renderExpandedContent = (shop: Shop & { status: string }) => {
    const shopId = shop.shopId || shop.shop_id || "";
    return (
      <div className="p-4">
        {/* Additional Details */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Address</p>
            <p className="text-sm text-gray-300">{shop.address || "Not provided"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">City</p>
            <p className="text-sm text-gray-300">{shop.city || "Not provided"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Country</p>
            <p className="text-sm text-gray-300">{shop.country || "Not provided"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Website</p>
            <p className="text-sm text-gray-300">{shop.website || "Not provided"}</p>
          </div>
        </div>

        {/* Suspension/Rejection Reason */}
        {shop.suspension_reason && (
          <div className="mb-4 p-3 bg-gradient-to-r from-red-500/10 to-pink-500/10 border border-red-500/20 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-red-400 mb-1">
                  Reason for {shop.status === "rejected" ? "Rejection" : "Suspension"}
                </p>
                <p className="text-xs text-gray-300">{shop.suspension_reason}</p>
              </div>
            </div>
          </div>
        )}

        {/* Additional Actions */}
        <div className="flex flex-wrap gap-2">
          {shop.status === "active" &&
            shop.purchasedRcnBalance &&
            shop.purchasedRcnBalance > 0 &&
            onMintBalance && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAction(
                    () => onMintBalance(shopId),
                    "Tokens minted to blockchain"
                  );
                }}
                disabled={isProcessing}
                className="px-3 py-1.5 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-400 border border-yellow-500/30 rounded-lg hover:from-yellow-500/30 hover:to-orange-500/30 transition-all text-sm font-medium disabled:opacity-50 flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Mint {shop.purchasedRcnBalance} RCN to Blockchain
              </button>
            )}
        </div>
      </div>
    );
  };

  const exportToCSV = () => {
    const headers = [
      "Shop Name",
      "Shop ID",
      "Status",
      "Email",
      "Phone",
      "Wallet",
      "Tokens Issued",
      "Join Date",
    ];
    const rows = filteredShops.map((shop) => [
      shop.name,
      shop.shopId || shop.shop_id || "",
      shop.status,
      shop.email || "",
      shop.phone || "",
      shop.walletAddress || shop.wallet_address || "",
      (shop.totalTokensIssued || 0).toString(),
      formatDate(shop.joinDate || shop.join_date),
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `shops_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    toast.success("Shop data exported successfully");
  };

  // Statistics
  const stats = {
    total: allShops.length,
    active: activeShops.filter((s) => s.active && s.verified).length,
    pending: pendingShops.length,
    rejected: rejectedShops.length,
    verified: activeShops.filter((s) => s.verified).length,
    totalTokensIssued: activeShops.reduce(
      (sum, s) => sum + (s.totalTokensIssued || 0),
      0
    ),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <DashboardHeader
        title="Shop Management"
        subtitle="Manage all shop applications and active shops"
        icon={Store}
      />

      {/* Main Content */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700/50">
        {/* Controls */}
        <div className="p-6 border-b border-gray-700/50">
          {/* Search, Filter and Export */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, ID, email, or wallet address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-yellow-400"
              />
            </div>
            
            {/* Filter Dropdown */}
            <div className="relative filter-dropdown-container">
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="px-4 py-2 bg-gray-700/50 text-gray-300 border border-gray-600 rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2"
                title="Filter shops"
              >
                <Filter className="w-5 h-5" />
                <span className="hidden sm:inline capitalize">
                  {viewMode === 'all' ? 'All' : viewMode}
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showFilterDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {/* Dropdown Menu */}
              {showFilterDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10">
                  {(['all', 'active', 'pending', 'rejected'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => {
                        setViewMode(mode);
                        setShowFilterDropdown(false);
                      }}
                      className={`w-full px-4 py-2 text-left hover:bg-gray-700 transition-colors flex items-center justify-between ${
                        viewMode === mode ? 'text-yellow-400 bg-gray-700/50' : 'text-gray-300'
                      } ${
                        mode === 'all' ? 'rounded-t-lg' : mode === 'rejected' ? 'rounded-b-lg' : ''
                      }`}
                    >
                      <span className="capitalize">
                        {mode === 'all' ? 'All Shops' : mode}
                      </span>
                      {mode !== 'all' && (
                        <span className="text-xs text-gray-500">
                          {mode === 'active'
                            ? stats.active
                            : mode === 'pending'
                            ? stats.pending
                            : stats.rejected}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* <button
              onClick={exportToCSV}
              className="px-4 py-2 bg-gray-700/50 text-gray-300 border border-gray-600 rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2"
              title="Export to CSV"
            >
              <Download className="w-5 h-5" />
              <span className="hidden sm:inline">Export</span>
            </button> */}
          </div>
        </div>

        {/* Shop List - DataTable */}
        <div className="p-6">
          <DataTable
            data={filteredShops}
            columns={columns}
            keyExtractor={(shop) => shop.shopId || shop.shop_id || ""}
            expandable={true}
            renderExpandedContent={renderExpandedContent}
            emptyMessage="No shops found matching your criteria"
            emptyIcon={<AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-4" />}
          />
        </div>
      </div>

      {/* Modals */}
      {editModal.shop && generateAdminToken && (
        <EditShopModal
          isOpen={editModal.isOpen}
          onClose={() => setEditModal({ isOpen: false, shop: null })}
          shop={editModal.shop}
          generateAdminToken={generateAdminToken}
          onRefresh={onRefresh}
        />
      )}

      {reviewModal.shop && (
        <ShopReviewModal
          isOpen={reviewModal.isOpen}
          onClose={() => setReviewModal({ isOpen: false, shop: null })}
          shop={reviewModal.shop}
          onApprove={(shopId) => {
            handleAction(
              () => onApproveShop(shopId),
              "Shop approved successfully"
            );
            setReviewModal({ isOpen: false, shop: null });
          }}
          onReject={(shopId) => {
            if (onRejectShop) {
              handleAction(
                () => onRejectShop(shopId, "Does not meet requirements"),
                "Shop rejected"
              );
            }
            setReviewModal({ isOpen: false, shop: null });
          }}
        />
      )}
    </div>
  );
};
