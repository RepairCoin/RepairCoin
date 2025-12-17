"use client";

import React, { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import apiClient from "@/services/api/client";
import {
  Users,
  Search,
  UserCheck,
  Coins,
  UserSearch,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

// Stat Card Component matching Figma design
const CustomerStatCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ReactNode;
  suffix?: string;
}> = ({ title, value, icon, suffix }) => (
  <div className="bg-[#101010] rounded-[20px] p-5 h-[97px] flex items-center gap-4">
    <div className="w-[34px] h-[34px] rounded-full bg-[#FFCC00] flex items-center justify-center flex-shrink-0">
      {icon}
    </div>
    <div className="flex flex-col">
      <p className="text-sm font-medium text-white tracking-[-0.28px] leading-6">
        {title}
      </p>
      <p className="text-2xl font-bold text-white tracking-[-0.48px] leading-8">
        {value}{suffix && ` ${suffix}`}
      </p>
    </div>
  </div>
);

// Tier Badge Component
const TierBadge: React.FC<{ tier: "BRONZE" | "SILVER" | "GOLD" }> = ({ tier }) => {
  const tierStyles = {
    GOLD: "bg-[#FFCC00] text-[#101010]",
    SILVER: "bg-[#E8E8E8] text-[#101010]",
    BRONZE: "bg-[#CE8946] text-[#101010]",
  };

  return (
    <span
      className={`inline-flex items-center justify-center px-4 py-1 rounded-[10px] text-sm font-semibold w-[90px] ${tierStyles[tier]}`}
    >
      {tier}
    </span>
  );
};

export const CustomersTab: React.FC<CustomersTabProps> = ({ shopId }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [tierFilter, setTierFilter] = useState<
    "all" | "BRONZE" | "SILVER" | "GOLD"
  >("all");
  const [sortBy, setSortBy] = useState<"recent" | "earnings" | "transactions">(
    "recent"
  );
  const [growthStats, setGrowthStats] = useState<GrowthStats | null>(null);
  const [growthPeriod] = useState<"7d" | "30d" | "90d">("7d");

  useEffect(() => {
    loadCustomers();
    loadGrowthStats();
  }, [shopId]);

  useEffect(() => {
    if (shopId) {
      loadGrowthStats();
    }
  }, [growthPeriod]);

  const loadCustomers = async () => {
    setLoading(true);

    try {
      const result = await apiClient.get(`/shops/${shopId}/customers?limit=100`);

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
    } catch (error: any) {
      console.error("Error loading customers:", error);

      if (error?.response?.status === 401) {
        toast.error("Session expired. Please sign in again.");
      } else {
        toast.error("Failed to load customers");
      }
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const loadGrowthStats = async () => {
    try {
      const result = await apiClient.get(
        `/shops/${shopId}/customer-growth?period=${growthPeriod}`
      );
      setGrowthStats(result.data);
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

  const formatAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  // Calculate statistics
  const totalEarnings = customers.reduce(
    (sum, c) => sum + c.lifetimeEarnings,
    0
  );
  const avgEarningsPerCustomer =
    customers.length > 0 ? Math.round(totalEarnings / customers.length) : 0;
  const regularCustomers = customers.filter((c) => c.isRegular).length;
  const activeThisWeek = customers.filter((c) => {
    const lastTransaction = new Date(c.lastTransactionDate || 0);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return lastTransaction > weekAgo;
  }).length;

  return (
    <div className="space-y-6">
      {/* Stats Overview - 4 cards in a row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <CustomerStatCard
          title="Total Customers"
          value={growthStats?.totalCustomers || customers.length}
          icon={<Users className="w-5 h-5 text-[#101010]" />}
        />
        <CustomerStatCard
          title="Regular Customers"
          value={growthStats?.regularCustomers || regularCustomers}
          icon={<Users className="w-5 h-5 text-[#101010]" />}
        />
        <CustomerStatCard
          title="Avg RCN per Customer"
          value={growthStats?.averageEarningsPerCustomer || avgEarningsPerCustomer}
          icon={<Coins className="w-5 h-5 text-[#101010]" />}
          suffix="RCN"
        />
        <CustomerStatCard
          title="Active This Week"
          value={growthStats?.activeCustomers || activeThisWeek}
          icon={<UserCheck className="w-5 h-5 text-[#101010]" />}
        />
      </div>

      {/* Find Customer Container */}
      <div className="bg-[#101010] rounded-[20px] overflow-hidden">
        {/* Header */}
        <div className="px-7 py-6 border-b border-[#303236]">
          <div className="flex items-center gap-3">
            <UserSearch className="w-6 h-6 text-[#FFCC00]" />
            <h2 className="text-base font-semibold text-[#FFCC00]">
              Find Customer
            </h2>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="px-7 py-5 border-b border-[#303236]">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search Input */}
            <div className="flex-1 relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                <Search className="w-5 h-5 text-[#979797]" />
              </div>
              <input
                type="text"
                placeholder="Search customer by name or wallet address..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-[35px] pl-10 pr-4 bg-white border border-[#E2E8F0] rounded text-sm text-[#101010] placeholder:text-[#979797] focus:outline-none focus:ring-2 focus:ring-[#FFCC00] focus:border-transparent shadow-sm"
              />
            </div>

            {/* Filters */}
            <div className="flex gap-3">
              <Select
                value={tierFilter}
                onValueChange={(value) => setTierFilter(value as any)}
              >
                <SelectTrigger className="w-[112px] h-[35px] bg-white border-[#CBD5E1] rounded-lg text-sm">
                  <SelectValue placeholder="All Tiers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  <SelectItem value="BRONZE">Bronze</SelectItem>
                  <SelectItem value="SILVER">Silver</SelectItem>
                  <SelectItem value="GOLD">Gold</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={sortBy}
                onValueChange={(value) => setSortBy(value as any)}
              >
                <SelectTrigger className="w-[200px] h-[35px] bg-white border-[#CBD5E1] rounded-lg text-sm">
                  <SelectValue placeholder="Most Recent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Most Recent</SelectItem>
                  <SelectItem value="earnings">Highest Earnings</SelectItem>
                  <SelectItem value="transactions">Most Active</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Table Header */}
        <div className="bg-black px-7 py-4">
          <div className="grid grid-cols-4 gap-4">
            <p className="text-sm font-semibold text-white">CUSTOMER</p>
            <p className="text-sm font-semibold text-white">TIER</p>
            <p className="text-sm font-semibold text-white">LIFETIME RCN</p>
            <p className="text-sm font-semibold text-white">TRANSACTIONS</p>
          </div>
        </div>

        {/* Table Content */}
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
                {searchTerm || tierFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : "Your customers will appear here once they start transacting"}
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-[rgba(229,234,238,0.55)]">
            {filteredCustomers.map((customer) => (
              <div
                key={customer.address}
                className="px-7 py-4 hover:bg-[#1a1a1a] transition-colors"
              >
                <div className="grid grid-cols-4 gap-4 items-center">
                  {/* Customer Info */}
                  <div className="flex flex-col">
                    <p className="text-sm font-semibold text-white">
                      {customer.name || "John Doe"}
                    </p>
                    <p className="text-sm font-medium text-white/55">
                      {formatAddress(customer.address)}
                    </p>
                  </div>

                  {/* Tier Badge */}
                  <div>
                    <TierBadge tier={customer.tier} />
                  </div>

                  {/* Lifetime RCN */}
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {customer.lifetimeEarnings} RCN
                    </p>
                  </div>

                  {/* Transactions */}
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {customer.totalTransactions}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
