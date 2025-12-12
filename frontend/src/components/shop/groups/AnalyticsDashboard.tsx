"use client";

import { useState, useEffect } from "react";
import { Activity, Coins, Users, ArrowUpRight, ArrowDownRight, BarChart3, Clock, Heart } from "lucide-react";
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
      <div className="bg-[#101010] rounded-[20px] p-6">
        <div className="flex items-center gap-2 mb-6">
          <Activity className="w-5 h-5 text-[#FFCC00]" />
          <h3 className="text-[#FFCC00] font-semibold">Analytics Overview</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <div key={i} className="bg-[#1e1f22] rounded-xl p-4 animate-pulse">
              <div className="h-4 bg-gray-700 rounded w-1/2 mb-3"></div>
              <div className="h-8 bg-gray-700 rounded w-1/3"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="bg-[#101010] rounded-[20px] p-6">
        <div className="flex items-center gap-2 mb-6">
          <Activity className="w-5 h-5 text-[#FFCC00]" />
          <h3 className="text-[#FFCC00] font-semibold">Analytics Overview</h3>
        </div>
        <p className="text-gray-400">Unable to load analytics data</p>
      </div>
    );
  }

  const stats = [
    {
      label: "Tokens Circulating",
      value: analytics.totalTokensCirculating.toLocaleString(),
      icon: Coins,
    },
    {
      label: "Total Issued",
      value: analytics.totalTokensIssued.toLocaleString(),
      icon: ArrowUpRight,
    },
    {
      label: "Total Redeemed",
      value: analytics.totalTokensRedeemed.toLocaleString(),
      icon: ArrowDownRight,
    },
    {
      label: "Active Members",
      value: analytics.activeMembers.toString(),
      icon: Users,
    },
    {
      label: "Unique Member",
      value: analytics.uniqueCustomers.toString(),
      icon: Users,
    },
    {
      label: "Total Transactions",
      value: analytics.totalTransactions.toLocaleString(),
      icon: BarChart3,
    },
    {
      label: "Avg Transaction Size",
      value: analytics.averageTransactionSize.toFixed(2),
      icon: BarChart3,
    },
    {
      label: "Issued (Last 30 Days)",
      value: analytics.tokensIssuedLast30Days.toLocaleString(),
      icon: Clock,
    },
    {
      label: "Redeemed (Last 30 Days)",
      value: analytics.tokensRedeemedLast30Days.toLocaleString(),
      icon: Clock,
    },
  ];

  return (
    <div className="bg-[#101010] rounded-[20px] p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Activity className="w-5 h-5 text-[#FFCC00]" />
        <h3 className="text-[#FFCC00] font-semibold">Analytics Overview</h3>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className="bg-[#1e1f22] rounded-xl p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4 text-[#FFCC00]" />
                <span className="text-[#FFCC00] text-sm">{stat.label}</span>
              </div>
              <div className="text-2xl font-bold text-white">
                {stat.value}
              </div>
            </div>
          );
        })}
      </div>

      {/* Group Health Card */}
      <div className="bg-[#1e1f22] rounded-xl p-4 max-w-[280px]">
        <div className="flex items-center gap-2 mb-2">
          <Heart className="w-4 h-4 text-[#FFCC00]" />
          <span className="text-[#FFCC00] text-sm">Group Health</span>
        </div>
        <div className="flex items-center gap-2">
          {analytics.totalTokensCirculating > 0 ? (
            <>
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-white font-semibold">Healthy</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
              <span className="text-white font-semibold">Starting</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
