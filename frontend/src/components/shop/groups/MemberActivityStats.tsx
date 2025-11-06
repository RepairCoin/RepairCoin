"use client";

import { useState, useEffect } from "react";
import * as shopGroupsAPI from "../../../services/api/affiliateShopGroups";

interface MemberActivityStatsProps {
  groupId: string;
}

export default function MemberActivityStats({ groupId }: MemberActivityStatsProps) {
  const [stats, setStats] = useState<shopGroupsAPI.MemberActivityStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"issued" | "redeemed" | "net" | "transactions">("issued");

  useEffect(() => {
    loadStats();
  }, [groupId]);

  const loadStats = async () => {
    setLoading(true);
    const data = await shopGroupsAPI.getMemberActivityStats(groupId);
    setStats(data);
    setLoading(false);
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

  if (loading) {
    return (
      <div className="bg-[#1A1A1A] rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (stats.length === 0) {
    return (
      <div className="bg-[#1A1A1A] rounded-lg p-6">
        <h3 className="text-2xl font-bold text-white mb-4">👥 Member Activity</h3>
        <p className="text-gray-400">No member activity data available yet</p>
      </div>
    );
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="bg-[#1A1A1A] rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-white">👥 Member Activity</h3>

        <div className="flex gap-2">
          <button
            onClick={() => setSortBy("issued")}
            className={`px-3 py-1 rounded text-sm ${
              sortBy === "issued"
                ? "bg-[#FFCC00] text-black font-semibold"
                : "bg-[#0D0D0D] text-gray-400 hover:text-white"
            }`}
          >
            Issued
          </button>
          <button
            onClick={() => setSortBy("redeemed")}
            className={`px-3 py-1 rounded text-sm ${
              sortBy === "redeemed"
                ? "bg-[#FFCC00] text-black font-semibold"
                : "bg-[#0D0D0D] text-gray-400 hover:text-white"
            }`}
          >
            Redeemed
          </button>
          <button
            onClick={() => setSortBy("net")}
            className={`px-3 py-1 rounded text-sm ${
              sortBy === "net"
                ? "bg-[#FFCC00] text-black font-semibold"
                : "bg-[#0D0D0D] text-gray-400 hover:text-white"
            }`}
          >
            Net
          </button>
          <button
            onClick={() => setSortBy("transactions")}
            className={`px-3 py-1 rounded text-sm ${
              sortBy === "transactions"
                ? "bg-[#FFCC00] text-black font-semibold"
                : "bg-[#0D0D0D] text-gray-400 hover:text-white"
            }`}
          >
            Activity
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left text-gray-400 font-semibold py-3 px-4">Rank</th>
              <th className="text-left text-gray-400 font-semibold py-3 px-4">Shop</th>
              <th className="text-right text-gray-400 font-semibold py-3 px-4">Issued</th>
              <th className="text-right text-gray-400 font-semibold py-3 px-4">Redeemed</th>
              <th className="text-right text-gray-400 font-semibold py-3 px-4">Net</th>
              <th className="text-right text-gray-400 font-semibold py-3 px-4">Txns</th>
              <th className="text-right text-gray-400 font-semibold py-3 px-4">Customers</th>
              <th className="text-right text-gray-400 font-semibold py-3 px-4">Last Activity</th>
            </tr>
          </thead>
          <tbody>
            {sortedStats.map((stat, index) => (
              <tr
                key={stat.shopId}
                className="border-b border-gray-800 hover:bg-[#0D0D0D] transition-colors"
              >
                <td className="py-4 px-4">
                  {index === 0 && (
                    <span className="text-2xl">🥇</span>
                  )}
                  {index === 1 && (
                    <span className="text-2xl">🥈</span>
                  )}
                  {index === 2 && (
                    <span className="text-2xl">🥉</span>
                  )}
                  {index > 2 && (
                    <span className="text-gray-500 font-mono">#{index + 1}</span>
                  )}
                </td>
                <td className="py-4 px-4">
                  <div>
                    <div className="text-white font-semibold">{stat.shopName}</div>
                    <div className="text-xs text-gray-500 font-mono">{stat.shopId}</div>
                  </div>
                </td>
                <td className="py-4 px-4 text-right">
                  <span className="text-green-400 font-semibold">
                    {stat.tokensIssued.toLocaleString()}
                  </span>
                </td>
                <td className="py-4 px-4 text-right">
                  <span className="text-blue-400 font-semibold">
                    {stat.tokensRedeemed.toLocaleString()}
                  </span>
                </td>
                <td className="py-4 px-4 text-right">
                  <span
                    className={`font-semibold ${
                      stat.netContribution > 0
                        ? "text-green-400"
                        : stat.netContribution < 0
                        ? "text-red-400"
                        : "text-gray-400"
                    }`}
                  >
                    {stat.netContribution > 0 && "+"}
                    {stat.netContribution.toLocaleString()}
                  </span>
                </td>
                <td className="py-4 px-4 text-right">
                  <span className="text-white">{stat.transactionCount}</span>
                </td>
                <td className="py-4 px-4 text-right">
                  <span className="text-purple-400">{stat.uniqueCustomers}</span>
                </td>
                <td className="py-4 px-4 text-right">
                  <span className="text-gray-400 text-sm">
                    {formatDate(stat.lastActivity)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="mt-6 p-4 bg-[#0D0D0D] rounded-lg border border-gray-800">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-gray-400 text-sm mb-1">Total Members</div>
            <div className="text-white text-xl font-bold">{stats.length}</div>
          </div>
          <div>
            <div className="text-gray-400 text-sm mb-1">Total Issued</div>
            <div className="text-green-400 text-xl font-bold">
              {stats.reduce((sum, s) => sum + s.tokensIssued, 0).toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-gray-400 text-sm mb-1">Total Redeemed</div>
            <div className="text-blue-400 text-xl font-bold">
              {stats.reduce((sum, s) => sum + s.tokensRedeemed, 0).toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-gray-400 text-sm mb-1">Total Transactions</div>
            <div className="text-white text-xl font-bold">
              {stats.reduce((sum, s) => sum + s.transactionCount, 0).toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
