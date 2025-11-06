"use client";

import { useState, useEffect } from "react";
import * as shopGroupsAPI from "../../../services/api/affiliateShopGroups";

interface AnalyticsDashboardProps {
  groupId: string;
}

export default function AnalyticsDashboard({ groupId }: AnalyticsDashboardProps) {
  const [analytics, setAnalytics] = useState<shopGroupsAPI.GroupAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [groupId]);

  const loadAnalytics = async () => {
    setLoading(true);
    const data = await shopGroupsAPI.getGroupAnalytics(groupId);
    setAnalytics(data);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="bg-[#1A1A1A] rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-24 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="bg-[#1A1A1A] rounded-lg p-6">
        <p className="text-gray-400">Unable to load analytics data</p>
      </div>
    );
  }

  const stats = [
    {
      label: "Tokens Circulating",
      value: analytics.totalTokensCirculating.toLocaleString(),
      icon: "💰",
      color: "text-[#FFCC00]",
    },
    {
      label: "Total Issued",
      value: analytics.totalTokensIssued.toLocaleString(),
      icon: "📤",
      color: "text-green-400",
    },
    {
      label: "Total Redeemed",
      value: analytics.totalTokensRedeemed.toLocaleString(),
      icon: "📥",
      color: "text-blue-400",
    },
    {
      label: "Active Members",
      value: analytics.activeMembers.toString(),
      icon: "👥",
      color: "text-purple-400",
    },
    {
      label: "Unique Customers",
      value: analytics.uniqueCustomers.toString(),
      icon: "👤",
      color: "text-pink-400",
    },
    {
      label: "Total Transactions",
      value: analytics.totalTransactions.toLocaleString(),
      icon: "📊",
      color: "text-cyan-400",
    },
    {
      label: "Avg Transaction Size",
      value: analytics.averageTransactionSize.toFixed(2),
      icon: "📈",
      color: "text-orange-400",
    },
    {
      label: "Issued (Last 30 Days)",
      value: analytics.tokensIssuedLast30Days.toLocaleString(),
      icon: "⏱️",
      color: "text-green-300",
    },
    {
      label: "Redeemed (Last 30 Days)",
      value: analytics.tokensRedeemedLast30Days.toLocaleString(),
      icon: "⏰",
      color: "text-blue-300",
    },
  ];

  return (
    <div className="bg-[#1A1A1A] rounded-lg p-6">
      <h3 className="text-2xl font-bold text-white mb-6">📊 Analytics Overview</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="bg-[#0D0D0D] rounded-lg p-4 border border-gray-800 hover:border-gray-700 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">{stat.label}</span>
              <span className="text-2xl">{stat.icon}</span>
            </div>
            <div className={`text-3xl font-bold ${stat.color}`}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Health indicator */}
      <div className="mt-6 p-4 bg-[#0D0D0D] rounded-lg border border-gray-800">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-white font-semibold mb-1">Group Health</h4>
            <p className="text-gray-400 text-sm">
              {analytics.totalTokensCirculating > 0
                ? "Active circulation detected"
                : "No tokens in circulation yet"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {analytics.totalTokensCirculating > 0 ? (
              <>
                <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-green-400 font-semibold">Healthy</span>
              </>
            ) : (
              <>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <span className="text-yellow-400 font-semibold">Starting</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
