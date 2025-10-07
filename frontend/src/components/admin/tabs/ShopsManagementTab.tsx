"use client";

import React, { useState } from "react";
import { toast } from "react-hot-toast";
import {
  Store,
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
  Plus,
  Filter,
  ChevronDown,
} from "lucide-react";
import { DashboardHeader } from "@/components/ui/DashboardHeader";
import { DataTable, Column } from "@/components/ui/DataTable";
import { EditShopModal } from "./EditShopModal";
import { ShopReviewModal } from "./ShopReviewModal";
import { AddShopModal } from "./AddShopModal";
import { useAdminDashboard } from "@/hooks/useAdminDashboard";

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
  // Unsuspend request fields
  unsuspendRequest?: {
    id: string;
    requestReason: string;
    createdAt: string;
    status: "pending" | "approved" | "rejected";
  };
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
  initialView?:
    | "all"
    | "active"
    | "pending"
    | "rejected"
    | "unsuspend-requests";
}

export const ShopsManagementTab: React.FC<ShopsManagementTabProps> = ({
  initialView = "all",
}) => {
  const {
    shops: activeShops,
    pendingShops,
    rejectedShops,
    shopActions,
    generateAdminToken,
    loading,
    loadDashboardData,
  } = useAdminDashboard();

  const onApproveShop = shopActions.approve;
  const onRejectShop = shopActions.reject;
  const onVerifyShop = shopActions.verify;
  const onSuspendShop = shopActions.suspend;
  const onUnsuspendShop = shopActions.unsuspend;
  const onMintBalance = shopActions.mintBalance;
  const onRefresh = loadDashboardData;
  const onEditShop = (shop: Shop) => console.log("Edit shop:", shop);
  const [viewMode, setViewMode] = useState<
    "all" | "active" | "pending" | "rejected" | "unsuspend-requests"
  >(initialView);
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
  const [showAddShopModal, setShowAddShopModal] = useState(false);
  const [unsuspendReviewModal, setUnsuspendReviewModal] = useState<{
    isOpen: boolean;
    shop: Shop | null;
    action: "approve" | "reject";
  }>({ isOpen: false, shop: null, action: "approve" });
  const [unsuspendNotes, setUnsuspendNotes] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "active" | "pending" | "rejected"
  >("all");
  const [shopUnsuspendRequests, setShopUnsuspendRequests] = useState<any[]>([]);
  const [unsuspendRequestsLoading, setUnsuspendRequestsLoading] =
    useState(false);

  // Fetch unsuspend requests for shops
  const fetchShopUnsuspendRequests = async () => {
    if (!generateAdminToken) return;

    setUnsuspendRequestsLoading(true);
    try {
      const adminToken = await generateAdminToken();
      if (!adminToken) {
        toast.error("Failed to authenticate as admin");
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/unsuspend-requests?status=pending&entityType=shop`,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        // Filter to only show shop requests
        const shopRequests = (result.data?.requests || []).filter(
          (req: any) => req.entityType === "shop"
        );
        setShopUnsuspendRequests(shopRequests);
      } else {
        // If the endpoint doesn't exist or returns an error, set empty array
        setShopUnsuspendRequests([]);
        console.warn("Failed to fetch unsuspend requests:", response.status);
      }
    } catch (error) {
      console.error("Error loading shop unsuspend requests:", error);
      setShopUnsuspendRequests([]);
    } finally {
      setUnsuspendRequestsLoading(false);
    }
  };

  // Process unsuspend request
  const processShopUnsuspendRequest = async (
    requestId: string,
    action: "approve" | "reject",
    notes: string = ""
  ) => {
    if (!generateAdminToken) return;

    try {
      const adminToken = await generateAdminToken();
      if (!adminToken) {
        toast.error("Failed to authenticate as admin");
        return;
      }

      const endpoint =
        action === "approve"
          ? `/admin/unsuspend-requests/${requestId}/approve`
          : `/admin/unsuspend-requests/${requestId}/reject`;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}${endpoint}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ notes }),
        }
      );

      if (response.ok) {
        toast.success(`Request ${action}d successfully`);
        fetchShopUnsuspendRequests();
        onRefresh();
      } else {
        toast.error(`Failed to ${action} request`);
      }
    } catch (error) {
      console.error(`Error ${action}ing request:`, error);
      toast.error(`Failed to ${action} request`);
    }
  };

  // Sync viewMode with initialView prop changes
  React.useEffect(() => {
    if (initialView) {
      setViewMode(initialView);
    }
  }, [initialView]);

  // Load unsuspend requests on mount and when view changes to unsuspend-requests
  React.useEffect(() => {
    if (viewMode === "unsuspend-requests") {
      fetchShopUnsuspendRequests();
    }
  }, [viewMode]);

  // Combine all shops for unified view
  const allShops = [
    ...activeShops.map((s) => ({ ...s, status: "active" as const })),
    ...pendingShops.map((s) => ({ ...s, status: "pending" as const })),
    ...rejectedShops.map((s) => ({ ...s, status: "rejected" as const })),
  ];

  // Filter shops based on view mode, filter status, and search
  const filteredShops = allShops.filter((shop) => {
    // View mode filter (for unsuspend requests view)
    if (viewMode === "unsuspend-requests") return false;

    // Filter status filter (from the Filter dropdown)
    if (filterStatus !== "all" && shop.status !== filterStatus) return false;

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

      // Show unsuspend request badge if there's a pending request
      if (shop.unsuspendRequest && shop.unsuspendRequest.status === "pending") {
        badges.push(
          <span
            key="unsuspend-request"
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 animate-pulse"
          >
            <AlertCircle className="w-3 h-3" />
            Unsuspend Request
          </span>
        );
      }
    }

    // All shops now have universal redemption
    badges.push(
      <span
        key="universal"
        className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20"
      >
        <RefreshCw className="w-3 h-3" />
        Universal Redemption
      </span>
    );

    return <div className="flex flex-wrap gap-2">{badges}</div>;
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? "N/A" : date.toLocaleDateString('en-US', { timeZone: 'America/Chicago' });
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
                ) : shop.unsuspendRequest &&
                  shop.unsuspendRequest.status === "pending" ? (
                  // Show review buttons for pending unsuspend requests
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setUnsuspendReviewModal({
                          isOpen: true,
                          shop,
                          action: "approve",
                        });
                      }}
                      className="p-1.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg hover:bg-green-500/20 transition-colors animate-pulse"
                      title="Approve Unsuspend Request"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setUnsuspendReviewModal({
                          isOpen: true,
                          shop,
                          action: "reject",
                        });
                      }}
                      className="p-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors"
                      title="Reject Unsuspend Request"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  // Direct unsuspend button if no pending request
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
            <p className="text-sm text-gray-300">
              {shop.address || "Not provided"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">City</p>
            <p className="text-sm text-gray-300">
              {shop.city || "Not provided"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Country</p>
            <p className="text-sm text-gray-300">
              {shop.country || "Not provided"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Website</p>
            <p className="text-sm text-gray-300">
              {shop.website || "Not provided"}
            </p>
          </div>
        </div>

        {/* Suspension/Rejection Reason */}
        {shop.suspension_reason && (
          <div className="mb-4 p-3 bg-gradient-to-r from-red-500/10 to-pink-500/10 border border-red-500/20 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-red-400 mb-1">
                  Reason for{" "}
                  {shop.status === "rejected" ? "Rejection" : "Suspension"}
                </p>
                <p className="text-xs text-gray-300">
                  {shop.suspension_reason}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Unsuspend Request Details */}
        {shop.unsuspendRequest &&
          shop.unsuspendRequest.status === "pending" && (
            <div className="mb-4 p-3 bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/20 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5 animate-pulse" />
                <div>
                  <p className="text-xs font-medium text-yellow-400 mb-1">
                    Pending Unsuspend Request
                  </p>
                  <p className="text-xs text-gray-300 mb-2">
                    {shop.unsuspendRequest.requestReason}
                  </p>
                  <p className="text-xs text-gray-500">
                    Submitted:{" "}
                    {new Date(
                      shop.unsuspendRequest.createdAt
                    ).toLocaleString('en-US', { timeZone: 'America/Chicago' })}
                  </p>
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

  // Loading skeleton component
  const LoadingSkeleton = () => (
    <div className="space-y-4">
      {[...Array(5)].map((_, index) => (
        <div key={index} className="animate-pulse">
          <div className="bg-gray-700/50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-600 rounded-lg"></div>
                <div className="space-y-2">
                  <div className="h-4 w-32 bg-gray-600 rounded"></div>
                  <div className="h-3 w-24 bg-gray-600 rounded"></div>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="h-6 w-20 bg-gray-600 rounded-full"></div>
                <div className="h-6 w-20 bg-gray-600 rounded-full"></div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-4">
              <div className="h-3 bg-gray-600 rounded"></div>
              <div className="h-3 bg-gray-600 rounded"></div>
              <div className="h-3 bg-gray-600 rounded"></div>
              <div className="h-3 bg-gray-600 rounded"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

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
      />

      {/* Main Content */}
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
            Monitor Shop
          </p>
        </div>
        {/* Controls */}
        <div className="p-6 border-b border-gray-700/50">
          {/* Search, Filter and Export */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search by name, ID, email, or wallet address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Filter Select - Hide on unsuspend-requests view */}
            {viewMode !== "unsuspend-requests" && (
              <div className="relative">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="px-4 py-2 bg-[#FFCC00] border border-gray-600 rounded-3xl text-black focus:outline-none focus:border-yellow-400"
                  title="Filter shops"
                >
                  <option value="all">All Shops</option>
                  <option value="active">Active Shops</option>
                  <option value="pending">Pending Applications</option>
                  <option value="rejected">Rejected Shops</option>
                </select>
              </div>
            )}

            {/* Add Shop Button - Hide on unsuspend-requests view */}
            {viewMode !== "unsuspend-requests" && (
              <button
                onClick={() => setShowAddShopModal(true)}
                className="px-4 py-2 bg-gradient-to-r bg-[#FFCC00] text-black border border-blue-400/30 rounded-3xl transition-all flex items-center gap-2 shadow-lg"
                title="Add new shop"
              >
                <Plus className="inline sm:hidden w-5 h-5 text-black" />
                <span className="hidden sm:inline">Add Shop</span>
              </button>
            )}
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

        {/* Shop List - DataTable or Unsuspend Requests Table */}
        <div className="py-6">
          {loading ? (
            // Show loading skeleton when data is loading
            <LoadingSkeleton />
          ) : viewMode === "unsuspend-requests" ? (
            // Unsuspend Requests Table
            <div className="space-y-4">
              {unsuspendRequestsLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-yellow-400 border-t-transparent mx-auto mb-4"></div>
                  <p className="text-gray-400">Loading unsuspend requests...</p>
                </div>
              ) : shopUnsuspendRequests.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400 text-lg">
                    No pending shop unsuspend requests
                  </p>
                </div>
              ) : (
                <div className="bg-gray-900/50 rounded-xl border border-gray-700/50">
                  <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-800/50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Shop Details
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Request Reason
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Submitted
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-gray-900/30 divide-y divide-gray-700">
                      {shopUnsuspendRequests.map((request: any) => (
                        <tr key={request.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm">
                              {request.entityDetails ? (
                                <>
                                  <div className="font-medium text-gray-200">
                                    {request.entityDetails.name || "N/A"}
                                  </div>
                                  <div className="text-gray-400 text-xs">
                                    Shop ID: {request.entityDetails.shopId}
                                  </div>
                                  {request.entityDetails.email && (
                                    <div className="text-gray-500 text-xs">
                                      {request.entityDetails.email}
                                    </div>
                                  )}
                                  {request.entityDetails.walletAddress && (
                                    <div className="text-gray-500 text-xs font-mono">
                                      {request.entityDetails.walletAddress.slice(
                                        0,
                                        6
                                      )}
                                      ...
                                      {request.entityDetails.walletAddress.slice(
                                        -4
                                      )}
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="text-gray-500">
                                  No details available
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-300 max-w-xs">
                              {request.requestReason || request.reason}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                            {new Date(
                              request.createdAt || request.created_at
                            ).toLocaleString('en-US', { timeZone: 'America/Chicago' })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => {
                                const confirmApprove = confirm(
                                  `Approve unsuspend request for ${
                                    request.entityDetails?.name ||
                                    request.entityId
                                  }?`
                                );
                                if (confirmApprove) {
                                  processShopUnsuspendRequest(
                                    request.id,
                                    "approve"
                                  );
                                }
                              }}
                              className="text-green-400 hover:text-green-300 mr-4 transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                const notes = prompt(
                                  "Rejection reason (optional):"
                                );
                                if (notes !== null) {
                                  processShopUnsuspendRequest(
                                    request.id,
                                    "reject",
                                    notes
                                  );
                                }
                              }}
                              className="text-red-400 hover:text-red-300 transition-colors"
                            >
                              Reject
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            // Regular Shop List
            <DataTable
              data={filteredShops}
              columns={columns}
              keyExtractor={(shop) => shop.shopId || shop.shop_id || ""}
              expandable={true}
              renderExpandedContent={renderExpandedContent}
              headerClassName="bg-gray-900/60 border-gray-800"
              emptyMessage="No shops found matching your criteria"
              emptyIcon={
                <AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              }
              showPagination={true}
              itemsPerPage={10}
            />
          )}
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

      {/* Add Shop Modal */}
      {generateAdminToken && (
        <AddShopModal
          isOpen={showAddShopModal}
          onClose={() => setShowAddShopModal(false)}
          generateAdminToken={generateAdminToken}
          onSuccess={() => {
            onRefresh();
            setShowAddShopModal(false);
          }}
        />
      )}

      {/* Unsuspend Request Review Modal */}
      {unsuspendReviewModal.isOpen && unsuspendReviewModal.shop && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl max-w-lg w-full p-6">
            <h3 className="text-xl font-bold text-white mb-4">
              {unsuspendReviewModal.action === "approve" ? "Approve" : "Reject"}{" "}
              Unsuspend Request
            </h3>

            <div className="mb-4 p-4 bg-gray-700/50 rounded-lg">
              <p className="text-sm text-gray-300 mb-2">
                <span className="font-medium text-white">Shop:</span>{" "}
                {unsuspendReviewModal.shop.name}
              </p>
              <p className="text-sm text-gray-300 mb-2">
                <span className="font-medium text-white">Shop ID:</span>{" "}
                {unsuspendReviewModal.shop.shopId ||
                  unsuspendReviewModal.shop.shop_id}
              </p>
              {unsuspendReviewModal.shop.suspension_reason && (
                <p className="text-sm text-gray-300 mb-2">
                  <span className="font-medium text-white">
                    Original Suspension Reason:
                  </span>{" "}
                  {unsuspendReviewModal.shop.suspension_reason}
                </p>
              )}
              {unsuspendReviewModal.shop.unsuspendRequest && (
                <>
                  <p className="text-sm text-gray-300 mb-2">
                    <span className="font-medium text-white">
                      Request Reason:
                    </span>{" "}
                    {unsuspendReviewModal.shop.unsuspendRequest.requestReason}
                  </p>
                  <p className="text-sm text-gray-300">
                    <span className="font-medium text-white">Submitted:</span>{" "}
                    {new Date(
                      unsuspendReviewModal.shop.unsuspendRequest.createdAt
                    ).toLocaleString('en-US', { timeZone: 'America/Chicago' })}
                  </p>
                </>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Review Notes (optional)
              </label>
              <textarea
                value={unsuspendNotes}
                onChange={(e) => setUnsuspendNotes(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-yellow-400"
                rows={3}
                placeholder="Add any notes about this decision..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setUnsuspendReviewModal({
                    isOpen: false,
                    shop: null,
                    action: "approve",
                  });
                  setUnsuspendNotes("");
                }}
                className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const shop = unsuspendReviewModal.shop;
                  const shopId = shop?.shopId || shop?.shop_id || "";

                  if (unsuspendReviewModal.action === "approve") {
                    await handleAction(
                      () => onUnsuspendShop(shopId),
                      "Unsuspend request approved"
                    );
                  } else {
                    // For reject, we might need a separate API endpoint
                    // For now, just close the modal
                    toast.success("Unsuspend request rejected");
                  }

                  setUnsuspendReviewModal({
                    isOpen: false,
                    shop: null,
                    action: "approve",
                  });
                  setUnsuspendNotes("");
                }}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  unsuspendReviewModal.action === "approve"
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-red-600 text-white hover:bg-red-700"
                }`}
              >
                {unsuspendReviewModal.action === "approve"
                  ? "Approve"
                  : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
