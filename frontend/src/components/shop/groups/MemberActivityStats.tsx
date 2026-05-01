"use client";

import { useState, useEffect } from "react";
import { Users } from "lucide-react";
import * as shopGroupsAPI from "../../../services/api/affiliateShopGroups";
import { LoadingSpinner, Pagination, EmptyState, FilterTabs, SectionHeader } from "./shared";
import { formatDate } from "./utils/formatters";
import { usePagination } from "@/hooks/usePagination";
import { ITEMS_PER_PAGE } from "./constants";
import type { MemberActivitySortType, FilterOption } from "./types";

interface MemberActivityStatsProps {
  groupId: string;
}

const SORT_OPTIONS: FilterOption<MemberActivitySortType>[] = [
  { value: "issued", label: "Issued" },
  { value: "redeemed", label: "Redeemed" },
  { value: "net", label: "Net" },
  { value: "transactions", label: "Activity" },
];

export default function MemberActivityStats({ groupId }: MemberActivityStatsProps) {
  const [stats, setStats] = useState<shopGroupsAPI.MemberActivityStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<MemberActivitySortType>("issued");

  useEffect(() => {
    loadStats();
  }, [groupId]);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await shopGroupsAPI.getMemberActivityStats(groupId);
      if (Array.isArray(data)) {
        setStats(data);
      } else {
        console.error('Invalid data format received:', data);
        setStats([]);
        setError('Unable to load member activity data. You may not have access to view this information.');
      }
    } catch (err: unknown) {
      console.error('Error loading member activity stats:', err);
      setStats([]);
      setError('Unable to load member activity data. Please check your permissions or try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Sort stats based on selected option
  const sortedStats = [...stats].sort((a, b) => {
    switch (sortBy) {
      case "issued":
        return b.tokensIssued - a.tokensIssued;
      case "redeemed":
        return b.tokensRedeemed - a.tokensRedeemed;
      case "net":
        return b.netContribution - a.netContribution;
      case "transactions":
        return b.transactionCount - a.transactionCount;
      default:
        return 0;
    }
  });

  // Use pagination hook
  const {
    paginatedItems,
    currentPage,
    totalPages,
    setPage,
    startIndex,
    reset,
  } = usePagination(sortedStats, { itemsPerPage: ITEMS_PER_PAGE });

  const handleSortChange = (value: MemberActivitySortType) => {
    setSortBy(value);
    reset();
  };

  if (loading) {
    return (
      <div className="bg-[#101010] rounded-[20px] p-4 sm:p-6">
        <SectionHeader icon={Users} title="Member Activity" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-[#1e1f22] rounded-xl animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#101010] rounded-[20px] p-4 sm:p-6">
        <SectionHeader icon={Users} title="Member Activity" />
        <div className="bg-red-900/20 border border-red-700/50 rounded-xl p-3 sm:p-4">
          <p className="text-red-400 text-sm sm:text-base">{error}</p>
          <button
            onClick={loadStats}
            className="mt-3 px-4 py-2 text-sm sm:text-base bg-red-700 hover:bg-red-600 text-white rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (stats.length === 0) {
    return (
      <div className="bg-[#101010] rounded-[20px] p-4 sm:p-6">
        <SectionHeader icon={Users} title="Member Activity" />
        <EmptyState
          icon={Users}
          title="No member activity data available yet"
        />
      </div>
    );
  }

  return (
    <div className="bg-[#101010] rounded-[20px] p-6">
      <SectionHeader
        icon={Users}
        title="Member Activity"
        action={
          <FilterTabs
            options={SORT_OPTIONS}
            value={sortBy}
            onChange={handleSortChange}
          />
        }
      />

      {/* Table */}
      <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
        <table className="w-full min-w-[820px]">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left py-2 sm:py-3 px-3 sm:px-4 text-gray-400 font-medium text-xs sm:text-sm w-16">Rank</th>
              <th className="text-left py-2 sm:py-3 px-3 sm:px-4 text-gray-400 font-medium text-xs sm:text-sm">Shop</th>
              <th className="text-center py-2 sm:py-3 px-3 sm:px-4 text-gray-400 font-medium text-xs sm:text-sm">Issued</th>
              <th className="text-center py-2 sm:py-3 px-3 sm:px-4 text-gray-400 font-medium text-xs sm:text-sm">Redeemed</th>
              <th className="text-center py-2 sm:py-3 px-3 sm:px-4 text-gray-400 font-medium text-xs sm:text-sm">Net</th>
              <th className="text-center py-2 sm:py-3 px-3 sm:px-4 text-gray-400 font-medium text-xs sm:text-sm">Transactions</th>
              <th className="text-center py-2 sm:py-3 px-3 sm:px-4 text-gray-400 font-medium text-xs sm:text-sm">Customers</th>
              <th className="text-right py-2 sm:py-3 px-3 sm:px-4 text-gray-400 font-medium text-xs sm:text-sm">Last Activity</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((stat, index) => {
              const rank = startIndex + index + 1;
              return (
                <tr
                  key={stat.shopId}
                  className="border-b border-gray-800/50 hover:bg-[#1e1f22]/50"
                >
                  <td className="py-3 sm:py-4 px-3 sm:px-4 text-white text-sm sm:text-base font-medium">{rank}</td>
                  <td className="py-3 sm:py-4 px-3 sm:px-4">
                    <div>
                      <p className="text-white text-sm sm:text-base font-medium truncate max-w-[180px] sm:max-w-none">{stat.shopName}</p>
                      <p className="text-gray-500 text-xs sm:text-sm truncate max-w-[180px] sm:max-w-[200px]">{stat.shopId}</p>
                    </div>
                  </td>
                  <td className="py-3 sm:py-4 px-3 sm:px-4 text-center text-white text-sm sm:text-base whitespace-nowrap">
                    {stat.tokensIssued.toLocaleString()}
                  </td>
                  <td className="py-3 sm:py-4 px-3 sm:px-4 text-center text-white text-sm sm:text-base whitespace-nowrap">
                    {stat.tokensRedeemed.toLocaleString()}
                  </td>
                  <td className="py-3 sm:py-4 px-3 sm:px-4 text-center text-white text-sm sm:text-base whitespace-nowrap">
                    {stat.netContribution.toLocaleString()}
                  </td>
                  <td className="py-3 sm:py-4 px-3 sm:px-4 text-center text-white text-sm sm:text-base">
                    {stat.transactionCount}
                  </td>
                  <td className="py-3 sm:py-4 px-3 sm:px-4 text-center text-white text-sm sm:text-base">
                    {stat.uniqueCustomers}
                  </td>
                  <td className="py-3 sm:py-4 px-3 sm:px-4 text-right text-white text-xs sm:text-sm whitespace-nowrap">
                    {formatDate(stat.lastActivity, { shortFormat: true })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </div>
  );
}
