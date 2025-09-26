"use client";

import React, { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import {
  Store,
  Search,
  ChevronRight,
  Award,
  Calendar,
  Coins,
  Activity,
  AlertCircle,
  CheckCircle,
  XCircle,
  Eye,
  Mail,
  Phone,
  Hash,
  UserCheck,
  Star,
} from "lucide-react";
import { DashboardHeader } from "@/components/ui/DashboardHeader";
import { DataTable, Column } from "@/components/ui/DataTable";
import { useAdminDashboard } from "@/hooks/useAdminDashboard";

interface Customer {
  address: string;
  name?: string;
  email?: string;
  phone?: string;
  tier: "BRONZE" | "SILVER" | "GOLD";
  lifetimeEarnings: number;
  monthlyEarnings?: number;
  lastTransactionDate?: string;
  totalTransactions?: number;
  isActive: boolean;
  joinDate?: string;
  referralCode?: string;
  referralCount?: number;
  // Suspension fields
  suspended_at?: string;
  suspension_reason?: string;
  // Unsuspend request fields
  unsuspendRequest?: {
    id: string;
    requestReason: string;
    createdAt: string;
    status: "pending" | "approved" | "rejected";
  };
}

interface ShopWithCustomers {
  shopId: string;
  shopName: string;
  totalCustomers: number;
  customers: Customer[];
  shopRevenue?: number;
  avgCustomerValue?: number;
}

interface GroupedCustomersData {
  totalShops: number;
  totalCustomersWithShops: number;
  totalCustomersWithoutShops: number;
  totalCustomers: number;
  shopsWithCustomers: ShopWithCustomers[];
  customersWithoutShops: Customer[];
}

interface CustomersTabEnhancedProps {
  initialView?: "grouped" | "all" | "unsuspend-requests";
}

export const CustomersTabEnhanced: React.FC<CustomersTabEnhancedProps> = ({
  initialView = "grouped",
}) => {
  const { generateAdminToken, customerActions, loadDashboardData } =
    useAdminDashboard();

  const onMintTokens = customerActions.mintTokens;
  const onSuspendCustomer = customerActions.suspend;
  const onUnsuspendCustomer = customerActions.unsuspend;
  const onRefresh = loadDashboardData;
  const [data, setData] = useState<GroupedCustomersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedShops, setExpandedShops] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<
    "grouped" | "all" | "no-shop" | "unsuspend-requests"
  >(
    initialView === "unsuspend-requests"
      ? "unsuspend-requests"
      : initialView === "all"
      ? "all"
      : "grouped"
  );
  const [displayMode] = useState<"table" | "grid">("table");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTier, setSelectedTier] = useState<string>("all");
  const [sortBy, setSortBy] = useState<
    "earnings" | "transactions" | "date" | "name"
  >("earnings");
  const [sortOrder] = useState<"asc" | "desc">("desc");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [mintAmount, setMintAmount] = useState(100);
  const [mintReason, setMintReason] = useState("Admin bonus");
  const [unsuspendReviewModal, setUnsuspendReviewModal] = useState<{
    isOpen: boolean;
    customer: Customer | null;
    action: "approve" | "reject";
  }>({ isOpen: false, customer: null, action: "approve" });
  const [unsuspendNotes, setUnsuspendNotes] = useState("");
  const [unsuspendRequests, setUnsuspendRequests] = useState<any[]>([]);
  const [unsuspendRequestsLoading, setUnsuspendRequestsLoading] =
    useState(false);

  // Define table columns for customers
  const customerColumns: Column<Customer>[] = [
    {
      key: "customer",
      header: "Customer",
      sortable: true,
      accessor: (customer) => (
        <div className="flex items-center gap-3">
          <div>
            <p className="text-sm font-semibold text-white">
              {customer.name || "Anonymous"}
            </p>
            <p className="text-xs text-gray-400 font-mono">
              {formatAddress(customer.address)}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "tier",
      header: "Tier",
      sortable: true,
      accessor: (customer) => (
        <span
          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${getTierColor(
            customer.tier
          )}`}
        >
          {getTierIcon(customer.tier)}
          {customer.tier}
        </span>
      ),
    },
    {
      key: "earnings",
      header: "Lifetime Earnings",
      sortable: true,
      accessor: (customer) => (
        <div className="text-sm">
          <p className="text-yellow-400 font-semibold">
            {customer.lifetimeEarnings.toLocaleString()} RCN
          </p>
          {customer.monthlyEarnings && (
            <p className="text-xs text-gray-400">
              Monthly: {customer.monthlyEarnings} RCN
            </p>
          )}
        </div>
      ),
    },
    {
      key: "referrals",
      header: "Referrals",
      accessor: (customer) => (
        <div className="text-sm">
          {customer.referralCode && (
            <>
              <p className="text-gray-300 font-mono text-xs">
                {customer.referralCode}
              </p>
              <p className="text-xs text-gray-400">
                {customer.referralCount || 0} referrals
              </p>
            </>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      accessor: (customer) => (
        <div className="flex flex-wrap gap-2">
          <span
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
              customer.isActive
                ? "bg-green-500/10 text-green-400 border border-green-500/20"
                : "bg-red-500/10 text-red-400 border border-red-500/20"
            }`}
          >
            {customer.isActive ? (
              <CheckCircle className="w-3 h-3" />
            ) : (
              <XCircle className="w-3 h-3" />
            )}
            {customer.isActive ? "Active" : "Suspended"}
          </span>
          {customer.unsuspendRequest &&
            customer.unsuspendRequest.status === "pending" && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 animate-pulse">
                <AlertCircle className="w-3 h-3" />
                Request
              </span>
            )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      accessor: (customer) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedCustomer(customer);
            }}
            className="p-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-colors"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleQuickMint(customer.address);
            }}
            className="p-1.5 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 rounded-lg hover:bg-yellow-500/20 transition-colors"
            title="Mint 100 RCN"
          >
            <Coins className="w-4 h-4" />
          </button>
          {/* Suspension/Unsuspension actions */}
          {customer.isActive && onSuspendCustomer ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                // For now, use a default reason - could add a modal for this
                onSuspendCustomer(customer.address, "Admin decision");
                toast.success("Customer suspended");
              }}
              className="p-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors"
              title="Suspend Customer"
            >
              <XCircle className="w-4 h-4" />
            </button>
          ) : !customer.isActive &&
            customer.unsuspendRequest?.status === "pending" ? (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setUnsuspendReviewModal({
                    isOpen: true,
                    customer,
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
                    customer,
                    action: "reject",
                  });
                }}
                className="p-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors"
                title="Reject Unsuspend Request"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </>
          ) : !customer.isActive && onUnsuspendCustomer ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUnsuspendCustomer(customer.address);
                toast.success("Customer unsuspended");
              }}
              className="p-1.5 bg-green-500/10 text-green-400 border border-green-500/20 rounded-lg hover:bg-green-500/20 transition-colors"
              title="Unsuspend Customer"
            >
              <UserCheck className="w-4 h-4" />
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleQuickMint = (address: string) => {
    onMintTokens(address, 100, "Quick admin bonus");
    toast.success(`Minted 100 RCN to ${formatAddress(address)}`);
  };

  useEffect(() => {
    loadCustomersData();
  }, []);

  // Fetch unsuspend requests when the view changes to unsuspend-requests
  useEffect(() => {
    if (viewMode === "unsuspend-requests") {
      fetchUnsuspendRequests();
    }
  }, [viewMode]);

  // Sync viewMode with initialView prop changes
  useEffect(() => {
    if (initialView) {
      setViewMode(
        initialView === "unsuspend-requests"
          ? "unsuspend-requests"
          : initialView === "all"
          ? "all"
          : "grouped"
      );
    }
  }, [initialView]);

  const fetchUnsuspendRequests = async () => {
    setUnsuspendRequestsLoading(true);
    try {
      const adminToken = await generateAdminToken();
      if (!adminToken) {
        toast.error("Failed to authenticate as admin");
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/unsuspend-requests?status=pending&entityType=customer`,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        // Filter to only show customer requests
        const customerRequests = (result.data?.requests || []).filter(
          (req: any) => req.entityType === "customer"
        );
        setUnsuspendRequests(customerRequests);
      } else {
        // If the endpoint doesn't exist or returns an error, set empty array
        setUnsuspendRequests([]);
        console.warn("Failed to load unsuspend requests:", response.status);
      }
    } catch (error) {
      console.error("Error loading unsuspend requests:", error);
      setUnsuspendRequests([]);
    } finally {
      setUnsuspendRequestsLoading(false);
    }
  };

  const processUnsuspendRequest = async (
    requestId: string,
    action: "approve" | "reject",
    notes: string = ""
  ) => {
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
        fetchUnsuspendRequests();
        loadCustomersData();
      } else {
        toast.error(`Failed to ${action} request`);
      }
    } catch (error) {
      console.error(`Error ${action}ing request:`, error);
      toast.error(`Failed to ${action} request`);
    }
  };

  const loadCustomersData = async () => {
    setLoading(true);

    try {
      const adminToken = await generateAdminToken();
      if (!adminToken) {
        toast.error("Failed to authenticate as admin");
        setLoading(false);
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/customers/grouped-by-shop`,
        {
          headers: {
            Authorization: `Bearer ${adminToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        setData(result.data);
      } else {
        const errorData = await response.json();
        console.error("Failed to load customers:", errorData);
        toast.error(errorData.error || "Failed to load customer data");

        if (response.status === 401) {
          toast.error("Session expired. Please refresh the page.");
        }
      }
    } catch (error) {
      console.error("Error loading grouped customers:", error);
      toast.error("Network error while loading customer data");
    } finally {
      setLoading(false);
    }
  };

  const toggleShopExpansion = (shopId: string) => {
    const newExpanded = new Set(expandedShops);
    if (newExpanded.has(shopId)) {
      newExpanded.delete(shopId);
    } else {
      newExpanded.add(shopId);
    }
    setExpandedShops(newExpanded);
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case "GOLD":
        return <Award className="w-4 h-4" />;
      case "SILVER":
        return <Star className="w-4 h-4" />;
      case "BRONZE":
        return <Award className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "BRONZE":
        return "bg-orange-500/10 text-orange-400 border-orange-500/20";
      case "SILVER":
        return "bg-gray-300/10 text-gray-300 border-gray-300/20";
      case "GOLD":
        return "bg-yellow-400/10 text-yellow-400 border-yellow-400/20";
      default:
        return "bg-gray-500/10 text-gray-400 border-gray-500/20";
    }
  };

  const filterCustomers = (customers: Customer[]) => {
    let filtered = [...customers];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.address.toLowerCase().includes(term) ||
          c.name?.toLowerCase().includes(term) ||
          c.email?.toLowerCase().includes(term) ||
          c.referralCode?.toLowerCase().includes(term)
      );
    }

    // Tier filter
    if (selectedTier !== "all") {
      filtered = filtered.filter((c) => c.tier === selectedTier);
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "earnings":
          comparison = a.lifetimeEarnings - b.lifetimeEarnings;
          break;
        case "transactions":
          comparison = (a.totalTransactions || 0) - (b.totalTransactions || 0);
          break;
        case "date":
          comparison =
            new Date(a.lastTransactionDate || 0).getTime() -
            new Date(b.lastTransactionDate || 0).getTime();
          break;
        case "name":
          comparison = (a.name || "").localeCompare(b.name || "");
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return filtered;
  };

  const handleMintTokens = () => {
    if (selectedCustomer) {
      onMintTokens(selectedCustomer.address, mintAmount, mintReason);
      toast.success(
        `Minted ${mintAmount} RCN to ${
          selectedCustomer.name || formatAddress(selectedCustomer.address)
        }`
      );
      setSelectedCustomer(null);
    }
  };

  const exportToCSV = () => {
    if (!data) return;

    const allCustomers = [
      ...data.shopsWithCustomers.flatMap((shop) =>
        shop.customers.map((c) => ({ ...c, shopName: shop.shopName }))
      ),
      ...data.customersWithoutShops.map((c) => ({ ...c, shopName: "No Shop" })),
    ];

    const headers = [
      "Name",
      "Address",
      "Email",
      "Shop",
      "Tier",
      "Lifetime Earnings",
      "Total Transactions",
      "Status",
      "Last Activity",
    ];
    const rows = allCustomers.map((c) => [
      c.name || "Anonymous",
      c.address,
      c.email || "",
      c.shopName,
      c.tier,
      c.lifetimeEarnings.toString(),
      (c.totalTransactions || 0).toString(),
      c.isActive ? "Active" : "Suspended",
      c.lastTransactionDate || "N/A",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `customers_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    toast.success("Customer data exported successfully");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-yellow-400 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-400">Loading customer data...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-12 border border-gray-700/50 text-center">
        <AlertCircle className="w-16 h-16 text-gray-500 mx-auto mb-4" />
        <p className="text-gray-400 text-lg">No customer data available</p>
        <button
          onClick={loadCustomersData}
          className="mt-4 px-6 py-2 bg-yellow-500 hover:bg-yellow-600 text-gray-900 rounded-lg font-medium"
        >
          Retry Loading
        </button>
      </div>
    );
  }

  const allCustomers = [
    ...data.shopsWithCustomers.flatMap((shop) => shop.customers),
    ...data.customersWithoutShops,
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <DashboardHeader
        title="Customer Management"
        subtitle="Comprehensive customer insights and management"
      />
      {/* Main Content Card */}
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
            Monitor Shops
          </p>
        </div>
        {/* Controls */}
        <div className="p-6 border-b border-gray-700/50 space-y-4">
          {/* Search and Filters */}
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search by name, address, email, or referral code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 bg-[#2F2F2F] text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {/* Filter controls - only show for customer views */}
            {viewMode !== "unsuspend-requests" && (
              <div className="flex gap-3">
                <select
                  value={selectedTier}
                  onChange={(e) => setSelectedTier(e.target.value)}
                  className="px-4 py-2 bg-[#FFCC00] border border-gray-600 rounded-3xl text-black focus:outline-none focus:border-yellow-400"
                >
                  <option value="all">All Tiers</option>
                  <option value="GOLD">Gold Tier</option>
                  <option value="SILVER">Silver Tier</option>
                  <option value="BRONZE">Bronze Tier</option>
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-4 py-2 bg-[#FFCC00] border border-gray-600 rounded-3xl text-black focus:outline-none focus:border-yellow-400"
                >
                  <option value="earnings">Sort by Earnings</option>
                  <option value="transactions">Sort by Transactions</option>
                  <option value="date">Sort by Last Activity</option>
                  <option value="name">Sort by Name</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {viewMode === "grouped" && (
            <div className="space-y-4">
              {data.shopsWithCustomers.map((shop) => {
                const isExpanded = expandedShops.has(shop.shopId);
                const filteredCustomers = filterCustomers(shop.customers);

                if (searchTerm && filteredCustomers.length === 0) return null;

                return (
                  <div
                    key={shop.shopId}
                    className="bg-[#2F2F2F] rounded-xl border border-gray-700/50 overflow-hidden"
                  >
                    <div
                      className="p-6 cursor-pointer hover:bg-gray-800/50 transition-all"
                      onClick={() => toggleShopExpansion(shop.shopId)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div
                            className={`transform transition-transform duration-200 ${
                              isExpanded ? "rotate-90" : ""
                            }`}
                          >
                            <ChevronRight className="w-6 h-6 text-yellow-400" />
                          </div>
                          <div>
                            <div className="flex items-center gap-4 mt-1">
                              <h3 className="text-xl font-bold text-white">
                                Shop Name:{" "}
                                <span className="text-[#FFCC00]">
                                  {shop.shopName}
                                </span>
                              </h3>
                            </div>
                            <div className="flex items-center gap-4 mt-1">
                              <span className="text-sm text-gray-400">
                                ID: {shop.shopId}
                              </span>
                              {shop.avgCustomerValue && (
                                <span className="text-sm text-gray-400">
                                  Avg Value: {shop.avgCustomerValue.toFixed(0)}{" "}
                                  RCN
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-center flex items-center justify-center gap-2">
                            <div className="text-2xl font-bold text-yellow-400">
                              {searchTerm
                                ? filteredCustomers.length
                                : shop.totalCustomers}
                            </div>
                            <svg
                              width="24"
                              height="24"
                              viewBox="0 0 24 24"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M12.3 12.22C12.8336 11.7581 13.2616 11.1869 13.5549 10.545C13.8482 9.90316 14 9.20571 14 8.5C14 7.17392 13.4732 5.90215 12.5355 4.96447C11.5979 4.02678 10.3261 3.5 9 3.5C7.67392 3.5 6.40215 4.02678 5.46447 4.96447C4.52678 5.90215 4 7.17392 4 8.5C3.99999 9.20571 4.1518 9.90316 4.44513 10.545C4.73845 11.1869 5.16642 11.7581 5.7 12.22C4.30014 12.8539 3.11247 13.8775 2.27898 15.1685C1.4455 16.4596 1.00147 17.9633 1 19.5C1 19.7652 1.10536 20.0196 1.29289 20.2071C1.48043 20.3946 1.73478 20.5 2 20.5C2.26522 20.5 2.51957 20.3946 2.70711 20.2071C2.89464 20.0196 3 19.7652 3 19.5C3 17.9087 3.63214 16.3826 4.75736 15.2574C5.88258 14.1321 7.4087 13.5 9 13.5C10.5913 13.5 12.1174 14.1321 13.2426 15.2574C14.3679 16.3826 15 17.9087 15 19.5C15 19.7652 15.1054 20.0196 15.2929 20.2071C15.4804 20.3946 15.7348 20.5 16 20.5C16.2652 20.5 16.5196 20.3946 16.7071 20.2071C16.8946 20.0196 17 19.7652 17 19.5C16.9985 17.9633 16.5545 16.4596 15.721 15.1685C14.8875 13.8775 13.6999 12.8539 12.3 12.22ZM9 11.5C8.40666 11.5 7.82664 11.3241 7.33329 10.9944C6.83994 10.6648 6.45542 10.1962 6.22836 9.64805C6.0013 9.09987 5.94189 8.49667 6.05764 7.91473C6.1734 7.33279 6.45912 6.79824 6.87868 6.37868C7.29824 5.95912 7.83279 5.6734 8.41473 5.55764C8.99667 5.44189 9.59987 5.5013 10.1481 5.72836C10.6962 5.95542 11.1648 6.33994 11.4944 6.83329C11.8241 7.32664 12 7.90666 12 8.5C12 9.29565 11.6839 10.0587 11.1213 10.6213C10.5587 11.1839 9.79565 11.5 9 11.5ZM18.74 11.82C19.38 11.0993 19.798 10.2091 19.9438 9.25634C20.0896 8.30362 19.9569 7.32907 19.5618 6.45C19.1666 5.57093 18.5258 4.8248 17.7165 4.30142C16.9071 3.77805 15.9638 3.49974 15 3.5C14.7348 3.5 14.4804 3.60536 14.2929 3.79289C14.1054 3.98043 14 4.23478 14 4.5C14 4.76522 14.1054 5.01957 14.2929 5.20711C14.4804 5.39464 14.7348 5.5 15 5.5C15.7956 5.5 16.5587 5.81607 17.1213 6.37868C17.6839 6.94129 18 7.70435 18 8.5C17.9986 9.02524 17.8593 9.5409 17.5961 9.99542C17.3328 10.4499 16.9549 10.8274 16.5 11.09C16.3517 11.1755 16.2279 11.2977 16.1404 11.4447C16.0528 11.5918 16.0045 11.7589 16 11.93C15.9958 12.0998 16.0349 12.2678 16.1137 12.4183C16.1924 12.5687 16.3081 12.6967 16.45 12.79L16.84 13.05L16.97 13.12C18.1754 13.6917 19.1923 14.596 19.901 15.7263C20.6096 16.8566 20.9805 18.1659 20.97 19.5C20.97 19.7652 21.0754 20.0196 21.2629 20.2071C21.4504 20.3946 21.7048 20.5 21.97 20.5C22.2352 20.5 22.4896 20.3946 22.6771 20.2071C22.8646 20.0196 22.97 19.7652 22.97 19.5C22.9782 17.9654 22.5938 16.4543 21.8535 15.1101C21.1131 13.7659 20.0413 12.6333 18.74 11.82Z"
                                fill="#FFCC00"
                              />
                            </svg>
                          </div>
                          {shop.shopRevenue && (
                            <div className="text-center">
                              <div className="text-2xl font-bold text-green-400">
                                {shop.shopRevenue.toFixed(0)}
                              </div>
                              <div className="text-xs text-gray-400">
                                Total RCN
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-gray-700/50 p-4">
                        {displayMode === "table" ? (
                          <DataTable
                            data={filteredCustomers}
                            columns={customerColumns}
                            keyExtractor={(customer) => customer.address}
                            emptyMessage="No customers found"
                            emptyIcon={
                              <AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                            }
                          />
                        ) : (
                          <CustomerGrid
                            customers={filteredCustomers}
                            onSelectCustomer={setSelectedCustomer}
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {viewMode === "all" &&
            (displayMode === "table" ? (
              <DataTable
                data={filterCustomers(allCustomers)}
                columns={customerColumns}
                keyExtractor={(customer) => customer.address}
                emptyMessage="No customers found"
                showPagination={true}
                itemsPerPage={10}
                emptyIcon={
                  <AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                }
              />
            ) : (
              <CustomerGrid
                customers={filterCustomers(allCustomers)}
                onSelectCustomer={setSelectedCustomer}
              />
            ))}

          {viewMode === "no-shop" &&
            (displayMode === "table" ? (
              <DataTable
                data={filterCustomers(data.customersWithoutShops)}
                columns={customerColumns}
                keyExtractor={(customer) => customer.address}
                emptyMessage="All customers have shop activity"
                emptyIcon={
                  <AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                }
              />
            ) : (
              <CustomerGrid
                customers={filterCustomers(data.customersWithoutShops)}
                onSelectCustomer={setSelectedCustomer}
                emptyMessage="All customers have shop activity"
              />
            ))}

          {viewMode === "unsuspend-requests" && (
            <div className="space-y-4">
              {unsuspendRequestsLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-yellow-400 border-t-transparent mx-auto mb-4"></div>
                  <p className="text-gray-400">Loading unsuspend requests...</p>
                </div>
              ) : unsuspendRequests.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400 text-lg">
                    No pending unsuspend requests
                  </p>
                </div>
              ) : (
                <div className="bg-gray-900/50 rounded-xl border border-gray-700/50">
                  <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-800/50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Customer Details
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
                      {unsuspendRequests.map((request: any) => (
                        <tr key={request.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm">
                              {request.entityDetails ? (
                                <>
                                  <div className="font-medium text-gray-200">
                                    {request.entityDetails.name || "N/A"}
                                  </div>
                                  <div className="text-gray-400 text-xs">
                                    {request.entityType === "customer"
                                      ? request.entityDetails.address
                                      : request.entityDetails.shopId}
                                  </div>
                                  {request.entityDetails.email && (
                                    <div className="text-gray-500 text-xs">
                                      {request.entityDetails.email}
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
                            ).toLocaleDateString()}
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
                                  processUnsuspendRequest(
                                    request.id,
                                    "approve"
                                  );
                                }
                              }}
                              className="text-green-400 hover:text-green-300 mr-4"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                const notes = prompt(
                                  "Rejection reason (optional):"
                                );
                                if (notes !== null) {
                                  processUnsuspendRequest(
                                    request.id,
                                    "reject",
                                    notes
                                  );
                                }
                              }}
                              className="text-red-400 hover:text-red-300"
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
          )}
        </div>
      </div>

      {/* Customer Details Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-xl p-6 max-w-2xl w-full mx-4 border border-gray-700 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-2xl font-bold text-white">
                Customer Details
              </h3>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-gray-400 hover:text-white"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl">
                  {(selectedCustomer.name || "A")[0].toUpperCase()}
                </div>
                <div className="flex-1">
                  <h4 className="text-xl font-bold text-white">
                    {selectedCustomer.name || "Anonymous Customer"}
                  </h4>
                  <p className="text-sm text-gray-400 font-mono mb-2">
                    {selectedCustomer.address}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${getTierColor(
                        selectedCustomer.tier
                      )}`}
                    >
                      {getTierIcon(selectedCustomer.tier)}
                      {selectedCustomer.tier} TIER
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                        selectedCustomer.isActive
                          ? "bg-green-500/10 text-green-400 border border-green-500/20"
                          : "bg-red-500/10 text-red-400 border border-red-500/20"
                      }`}
                    >
                      {selectedCustomer.isActive ? (
                        <CheckCircle className="w-3 h-3" />
                      ) : (
                        <XCircle className="w-3 h-3" />
                      )}
                      {selectedCustomer.isActive ? "Active" : "Suspended"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-900/50 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">
                    Lifetime Earnings
                  </p>
                  <p className="text-2xl font-bold text-yellow-400">
                    {selectedCustomer.lifetimeEarnings} RCN
                  </p>
                </div>
                <div className="bg-gray-900/50 rounded-lg p-4">
                  <p className="text-sm text-gray-400 mb-1">
                    Total Transactions
                  </p>
                  <p className="text-2xl font-bold text-blue-400">
                    {selectedCustomer.totalTransactions || 0}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {selectedCustomer.email && (
                  <div className="flex items-center gap-3 text-gray-300">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span>{selectedCustomer.email}</span>
                  </div>
                )}
                {selectedCustomer.phone && (
                  <div className="flex items-center gap-3 text-gray-300">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span>{selectedCustomer.phone}</span>
                  </div>
                )}
                {selectedCustomer.referralCode && (
                  <div className="flex items-center gap-3 text-gray-300">
                    <Hash className="w-4 h-4 text-gray-400" />
                    <span>Referral: {selectedCustomer.referralCode}</span>
                  </div>
                )}
                {selectedCustomer.joinDate && (
                  <div className="flex items-center gap-3 text-gray-300">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span>
                      Joined:{" "}
                      {new Date(selectedCustomer.joinDate).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {selectedCustomer.lastTransactionDate && (
                  <div className="flex items-center gap-3 text-gray-300">
                    <Activity className="w-4 h-4 text-gray-400" />
                    <span>
                      Last Activity:{" "}
                      {new Date(
                        selectedCustomer.lastTransactionDate
                      ).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-700 pt-4">
                <h5 className="text-lg font-semibold text-white mb-4">
                  Mint Tokens
                </h5>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Amount (RCN)
                    </label>
                    <input
                      type="number"
                      value={mintAmount}
                      onChange={(e) =>
                        setMintAmount(parseInt(e.target.value) || 0)
                      }
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Reason
                    </label>
                    <input
                      type="text"
                      value={mintReason}
                      onChange={(e) => setMintReason(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                    />
                  </div>
                  <button
                    onClick={handleMintTokens}
                    className="w-full px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-gray-900 rounded-lg font-medium flex items-center justify-center gap-2"
                  >
                    <Coins className="w-4 h-4" />
                    Mint {mintAmount} RCN
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unsuspend Request Review Modal */}
      {unsuspendReviewModal.isOpen && unsuspendReviewModal.customer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 shadow-2xl max-w-lg w-full p-6">
            <h3 className="text-xl font-bold text-white mb-4">
              {unsuspendReviewModal.action === "approve" ? "Approve" : "Reject"}{" "}
              Unsuspend Request
            </h3>

            <div className="mb-4 p-4 bg-gray-700/50 rounded-lg">
              <p className="text-sm text-gray-300 mb-2">
                <span className="font-medium text-white">Customer:</span>{" "}
                {unsuspendReviewModal.customer.name || "Anonymous"}
              </p>
              <p className="text-sm text-gray-300 mb-2">
                <span className="font-medium text-white">Address:</span>{" "}
                {formatAddress(unsuspendReviewModal.customer.address)}
              </p>
              {unsuspendReviewModal.customer.suspension_reason && (
                <p className="text-sm text-gray-300 mb-2">
                  <span className="font-medium text-white">
                    Original Suspension Reason:
                  </span>{" "}
                  {unsuspendReviewModal.customer.suspension_reason}
                </p>
              )}
              {unsuspendReviewModal.customer.unsuspendRequest && (
                <>
                  <p className="text-sm text-gray-300 mb-2">
                    <span className="font-medium text-white">
                      Request Reason:
                    </span>{" "}
                    {
                      unsuspendReviewModal.customer.unsuspendRequest
                        .requestReason
                    }
                  </p>
                  <p className="text-sm text-gray-300">
                    <span className="font-medium text-white">Submitted:</span>{" "}
                    {new Date(
                      unsuspendReviewModal.customer.unsuspendRequest.createdAt
                    ).toLocaleString()}
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
                    customer: null,
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
                  const customer = unsuspendReviewModal.customer;

                  if (
                    unsuspendReviewModal.action === "approve" &&
                    onUnsuspendCustomer
                  ) {
                    await onUnsuspendCustomer(customer!.address);
                    toast.success("Unsuspend request approved");
                  } else {
                    // For reject, we might need a separate API endpoint
                    toast.success("Unsuspend request rejected");
                  }

                  setUnsuspendReviewModal({
                    isOpen: false,
                    customer: null,
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

// Customer Table Component

// Customer Grid Component
const CustomerGrid: React.FC<{
  customers: Customer[];
  onSelectCustomer?: (customer: Customer) => void;
  emptyMessage?: string;
}> = ({ customers, onSelectCustomer, emptyMessage = "No customers found" }) => {
  const getTierColor = (tier: string) => {
    switch (tier) {
      case "BRONZE":
        return "from-orange-500 to-orange-600";
      case "SILVER":
        return "from-gray-400 to-gray-500";
      case "GOLD":
        return "from-yellow-400 to-yellow-500";
      default:
        return "from-gray-500 to-gray-600";
    }
  };

  if (customers.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-4" />
        <p className="text-gray-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {customers.map((customer) => (
        <div
          key={customer.address}
          className="bg-gray-900/50 rounded-xl p-4 border border-gray-700/50 hover:border-yellow-400/50 transition-all cursor-pointer"
          onClick={() => onSelectCustomer?.(customer)}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
              {(customer.name || "A")[0].toUpperCase()}
            </div>
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium bg-gradient-to-r ${getTierColor(
                customer.tier
              )} text-white`}
            >
              {customer.tier}
            </span>
          </div>

          <h4 className="font-medium text-white mb-1">
            {customer.name || "Anonymous"}
          </h4>
          <p className="text-xs text-gray-400 font-mono mb-3">
            {customer.address.slice(0, 10)}...{customer.address.slice(-8)}
          </p>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Earnings</span>
              <span className="text-yellow-400 font-medium">
                {customer.lifetimeEarnings} RCN
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Transactions</span>
              <span className="text-white">
                {customer.totalTransactions || 0}
              </span>
            </div>
            {customer.isActive ? (
              <div className="flex items-center gap-1 text-green-400 text-xs">
                <CheckCircle className="w-3 h-3" />
                <span>Active Account</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-red-400 text-xs">
                <XCircle className="w-3 h-3" />
                <span>Suspended</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
