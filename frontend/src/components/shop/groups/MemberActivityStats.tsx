"use client";

import { useState, useEffect } from "react";
import { Users, ChevronLeft, ChevronRight } from "lucide-react";
import * as shopGroupsAPI from "../../../services/api/affiliateShopGroups";

interface MemberActivityStatsProps {
  groupId: string;
}

export default function MemberActivityStats({ groupId }: MemberActivityStatsProps) {
  const [stats, setStats] = useState<shopGroupsAPI.MemberActivityStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"issued" | "redeemed" | "net" | "transactions">("issued");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    loadStats();
  }, [groupId]);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await shopGroupsAPI.getMemberActivityStats(groupId);
      // Ensure data is an array
      if (Array.isArray(data)) {
        setStats(data);
      } else {
        console.error('Invalid data format received:', data);
        setStats([]);
        setError('Unable to load member activity data. You may not have access to view this information.');
      }
    } catch (error: unknown) {
      console.error('Error loading member activity stats:', error);
      setStats([]);
      setError('Unable to load member activity data. Please check your permissions or try again later.');
    } finally {
      setLoading(false);
    }
  };

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

  // Pagination
  const totalPages = Math.ceil(sortedStats.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedStats = sortedStats.slice(startIndex, startIndex + itemsPerPage);

  if (loading) {
    return (
      <div className="bg-[#101010] rounded-[20px] p-6">
        <div className="flex items-center gap-2 mb-6">
          <Users className="w-5 h-5 text-[#FFCC00]" />
          <h3 className="text-[#FFCC00] font-semibold">Member Activity</h3>
        </div>
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
      <div className="bg-[#101010] rounded-[20px] p-6">
        <div className="flex items-center gap-2 mb-6">
          <Users className="w-5 h-5 text-[#FFCC00]" />
          <h3 className="text-[#FFCC00] font-semibold">Member Activity</h3>
        </div>
        <div className="bg-red-900/20 border border-red-700/50 rounded-xl p-4">
          <p className="text-red-400">{error}</p>
          <button
            onClick={loadStats}
            className="mt-3 px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (stats.length === 0) {
    return (
      <div className="bg-[#101010] rounded-[20px] p-6">
        <div className="flex items-center gap-2 mb-6">
          <Users className="w-5 h-5 text-[#FFCC00]" />
          <h3 className="text-[#FFCC00] font-semibold">Member Activity</h3>
        </div>
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No member activity data available yet</p>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="bg-[#101010] rounded-[20px] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-[#FFCC00]" />
          <h3 className="text-[#FFCC00] font-semibold">Member Activity</h3>
        </div>

        {/* Sort Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => { setSortBy("issued"); setCurrentPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              sortBy === "issued"
                ? "bg-[#FFCC00] text-[#101010]"
                : "bg-[#1e1f22] text-white hover:bg-[#2a2b2f]"
            }`}
          >
            Issued
          </button>
          <button
            onClick={() => { setSortBy("redeemed"); setCurrentPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              sortBy === "redeemed"
                ? "bg-[#FFCC00] text-[#101010]"
                : "bg-[#1e1f22] text-white hover:bg-[#2a2b2f]"
            }`}
          >
            Redeemed
          </button>
          <button
            onClick={() => { setSortBy("net"); setCurrentPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              sortBy === "net"
                ? "bg-[#FFCC00] text-[#101010]"
                : "bg-[#1e1f22] text-white hover:bg-[#2a2b2f]"
            }`}
          >
            Net
          </button>
          <button
            onClick={() => { setSortBy("transactions"); setCurrentPage(1); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              sortBy === "transactions"
                ? "bg-[#FFCC00] text-[#101010]"
                : "bg-[#1e1f22] text-white hover:bg-[#2a2b2f]"
            }`}
          >
            Activity
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm w-16">Rank</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium text-sm">Shop</th>
              <th className="text-center py-3 px-4 text-gray-400 font-medium text-sm">Issued</th>
              <th className="text-center py-3 px-4 text-gray-400 font-medium text-sm">Redeemed</th>
              <th className="text-center py-3 px-4 text-gray-400 font-medium text-sm">Net</th>
              <th className="text-center py-3 px-4 text-gray-400 font-medium text-sm">Transactions</th>
              <th className="text-center py-3 px-4 text-gray-400 font-medium text-sm">Customers</th>
              <th className="text-right py-3 px-4 text-gray-400 font-medium text-sm">Last Activity</th>
            </tr>
          </thead>
          <tbody>
            {paginatedStats.map((stat, index) => {
              const rank = startIndex + index + 1;
              return (
                <tr
                  key={stat.shopId}
                  className="border-b border-gray-800/50 hover:bg-[#1e1f22]/50"
                >
                  <td className="py-4 px-4 text-white font-medium">{rank}</td>
                  <td className="py-4 px-4">
                    <div>
                      <p className="text-white font-medium">{stat.shopName}</p>
                      <p className="text-gray-500 text-sm truncate max-w-[200px]">{stat.shopId}</p>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center text-white">
                    {stat.tokensIssued.toLocaleString()}
                  </td>
                  <td className="py-4 px-4 text-center text-white">
                    {stat.tokensRedeemed.toLocaleString()}
                  </td>
                  <td className="py-4 px-4 text-center text-white">
                    {stat.netContribution.toLocaleString()}
                  </td>
                  <td className="py-4 px-4 text-center text-white">
                    {stat.transactionCount}
                  </td>
                  <td className="py-4 px-4 text-center text-white">
                    {stat.uniqueCustomers}
                  </td>
                  <td className="py-4 px-4 text-right text-white">
                    {formatDate(stat.lastActivity)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t border-gray-800">
          <button
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            className="flex items-center gap-1 px-3 py-1.5 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 rounded-lg text-sm font-medium transition-all duration-200 ${
                  currentPage === page
                    ? "bg-[#1e1f22] text-white border border-gray-600"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {page}
              </button>
            ))}
          </div>

          <button
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            className="flex items-center gap-1 px-3 py-1.5 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
