"use client";

import React, { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import {
  Store,
  Search,
  ChevronRight,
  Download,
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
  Layers,
  Grid3X3,
  UserCheck,
  Star,
} from "lucide-react";
import { DashboardHeader } from "@/components/ui/DashboardHeader";
import { DataTable, Column } from "@/components/ui/DataTable";

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
  generateAdminToken: () => Promise<string | null>;
  onMintTokens: (address: string, amount: number, reason: string) => void;
  onRefresh: () => void;
}

export const CustomersTabEnhanced: React.FC<CustomersTabEnhancedProps> = ({
  generateAdminToken,
  onMintTokens,
}) => {
  const [data, setData] = useState<GroupedCustomersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedShops, setExpandedShops] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"grouped" | "all" | "no-shop">(
    "grouped"
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

  // Define table columns for customers
  const customerColumns: Column<Customer>[] = [
    {
      key: "customer",
      header: "Customer",
      sortable: true,
      accessor: (customer) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold">
            {(customer.name || "A")[0].toUpperCase()}
          </div>
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
      key: "activity",
      header: "Activity",
      sortable: true,
      accessor: (customer) => (
        <div className="text-sm">
          <p className="text-gray-300">
            {customer.totalTransactions || 0} transactions
          </p>
          {customer.lastTransactionDate && (
            <p className="text-xs text-gray-400">
              Last:{" "}
              {new Date(customer.lastTransactionDate).toLocaleDateString()}
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
        icon={UserCheck}
      />
      {/* Main Content Card */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700/50">
        {/* Controls */}
        <div className="p-6 border-b border-gray-700/50 space-y-4">
          {/* View Mode Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode("grouped")}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  viewMode === "grouped"
                    ? "bg-yellow-500 text-gray-900"
                    : "bg-gray-700/50 text-gray-300 hover:bg-gray-600"
                }`}
              >
                <Layers className="w-4 h-4 inline mr-2" />
                Grouped by Shop
              </button>
              <button
                onClick={() => setViewMode("all")}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  viewMode === "all"
                    ? "bg-yellow-500 text-gray-900"
                    : "bg-gray-700/50 text-gray-300 hover:bg-gray-600"
                }`}
              >
                <Grid3X3 className="w-4 h-4 inline mr-2" />
                All Customers
              </button>
            </div>
            {/* <button
              onClick={exportToCSV}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button> */}
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, address, email, or referral code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-yellow-400"
              />
            </div>

            <div className="flex gap-3">
              <select
                value={selectedTier}
                onChange={(e) => setSelectedTier(e.target.value)}
                className="px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-yellow-400"
              >
                <option value="all">All Tiers</option>
                <option value="GOLD">Gold Tier</option>
                <option value="SILVER">Silver Tier</option>
                <option value="BRONZE">Bronze Tier</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-yellow-400"
              >
                <option value="earnings">Sort by Earnings</option>
                <option value="transactions">Sort by Transactions</option>
                <option value="date">Sort by Last Activity</option>
                <option value="name">Sort by Name</option>
              </select>
            </div>
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
                    className="bg-gray-900/50 rounded-xl border border-gray-700/50 overflow-hidden"
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
                          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                            <Store className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-white">
                              {shop.shopName}
                            </h3>
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
                          <div className="text-center">
                            <div className="text-2xl font-bold text-yellow-400">
                              {searchTerm
                                ? filteredCustomers.length
                                : shop.totalCustomers}
                            </div>
                            <div className="text-xs text-gray-400">
                              Customers
                            </div>
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
