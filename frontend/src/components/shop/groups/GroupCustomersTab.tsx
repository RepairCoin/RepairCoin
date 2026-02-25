"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { Users, Search, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import * as shopGroupsAPI from "../../../services/api/affiliateShopGroups";
import { LoadingSpinner, Pagination, EmptyState, SectionHeader } from "./shared";
import { formatAddress } from "./utils/formatters";
import { CUSTOMERS_PER_PAGE } from "./constants";

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
          limit: CUSTOMERS_PER_PAGE,
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
    setCurrentPage(1);
  };

  if (loading && customers.length === 0) {
    return (
      <div className="bg-[#101010] rounded-xl p-6">
        <LoadingSpinner message="Loading customers..." showSparkles />
      </div>
    );
  }

  return (
    <div className="bg-[#101010] rounded-xl p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <SectionHeader
          icon={Users}
          title="Customers"
          subtitle={`${totalCustomers} ${totalCustomers === 1 ? "customer" : "customers"} with ${group?.customTokenSymbol || "custom token"} activity`}
          className="mb-0"
        />

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
        <EmptyState
          icon={Users}
          title={searchQuery ? "No customers found" : "No customers yet"}
          description={
            searchQuery
              ? "Try adjusting your search query"
              : "Customers will appear here once they earn or redeem tokens"
          }
        />
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
                            {formatAddress(customer.customerAddress)}
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

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            disabled={loading}
          />
        </>
      )}
    </div>
  );
}
