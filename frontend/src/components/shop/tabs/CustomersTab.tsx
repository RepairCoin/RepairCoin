"use client";

import React, { useState, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";
import apiClient from "@/services/api/client";
import QrScanner from "qr-scanner";
import {
  Users,
  Search,
  UserCheck,
  Coins,
  UserSearch,
  Camera,
  X,
  Loader2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LookupIcon } from "@/components/icon";
import CustomerCard from "@/components/shop/customers/CustomerCard";
import { CustomerDetailsModal } from "@/components/shop/customers/CustomerDetailsModal";

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

// Search result from API
interface CustomerSearchResult {
  address: string;
  name?: string;
  tier: "BRONZE" | "SILVER" | "GOLD";
  lifetime_earnings: number;
  last_transaction_date?: string;
  total_transactions: number;
  isActive: boolean;
  suspended?: boolean;
}

// Search state
interface SearchState {
  query: string;
  results: CustomerSearchResult[];
  totalResults: number;
  isLoading: boolean;
  error: string | null;
  hasSearched: boolean;
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
  // View mode state
  const [viewMode, setViewMode] = useState<"my-customers" | "search-all">("my-customers");

  // My Customers state
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

  // Search All Customers state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchState, setSearchState] = useState<SearchState>({
    query: "",
    results: [],
    totalResults: 0,
    isLoading: false,
    error: null,
    hasSearched: false,
  });
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [qrScanner, setQrScanner] = useState<QrScanner | null>(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

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

  // Search All Customers functions
  const searchCustomers = async (query?: string) => {
    const searchTerm = query ?? searchQuery;

    if (!searchTerm.trim()) {
      setSearchState(prev => ({
        ...prev,
        error: "Please enter a customer name or wallet address",
        hasSearched: true,
      }));
      return;
    }

    setSearchState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/customers?search=${encodeURIComponent(searchTerm)}&page=1&limit=50`,
        {
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to search customers");
      }

      const data = await response.json();

      const customers = (data.data.customers || []).map((c: {
        address: string;
        name?: string;
        tier?: string;
        lifetimeEarnings?: number;
        currentBalance?: number;
        lastEarnedDate?: string;
        isActive?: boolean;
      }) => ({
        address: c.address,
        name: c.name,
        tier: c.tier || "BRONZE",
        lifetime_earnings: c.lifetimeEarnings || 0,
        last_transaction_date: c.lastEarnedDate,
        total_transactions: 0,
        isActive: c.isActive !== false,
        suspended: false,
      }));

      setSearchState({
        query: searchTerm,
        results: customers,
        totalResults: data.data.pagination?.total || customers.length,
        isLoading: false,
        error: null,
        hasSearched: true,
      });
    } catch (error) {
      console.error("Search error:", error);
      setSearchState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to search customers",
        hasSearched: true,
      }));
    }
  };

  const handleViewProfile = (address: string) => {
    setSelectedCustomer(address);
  };

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast.success("Wallet address copied!");
  };

  const startQRScanner = async () => {
    try {
      setShowQRScanner(true);
      setCameraLoading(true);

      await new Promise((resolve) => setTimeout(resolve, 100));

      if (!videoRef.current) {
        throw new Error("Video element not ready");
      }

      const scanner = new QrScanner(
        videoRef.current,
        (result) => {
          const scannedText = result.data;
          console.log("QR scan result:", scannedText);

          const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
          if (ethAddressRegex.test(scannedText)) {
            setSearchQuery(scannedText);
            stopQRScanner();
            toast.success("Wallet address scanned successfully!");
            setTimeout(() => {
              searchCustomers(scannedText);
            }, 500);
          } else {
            toast.error("Invalid wallet address in QR code");
          }
        },
        {
          highlightScanRegion: true,
          highlightCodeOutline: true,
          preferredCamera: "environment",
        }
      );

      setQrScanner(scanner);

      try {
        await scanner.start();
        setCameraLoading(false);
      } catch (startError: unknown) {
        console.error("Scanner start error:", startError);

        const error = startError as { name?: string };
        if (error.name === "NotAllowedError") {
          toast.error(
            "Camera permission denied. Please allow camera access in your browser settings."
          );
        } else if (error.name === "NotFoundError") {
          toast.error("No camera found on this device.");
        } else if (error.name === "NotReadableError") {
          toast.error("Camera is already in use by another application.");
        } else {
          toast.error("Failed to start camera. Please try again.");
        }

        setShowQRScanner(false);
        setQrScanner(null);
        setCameraLoading(false);
      }
    } catch (error) {
      console.error("Error initializing QR scanner:", error);
      toast.error("Failed to initialize camera. Please try again.");
      setShowQRScanner(false);
      setCameraLoading(false);
    }
  };

  const stopQRScanner = () => {
    if (qrScanner) {
      qrScanner.stop();
      qrScanner.destroy();
      setQrScanner(null);
    }

    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => {
        track.stop();
        console.log("Camera track stopped:", track.kind);
      });
      videoRef.current.srcObject = null;
    }

    setShowQRScanner(false);
    setCameraLoading(false);
  };

  useEffect(() => {
    return () => {
      if (qrScanner) {
        qrScanner.stop();
        qrScanner.destroy();
      }
    };
  }, [qrScanner]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      searchCustomers();
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
      {/* View Mode Toggle */}
      <div className="bg-[#101010] rounded-[20px] p-2 inline-flex gap-2">
        <button
          onClick={() => setViewMode("my-customers")}
          className={`px-6 py-3 rounded-[14px] font-semibold text-sm transition-all ${
            viewMode === "my-customers"
              ? "bg-[#FFCC00] text-[#101010]"
              : "text-white hover:bg-[#1a1a1a]"
          }`}
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            My Customers
          </div>
        </button>
        <button
          onClick={() => setViewMode("search-all")}
          className={`px-6 py-3 rounded-[14px] font-semibold text-sm transition-all ${
            viewMode === "search-all"
              ? "bg-[#FFCC00] text-[#101010]"
              : "text-white hover:bg-[#1a1a1a]"
          }`}
        >
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4" />
            Search All Customers
          </div>
        </button>
      </div>

      {/* My Customers View */}
      {viewMode === "my-customers" && (
        <>
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
            <p className="text-sm font-semibold text-white">EARNED AT YOUR SHOP</p>
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
        </>
      )}

      {/* Search All Customers View */}
      {viewMode === "search-all" && (
        <div className="bg-[#101010] rounded-xl border border-gray-800">
          {/* Header */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-800">
            <div className="text-[#FFCC00]">
              <LookupIcon width={24} height={24} color="#FFCC00" />
            </div>
            <h2 className="text-lg font-semibold text-[#FFCC00]">
              Customer Lookup
            </h2>
          </div>

          {/* Search Input */}
          <div className="flex flex-col sm:flex-row items-center gap-3 px-6 py-5">
            <div className="w-full flex-1 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter customer name or wallet address..."
                className="w-full px-4 py-2.5 bg-white text-gray-900 rounded-lg transition-all pl-10 pr-4 focus:ring-2 focus:ring-[#FFCC00] focus:outline-none placeholder:text-gray-500"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={startQRScanner}
                disabled={searchState.isLoading}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-[#1a1a1a] border border-gray-600 text-white hover:bg-[#2a2a2a] font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                title="Scan customer's QR code"
              >
                <Camera className="w-4 h-4" />
                <span>Scan QR</span>
              </button>

              <button
                onClick={() => searchCustomers()}
                disabled={searchState.isLoading || !searchQuery.trim()}
                className="flex-1 sm:flex-none px-5 py-2.5 bg-[#FFCC00] border border-gray-600 text-black hover:bg-[#e6b800] font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {searchState.isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Searching...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Search</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Error Display */}
          {searchState.error && (
            <div className="px-6 pb-4">
              <div className="bg-red-900 bg-opacity-20 border border-red-500 rounded-lg p-4">
                <div className="flex items-center">
                  <svg
                    className="w-5 h-5 text-red-500 mr-3"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <p className="text-red-400">{searchState.error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Results Section */}
          <div className="px-6 pb-6">
            {/* Results Header */}
            {searchState.hasSearched && !searchState.error && (
              <div className="mb-4">
                <h3 className="text-white text-lg font-semibold">Results</h3>
                {searchState.results.length > 0 ? (
                  <p className="text-gray-400 text-sm">
                    {searchState.totalResults} match{searchState.totalResults !== 1 ? "es" : ""} for &quot;{searchState.query}&quot;
                  </p>
                ) : (
                  <p className="text-gray-400 text-sm">
                    No customers found matching &quot;{searchState.query}&quot;
                  </p>
                )}
              </div>
            )}

            {/* Loading State */}
            {searchState.isLoading && (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="bg-[#212121] border border-gray-800 rounded-lg p-4 animate-pulse"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gray-700 rounded-full" />
                      <div className="flex-1">
                        <div className="h-5 bg-gray-700 rounded w-1/3 mb-2" />
                        <div className="h-4 bg-gray-700 rounded w-1/4 mb-2" />
                        <div className="h-4 bg-gray-700 rounded w-2/3" />
                      </div>
                      <div className="text-right">
                        <div className="h-4 bg-gray-700 rounded w-16 mb-2" />
                        <div className="h-6 bg-gray-700 rounded w-12" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Customer Cards List */}
            {!searchState.isLoading && searchState.results.length > 0 && (
              <div className="space-y-3">
                {searchState.results.map((customer) => (
                  <CustomerCard
                    key={customer.address}
                    customer={customer}
                    onViewProfile={handleViewProfile}
                    onCopyAddress={handleCopyAddress}
                  />
                ))}
              </div>
            )}

            {/* Empty State - No Search Yet */}
            {!searchState.hasSearched && !searchState.isLoading && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="w-8 h-8 text-gray-600" />
                </div>
                <h3 className="text-white text-lg font-medium mb-2">
                  Search for Customers
                </h3>
                <p className="text-gray-400 text-sm max-w-md mx-auto">
                  Enter a customer name or wallet address to find their profile and view their RCN balance.
                </p>
              </div>
            )}

            {/* Empty State - No Results */}
            {searchState.hasSearched && !searchState.isLoading && searchState.results.length === 0 && !searchState.error && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-gray-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-white text-lg font-medium mb-2">
                  No Customers Found
                </h3>
                <p className="text-gray-400 text-sm max-w-md mx-auto">
                  No customers match your search for &quot;{searchState.query}&quot;. Try a different name or wallet address.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* QR Scanner Modal */}
      {showQRScanner && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#101010] rounded-xl p-6 max-w-md w-full border border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Camera className="w-6 h-6 text-[#FFCC00]" />
                Scan Customer QR Code
              </h3>
              <button
                onClick={stopQRScanner}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <div className="relative rounded-xl overflow-hidden bg-black">
              <video
                ref={videoRef}
                className="w-full h-64 object-cover rounded-xl"
                playsInline
                muted
              />
              {cameraLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70">
                  <div className="text-center">
                    <svg
                      className="animate-spin h-12 w-12 text-[#FFCC00] mx-auto mb-3"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <p className="text-white text-sm">Starting camera...</p>
                  </div>
                </div>
              )}
              {!cameraLoading && (
                <div className="absolute inset-0 border-2 border-[#FFCC00] rounded-xl">
                  <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-[#FFCC00]"></div>
                  <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-[#FFCC00]"></div>
                  <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-[#FFCC00]"></div>
                  <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-[#FFCC00]"></div>
                </div>
              )}
            </div>

            <p className="text-gray-400 text-sm mt-4 text-center">
              Position the customer&apos;s QR code within the frame to scan
              their wallet address
            </p>

            <button
              onClick={stopQRScanner}
              className="w-full mt-4 px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
            >
              Cancel Scan
            </button>
          </div>
        </div>
      )}

      {/* Customer Details Modal */}
      {selectedCustomer && (
        <CustomerDetailsModal
          customerAddress={selectedCustomer}
          shopId={shopId}
          onClose={() => setSelectedCustomer(null)}
        />
      )}
    </div>
  );
};
