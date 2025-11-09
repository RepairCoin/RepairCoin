"use client";

import React, { useState, useEffect } from "react";
import { authManager } from "@/utils/auth";
import { toast } from "react-hot-toast";
import { StatCard } from "@/components/ui/StatCard";
import { DataTable, Column } from "@/components/ui/DataTable";
import {
  Users,
  Search,
  Filter,
  TrendingUp,
  Award,
  Calendar,
  Star,
  Wallet,
  Activity,
  ChevronDown,
  ChevronUp,
  UserCheck,
  Clock,
  Zap,
  Target,
  Trophy,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Gift,
  Crown,
  Shield,
  DollarSign,
  Hash,
  Mail,
  Phone,
  MapPin,
  MoreVertical,
  Eye,
  Send,
  ChevronRight,
} from "lucide-react";
import { WalletIcon, LookupIcon } from "../../icon/index";

interface Customer {
  address: string;
  name?: string;
  tier: "BRONZE" | "SILVER" | "GOLD";
  lifetimeEarnings: number;
  lastTransactionDate?: string;
  totalTransactions: number;
  isRegular: boolean;
}

interface CustomersTabProps {
  shopId: string;
  shopToken?: string;
}

interface GrowthStats {
  totalCustomers: number;
  newCustomers: number;
  growthPercentage: number;
  regularCustomers: number;
  regularGrowthPercentage: number;
  activeCustomers: number;
  activeGrowthPercentage: number;
  averageEarningsPerCustomer: number;
  avgEarningsGrowthPercentage: number;
  periodLabel: string;
}

