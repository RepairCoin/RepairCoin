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
      <div className="bg-[#101010] rounded-xl p-6">
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
    <div className="bg-[#101010] rounded-xl p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-[#FFCC00]" />
          <div>
            <h3 className="text-[#FFCC00] font-semibold">Customers</h3>
            <p className="text-sm text-gray-400">
              {totalCustomers} {totalCustomers === 1 ? "customer" : "customers"} with {group?.customTokenSymbol || "custom token"} activity
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search customers..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#1e1f22] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#FFCC00]/50 focus:border-[#FFCC00]/50 transition-all text-sm"
          />
        </div>
      </div>

      {/* Customers List */}
      {customers.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 font-medium">
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
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Customer</th>
                  <th className="text-center py-3 px-4 text-gray-400 font-medium text-sm">Balance</th>
                  <th className="text-center py-3 px-4 text-gray-400 font-medium text-sm">Earned</th>
                  <th className="text-center py-3 px-4 text-gray-400 font-medium text-sm">Redeemed</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr
                    key={customer.customerAddress}
                    className="border-b border-gray-800/50 hover:bg-[#1e1f22]/50"
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[#1e1f22] flex items-center justify-center">
                          <Wallet className="w-4 h-4 text-[#FFCC00]" />
                        </div>
                        <div>
                          <p className="text-white font-medium">{customer.customerName || "Unknown"}</p>
                          <p className="text-gray-500 text-xs font-mono">
                            {customer.customerAddress.slice(0, 6)}...{customer.customerAddress.slice(-4)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="text-white font-semibold">{customer.balance.toLocaleString()}</span>
                      <span className="text-[#FFCC00] text-xs ml-1">{group?.customTokenSymbol}</span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <TrendingUp className="w-3 h-3 text-green-400" />
                        <span className="text-green-400 font-semibold">{customer.lifetimeEarned.toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <TrendingDown className="w-3 h-3 text-blue-400" />
                        <span className="text-blue-400 font-semibold">{customer.lifetimeRedeemed.toLocaleString()}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-gray-800">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || loading}
                className="px-3 py-1.5 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>

              <div className="flex items-center gap-1">
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
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-all duration-200 ${
                        currentPage === pageNum
                          ? "bg-[#1e1f22] text-white border border-gray-600"
                          : "text-gray-400 hover:text-white"
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
                className="px-3 py-1.5 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
