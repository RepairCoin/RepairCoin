"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { Users, Search, Sparkles, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import * as shopGroupsAPI from "../../../services/api/affiliateShopGroups";

interface GroupCustomersTabProps {
  groupId: string;
}

export default function GroupCustomersTab({ groupId }: GroupCustomersTabProps) {
  const [customers, setCustomers] = useState<shopGroupsAPI.CustomerAffiliateGroupBalance[]>([]);
  const [group, setGroup] = useState<shopGroupsAPI.AffiliateShopGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const limit = 20;

  useEffect(() => {
    loadData();
  }, [groupId, currentPage, searchQuery]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [groupData, customersResponse] = await Promise.all([
        shopGroupsAPI.getGroup(groupId),
        shopGroupsAPI.getGroupCustomers(groupId, {
          page: currentPage,
          limit,
          search: searchQuery || undefined,
        }),
      ]);

      setGroup(groupData);
      setCustomers(customersResponse.items);
      setTotalPages(customersResponse.pagination.totalPages);
      setTotalCustomers(customersResponse.pagination.total);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load customers");
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1); // Reset to first page on new search
  };

  if (loading && customers.length === 0) {
    return (
      <div className="bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-8">
        <div className="text-center py-12">
          <div className="relative mx-auto w-12 h-12">
            <div className="w-12 h-12 border-4 border-gray-800 border-t-[#FFCC00] rounded-full animate-spin"></div>
            <Sparkles className="w-5 h-5 text-[#FFCC00] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="mt-6 text-gray-400 font-medium">Loading customers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#FFCC00]/10 rounded-lg">
            <Users className="w-6 h-6 text-[#FFCC00]" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-white">Customers</h3>
            <p className="text-sm text-gray-400 mt-1">
              {totalCustomers} {totalCustomers === 1 ? "customer" : "customers"} with {group?.customTokenSymbol || "custom token"} activity
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search customers..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-800/50 border border-gray-700/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FFCC00]/50 focus:border-[#FFCC00]/50 transition-all"
          />
        </div>
      </div>

      {/* Customers List */}
      {customers.length === 0 ? (
        <div className="text-center py-16">
          <div className="inline-flex p-4 bg-gray-800/50 rounded-full mb-4">
            <Users className="w-12 h-12 text-gray-600" />
          </div>
          <p className="text-gray-400 text-lg font-medium">
            {searchQuery ? "No customers found" : "No customers yet"}
          </p>
          <p className="text-gray-500 text-sm mt-2">
            {searchQuery
              ? "Try adjusting your search query"
              : "Customers will appear here once they earn or redeem tokens"}
          </p>
        </div>
      ) : (
        <>
          {/* Table Header */}
          <div className="hidden md:grid md:grid-cols-12 gap-4 px-6 py-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            <div className="col-span-4">Customer</div>
            <div className="col-span-2 text-right">Token Balance</div>
            <div className="col-span-3 text-right">Lifetime Earned</div>
            <div className="col-span-3 text-right">Lifetime Redeemed</div>
          </div>

          {/* Customers Grid */}
          <div className="grid gap-3">
            {customers.map((customer) => (
              <div
                key={customer.customerAddress}
                className="group relative bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-sm rounded-xl p-5 border border-gray-700/50 hover:border-[#FFCC00]/30 transition-all duration-300"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-[#FFCC00]/0 to-[#FFCC00]/0 group-hover:from-[#FFCC00]/5 group-hover:to-transparent rounded-xl transition-all duration-300"></div>

                <div className="relative md:grid md:grid-cols-12 gap-4 items-center">
                  {/* Customer Info */}
                  <div className="col-span-4 flex items-center gap-3 mb-3 md:mb-0">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-[#FFCC00]/20 to-[#FFCC00]/10 flex items-center justify-center">
                      <Wallet className="w-5 h-5 text-[#FFCC00]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white truncate">
                        {customer.customerName || "Unknown"}
                      </p>
                      <p className="text-xs text-gray-400 truncate font-mono">
                        {customer.customerAddress.slice(0, 6)}...{customer.customerAddress.slice(-4)}
                      </p>
                    </div>
                  </div>

                  {/* Stats - Mobile */}
                  <div className="md:hidden grid grid-cols-3 gap-3">
                    <div className="bg-gray-900/50 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">Balance</p>
                      <p className="font-bold text-white">
                        {customer.balance.toLocaleString()} <span className="text-[#FFCC00] text-xs">{group?.customTokenSymbol}</span>
                      </p>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">Earned</p>
                      <p className="font-bold text-green-400">
                        {customer.lifetimeEarned.toLocaleString()} <span className="text-green-300 text-xs">{group?.customTokenSymbol}</span>
                      </p>
                    </div>
                    <div className="bg-gray-900/50 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">Redeemed</p>
                      <p className="font-bold text-blue-400">
                        {customer.lifetimeRedeemed.toLocaleString()} <span className="text-blue-300 text-xs">{group?.customTokenSymbol}</span>
                      </p>
                    </div>
                  </div>

                  {/* Stats - Desktop */}
                  <div className="hidden md:block col-span-2 text-right">
                    <p className="font-bold text-lg text-white">
                      {customer.balance.toLocaleString()} <span className="text-[#FFCC00] text-sm font-semibold">{group?.customTokenSymbol}</span>
                    </p>
                  </div>

                  <div className="hidden md:flex col-span-3 justify-end items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <p className="font-bold text-lg text-green-400">
                      {customer.lifetimeEarned.toLocaleString()} <span className="text-green-300 text-sm font-semibold">{group?.customTokenSymbol}</span>
                    </p>
                  </div>

                  <div className="hidden md:flex col-span-3 justify-end items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <p className="font-bold text-lg text-blue-400">
                      {customer.lifetimeRedeemed.toLocaleString()} <span className="text-blue-300 text-sm font-semibold">{group?.customTokenSymbol}</span>
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || loading}
                className="px-4 py-2 bg-gray-800/50 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 transition-all duration-200 border border-gray-700/50"
              >
                Previous
              </button>

              <div className="flex items-center gap-2">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      disabled={loading}
                      className={`w-10 h-10 rounded-xl font-semibold transition-all duration-200 ${
                        currentPage === pageNum
                          ? "bg-gradient-to-r from-[#FFCC00] to-[#FFD700] text-black shadow-lg shadow-[#FFCC00]/20"
                          : "bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-700/50"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || loading}
                className="px-4 py-2 bg-gray-800/50 text-white rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800 transition-all duration-200 border border-gray-700/50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