export const CustomersTab: React.FC<CustomersTabProps> = ({
  shopId,
  shopToken,
}) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [tierFilter, setTierFilter] = useState<
    "all" | "BRONZE" | "SILVER" | "GOLD"
  >("all");
  const [sortBy, setSortBy] = useState<"recent" | "earnings" | "transactions">(
    "recent"
  );
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null
  );
  const [growthStats, setGrowthStats] = useState<GrowthStats | null>(null);
  const [growthPeriod, setGrowthPeriod] = useState<"7d" | "30d" | "90d">("7d");

  // Define columns for DataTable
  const customerColumns: Column<Customer>[] = [
    {
      key: "customer",
      header: "Customer",
      sortable: true,
      accessor: (customer) => (
        <div className="flex items-center gap-3">
          <div>
            <p className="font-semibold text-white">
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
          className={`px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r ${getTierColor(
            customer.tier
          )} text-white`}
        >
          {customer.tier}
        </span>
      ),
    },
    {
      key: "lifetimeEarnings",
      header: "Lifetime RCN",
      sortable: true,
      accessor: (customer) => (
        <div className="flex items-center gap-2">
          <p className="font-semibold text-[#FFCC00]">
            {customer.lifetimeEarnings}
          </p>
          <span className="text-xs text-gray-400">RCN</span>
        </div>
      ),
    },
    {
      key: "totalTransactions",
      header: "Transactions",
      sortable: true,
      accessor: (customer) => (
        <div className="flex items-center gap-2">
          <p className="font-semibold text-white">
            {customer.totalTransactions}
          </p>
          {customer.isRegular && (
            <Star className="w-4 h-4 text-green-400" />
          )}
        </div>
      ),
    },
  ];

  useEffect(() => {
    loadCustomers();
    loadGrowthStats();
  }, [shopId, shopToken]);

  useEffect(() => {
    if (shopId && shopToken) {
      loadGrowthStats();
    }
  }, [growthPeriod]);

  const loadCustomers = async () => {
    setLoading(true);

    try {
      const token = shopToken || authManager.getToken("shop");

      if (!token) {
        toast.error("Please authenticate to view customers");
        setCustomers([]);
        setLoading(false);
        return;
      }

      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/shops/${shopId}/customers?limit=100`,
        {
          headers,
        }
      );

      if (response.ok) {
        const result = await response.json();
        const customerData = result.data?.customers || [];

        const transformedCustomers = customerData.map((c: any) => ({
          address: c.address || c.customer_address,
          name: c.name || c.customer_name,
          tier: c.tier || "BRONZE",
          lifetimeEarnings: c.lifetime_earnings || c.lifetimeEarnings || 0,
          lastTransactionDate:
            c.last_transaction_date ||
            c.lastTransactionDate ||
            c.last_earned_date,
          totalTransactions: c.total_transactions || c.transaction_count || 0,
          isRegular: (c.total_transactions || c.transaction_count || 0) >= 5,
        }));

        setCustomers(transformedCustomers);
      } else if (response.status === 401) {
        authManager.clearToken("shop");
        toast.error("Session expired. Please sign in again.");
        setCustomers([]);
      } else {
        console.warn("Shop customers endpoint failed");
        setCustomers([]);
      }
    } catch (error) {
      console.error("Error loading customers:", error);
      toast.error("Failed to load customers");
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const loadGrowthStats = async () => {
    try {
      const token = shopToken || authManager.getToken("shop");

      if (!token) {
        return;
      }

      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/shops/${shopId}/customer-growth?period=${growthPeriod}`,
        { headers }
      );

      if (response.ok) {
        const result = await response.json();
        setGrowthStats(result.data);
      } else {
        console.warn("Failed to load growth statistics");
      }
    } catch (error) {
      console.error("Error loading growth stats:", error);
    }
  };

  const filteredCustomers = customers
    .filter((customer) => {
      const matchesSearch =
        searchTerm === "" ||
        customer.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesTier = tierFilter === "all" || customer.tier === tierFilter;
      return matchesSearch && matchesTier;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "earnings":
          return b.lifetimeEarnings - a.lifetimeEarnings;
        case "transactions":
          return b.totalTransactions - a.totalTransactions;
        case "recent":
        default:
          return (
            new Date(b.lastTransactionDate || 0).getTime() -
            new Date(a.lastTransactionDate || 0).getTime()
          );
      }
    });

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "GOLD":
        return "from-yellow-500 to-yellow-600";
      case "SILVER":
        return "from-gray-400 to-gray-500";
      case "BRONZE":
        return "from-orange-500 to-orange-600";
      default:
        return "from-gray-400 to-gray-500";
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case "GOLD":
        return <Crown className="w-4 h-4" />;
      case "SILVER":
        return <Shield className="w-4 h-4" />;
      case "BRONZE":
        return <Award className="w-4 h-4" />;
      default:
        return <Award className="w-4 h-4" />;
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getActivityStatus = (lastDate?: string) => {
    if (!lastDate)
      return { status: "inactive", label: "Never", color: "text-gray-500" };

    const daysSince = Math.floor(
      (Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSince === 0)
      return { status: "active", label: "Today", color: "text-green-400" };
    if (daysSince === 1)
      return { status: "active", label: "Yesterday", color: "text-green-400" };
    if (daysSince <= 7)
      return {
        status: "recent",
        label: `${daysSince} days ago`,
        color: "text-yellow-400",
      };
    if (daysSince <= 30)
      return {
        status: "moderate",
        label: `${Math.floor(daysSince / 7)} weeks ago`,
        color: "text-orange-400",
      };
    return {
      status: "inactive",
      label: `${Math.floor(daysSince / 30)} months ago`,
      color: "text-gray-500",
    };
  };

  // Calculate statistics
  const totalEarnings = customers.reduce(
    (sum, c) => sum + c.lifetimeEarnings,
    0
  );
  const avgEarningsPerCustomer =
    customers.length > 0 ? Math.round(totalEarnings / customers.length) : 0;
  const totalTransactions = customers.reduce(
    (sum, c) => sum + c.totalTransactions,
    0
  );
  const regularCustomers = customers.filter((c) => c.isRegular).length;
  const goldCustomers = customers.filter((c) => c.tier === "GOLD").length;
  const activeThisWeek = customers.filter((c) => {
    const lastTransaction = new Date(c.lastTransactionDate || 0);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return lastTransaction > weekAgo;
  }).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Total Customers"
          value={growthStats?.totalCustomers || customers.length}
          subtitle="All registered customers"
          icon={<WalletIcon />}
        />

        <StatCard
          title="Regular Customers"
          value={growthStats?.regularCustomers || regularCustomers}
          subtitle="Repeat customers"
          icon={<WalletIcon />}
        />

        <StatCard
          title="Avg. RCN per Customer"
          value={
            growthStats?.averageEarningsPerCustomer || avgEarningsPerCustomer
          }
          subtitle="Average earnings"
          icon={<WalletIcon />}
        />

        <StatCard
          title="Active This Week"
          value={growthStats?.activeCustomers || activeThisWeek}
          subtitle="Recent activity"
          icon={<WalletIcon />}
        />
      </div>

      {/* Combined Customer Display Container */}
      <div className="bg-[#212121] rounded-3xl">
        <div
          className="w-full flex gap-2 px-4 md:px-8 py-4 text-white rounded-t-3xl"
          style={{
            backgroundImage: `url('/img/cust-ref-widget3.png')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          <LookupIcon width={24} height={24} color={"black"} />
          <p className="text-base sm:text-lg md:text-xl text-gray-900 font-semibold">
            Find Customer
          </p>
        </div>
        {/* Search and Filters */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Search customers by name or wallet..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-3 bg-[#2F2F2F] text-white rounded-xl transition-all pl-10"
              />
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            </div>

            <div className="flex gap-3">
              <div className="relative">
                <select
                  value={tierFilter}
                  onChange={(e) => setTierFilter(e.target.value as any)}
                  className="appearance-none px-4 py-3 pr-10 bg-[#FFCC00] border border-gray-700 text-black rounded-xl focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent cursor-pointer"
                >
                  <option value="all">All Tiers</option>
                  <option value="BRONZE">Bronze Tier</option>
                  <option value="SILVER">Silver Tier</option>
                  <option value="GOLD">Gold Tier</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-black w-4 h-4 pointer-events-none" />
              </div>

              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="appearance-none px-4 py-3 pr-10 bg-[#FFCC00] border border-gray-700 text-black rounded-xl focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent cursor-pointer"
                >
                  <option value="recent">Most Recent</option>
                  <option value="earnings">Highest Earnings</option>
                  <option value="transactions">Most Active</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-black w-4 h-4 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Customers Display */}
        {loading ? (
          <div className="p-12">
            <div className="flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFCC00] mb-4"></div>
              <p className="text-gray-400">Loading customers...</p>
            </div>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-12">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-800 rounded-full mb-4">
                <Search className="w-10 h-10 text-gray-600" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                No customers found
              </h3>
              <p className="text-gray-400">
                Try adjusting your search or filters
              </p>
            </div>
          </div>
        ) : (
          <DataTable
            data={filteredCustomers}
            columns={customerColumns}
            keyExtractor={(customer) => customer.address}
            onRowClick={(customer) => setSelectedCustomer(customer)}
            emptyMessage="No customers found"
            emptyIcon={
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-800 rounded-full mb-4">
                <Search className="w-10 h-10 text-gray-600" />
              </div>
            }
            loading={loading}
            showPagination={true}
            itemsPerPage={10}
            className="p-6"
          />
        )}
      </div>
    </div>
  );
};
