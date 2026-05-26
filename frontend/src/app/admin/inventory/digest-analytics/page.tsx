"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import {
  Mail,
  Users,
  Clock,
  TrendingUp,
  Eye,
  MousePointerClick,
  Calendar,
  Award,
  AlertTriangle,
} from "lucide-react";

// Placeholder interface - will need to be added to backend
interface DigestAnalytics {
  totalShops: number;
  digestModeDistribution: {
    immediate: number;
    daily: number;
    weekly: number;
    monthly: number;
  };
  engagementMetrics: {
    avgOpenRate: number;
    avgClickRate: number;
    totalDigestsSent: number;
    lastWeekDigests: number;
  };
  topEngagedShops: Array<{
    shopId: string;
    shopName: string;
    openRate: number;
    clickRate: number;
    digestsSent: number;
  }>;
  leastEngagedShops: Array<{
    shopId: string;
    shopName: string;
    openRate: number;
    clickRate: number;
    digestsSent: number;
  }>;
  performanceTrends: Array<{
    date: string;
    sent: number;
    opened: number;
    clicked: number;
  }>;
}

export default function DigestAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<DigestAnalytics | null>(null);
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);

      // TODO: Implement backend endpoint
      // For now, using mock data
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Mock data
      const mockData: DigestAnalytics = {
        totalShops: 42,
        digestModeDistribution: {
          immediate: 8,
          daily: 15,
          weekly: 12,
          monthly: 7,
        },
        engagementMetrics: {
          avgOpenRate: 68.5,
          avgClickRate: 42.3,
          totalDigestsSent: 324,
          lastWeekDigests: 48,
        },
        topEngagedShops: [
          { shopId: "shop1", shopName: "TechRepair Pro", openRate: 95.2, clickRate: 78.5, digestsSent: 24 },
          { shopId: "shop2", shopName: "Mobile Fix It", openRate: 92.1, clickRate: 71.3, digestsSent: 18 },
          { shopId: "shop3", shopName: "Quick Gadget", openRate: 89.7, clickRate: 65.8, digestsSent: 21 },
          { shopId: "shop4", shopName: "Device Masters", openRate: 85.4, clickRate: 62.1, digestsSent: 19 },
          { shopId: "shop5", shopName: "Phone Clinic", openRate: 82.3, clickRate: 58.9, digestsSent: 15 },
        ],
        leastEngagedShops: [
          { shopId: "shop20", shopName: "Budget Repairs", openRate: 12.5, clickRate: 3.2, digestsSent: 16 },
          { shopId: "shop21", shopName: "Corner Shop Tech", openRate: 18.9, clickRate: 7.4, digestsSent: 12 },
          { shopId: "shop22", shopName: "City Gadgets", openRate: 22.1, clickRate: 9.8, digestsSent: 14 },
        ],
        performanceTrends: [
          { date: "2026-05-19", sent: 45, opened: 31, clicked: 19 },
          { date: "2026-05-20", sent: 48, opened: 33, clicked: 20 },
          { date: "2026-05-21", sent: 42, opened: 29, clicked: 18 },
          { date: "2026-05-22", sent: 51, opened: 35, clicked: 22 },
          { date: "2026-05-23", sent: 47, opened: 32, clicked: 20 },
          { date: "2026-05-24", sent: 49, opened: 34, clicked: 21 },
          { date: "2026-05-25", sent: 50, opened: 35, clicked: 22 },
        ],
      };

      setAnalytics(mockData);
    } catch (error) {
      console.error("Error loading digest analytics:", error);
      toast.error("Failed to load digest analytics");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FFCC00]"></div>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="p-6">
        <div className="bg-[#1a1a1a] rounded-lg border border-gray-800 p-6 text-center">
          <p className="text-gray-400">No digest analytics available</p>
        </div>
      </div>
    );
  }

  const totalWithDigests =
    analytics.digestModeDistribution.daily +
    analytics.digestModeDistribution.weekly +
    analytics.digestModeDistribution.monthly;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Mail className="w-7 h-7 text-[#FFCC00]" />
            Digest Analytics Dashboard
          </h1>
          <p className="text-gray-400 mt-1">Monitor email digest engagement and performance across all shops</p>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-2 bg-[#1a1a1a] border border-gray-800 rounded-lg p-1">
          <button
            onClick={() => setPeriod("7d")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              period === "7d" ? "bg-[#FFCC00] text-black" : "text-gray-400 hover:text-white"
            }`}
          >
            7 Days
          </button>
          <button
            onClick={() => setPeriod("30d")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              period === "30d" ? "bg-[#FFCC00] text-black" : "text-gray-400 hover:text-white"
            }`}
          >
            30 Days
          </button>
          <button
            onClick={() => setPeriod("90d")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              period === "90d" ? "bg-[#FFCC00] text-black" : "text-gray-400 hover:text-white"
            }`}
          >
            90 Days
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Average Open Rate */}
        <div className="bg-gradient-to-r from-green-900/20 to-blue-900/20 rounded-lg border border-green-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-400">Avg Open Rate</h3>
            <Eye className="w-5 h-5 text-green-400" />
          </div>
          <p className="text-3xl font-bold text-green-400">
            {analytics.engagementMetrics.avgOpenRate.toFixed(1)}%
          </p>
          <p className="text-sm text-gray-400 mt-2">
            {analytics.engagementMetrics.totalDigestsSent} digests sent
          </p>
        </div>

        {/* Average Click Rate */}
        <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 rounded-lg border border-purple-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-400">Avg Click Rate</h3>
            <MousePointerClick className="w-5 h-5 text-purple-400" />
          </div>
          <p className="text-3xl font-bold text-purple-400">
            {analytics.engagementMetrics.avgClickRate.toFixed(1)}%
          </p>
          <p className="text-sm text-gray-400 mt-2">of opened digests</p>
        </div>

        {/* Total Shops */}
        <div className="bg-gradient-to-r from-yellow-900/20 to-orange-900/20 rounded-lg border border-yellow-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-400">Total Shops</h3>
            <Users className="w-5 h-5 text-yellow-400" />
          </div>
          <p className="text-3xl font-bold text-white">{analytics.totalShops}</p>
          <p className="text-sm text-gray-400 mt-2">{totalWithDigests} using digests</p>
        </div>

        {/* This Week */}
        <div className="bg-gradient-to-r from-blue-900/20 to-cyan-900/20 rounded-lg border border-blue-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-400">This Week</h3>
            <Calendar className="w-5 h-5 text-blue-400" />
          </div>
          <p className="text-3xl font-bold text-blue-400">{analytics.engagementMetrics.lastWeekDigests}</p>
          <p className="text-sm text-gray-400 mt-2">digests sent</p>
        </div>
      </div>

      {/* Digest Mode Distribution */}
      <div className="bg-[#1a1a1a] rounded-lg border border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-[#FFCC00]" />
          Digest Mode Distribution
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#252525] rounded-lg p-4 border border-gray-700">
            <p className="text-sm text-gray-400 mb-1">Immediate</p>
            <p className="text-2xl font-bold text-white">{analytics.digestModeDistribution.immediate}</p>
            <p className="text-xs text-gray-400 mt-1">
              {((analytics.digestModeDistribution.immediate / analytics.totalShops) * 100).toFixed(1)}% of shops
            </p>
          </div>

          <div className="bg-[#252525] rounded-lg p-4 border border-gray-700">
            <p className="text-sm text-gray-400 mb-1">Daily</p>
            <p className="text-2xl font-bold text-white">{analytics.digestModeDistribution.daily}</p>
            <p className="text-xs text-gray-400 mt-1">
              {((analytics.digestModeDistribution.daily / analytics.totalShops) * 100).toFixed(1)}% of shops
            </p>
          </div>

          <div className="bg-[#252525] rounded-lg p-4 border border-gray-700">
            <p className="text-sm text-gray-400 mb-1">Weekly</p>
            <p className="text-2xl font-bold text-white">{analytics.digestModeDistribution.weekly}</p>
            <p className="text-xs text-gray-400 mt-1">
              {((analytics.digestModeDistribution.weekly / analytics.totalShops) * 100).toFixed(1)}% of shops
            </p>
          </div>

          <div className="bg-[#252525] rounded-lg p-4 border border-gray-700">
            <p className="text-sm text-gray-400 mb-1">Monthly</p>
            <p className="text-2xl font-bold text-white">{analytics.digestModeDistribution.monthly}</p>
            <p className="text-xs text-gray-400 mt-1">
              {((analytics.digestModeDistribution.monthly / analytics.totalShops) * 100).toFixed(1)}% of shops
            </p>
          </div>
        </div>
      </div>

      {/* Top & Least Engaged Shops */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Engaged Shops */}
        <div className="bg-[#1a1a1a] rounded-lg border border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-green-400" />
            Top Engaged Shops
          </h3>
          <div className="space-y-3">
            {analytics.topEngagedShops.map((shop, index) => (
              <div
                key={shop.shopId}
                className="flex items-center justify-between p-3 bg-[#252525] rounded-lg border border-gray-700"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-full ${
                      index === 0
                        ? "bg-yellow-600 text-white"
                        : index === 1
                        ? "bg-gray-400 text-white"
                        : index === 2
                        ? "bg-orange-600 text-white"
                        : "bg-[#1a1a1a] text-gray-400"
                    } font-bold text-sm`}
                  >
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-white font-medium">{shop.shopName}</p>
                    <p className="text-xs text-gray-400">{shop.digestsSent} digests sent</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-green-400 font-semibold">{shop.openRate.toFixed(1)}% open</p>
                  <p className="text-xs text-gray-400">{shop.clickRate.toFixed(1)}% click</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Least Engaged Shops */}
        <div className="bg-[#1a1a1a] rounded-lg border border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-400" />
            Least Engaged Shops (Need Help)
          </h3>
          <div className="space-y-3">
            {analytics.leastEngagedShops.map((shop) => (
              <div
                key={shop.shopId}
                className="flex items-center justify-between p-3 bg-[#252525] rounded-lg border border-orange-700"
              >
                <div>
                  <p className="text-white font-medium">{shop.shopName}</p>
                  <p className="text-xs text-gray-400">{shop.digestsSent} digests sent</p>
                </div>
                <div className="text-right">
                  <p className="text-orange-400 font-semibold">{shop.openRate.toFixed(1)}% open</p>
                  <p className="text-xs text-gray-400">{shop.clickRate.toFixed(1)}% click</p>
                </div>
              </div>
            ))}
            <div className="mt-4 p-3 bg-orange-900/20 border border-orange-700 rounded-lg">
              <p className="text-sm text-orange-300">
                <strong>Tip:</strong> Consider reaching out to these shops to provide training or check if they're
                experiencing issues with digest emails.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Trends */}
      <div className="bg-[#1a1a1a] rounded-lg border border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[#FFCC00]" />
          7-Day Performance Trend
        </h3>
        <div className="space-y-2">
          {analytics.performanceTrends.map((day) => {
            const openRate = ((day.opened / day.sent) * 100).toFixed(1);
            const clickRate = ((day.clicked / day.opened) * 100).toFixed(1);

            return (
              <div key={day.date} className="flex items-center gap-4 p-3 bg-[#252525] rounded-lg border border-gray-700">
                <div className="w-24">
                  <p className="text-sm text-gray-400">{new Date(day.date).toLocaleDateString()}</p>
                </div>
                <div className="flex-1 grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-gray-400">Sent</p>
                    <p className="text-lg font-semibold text-white">{day.sent}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Opened</p>
                    <p className="text-lg font-semibold text-green-400">
                      {day.opened} <span className="text-xs text-gray-400">({openRate}%)</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Clicked</p>
                    <p className="text-lg font-semibold text-purple-400">
                      {day.clicked} <span className="text-xs text-gray-400">({clickRate}%)</span>
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Info Note */}
      <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
        <p className="text-sm text-blue-300">
          <strong>Note:</strong> This is a placeholder admin dashboard. Backend tracking for digest opens/clicks needs to
          be implemented via email pixels and link tracking for real metrics.
        </p>
      </div>
    </div>
  );
}
