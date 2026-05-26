"use client";

import { useState, useEffect } from "react";
import { inventoryApi } from "@/services/api/inventory";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "react-hot-toast";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle,
  XCircle,
  Clock,
  Target,
  BarChart3,
  Calendar,
} from "lucide-react";

interface AccuracyMetrics {
  totalSuggestions: number;
  approvedSuggestions: number;
  rejectedSuggestions: number;
  expiredSuggestions: number;
  suggestionsWithPO: number;
  accurateSuggestions: number;
  inaccurateSuggestions: number;
  pendingAssessment: number;
  averageAccuracyScore: number;
  trend: "improving" | "stable" | "declining";
}

export default function AccuracyTrackingPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<AccuracyMetrics | null>(null);
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");

  useEffect(() => {
    if (user?.shopId) {
      loadMetrics();
    }
  }, [user?.shopId, period]);

  const loadMetrics = async () => {
    if (!user?.shopId) return;

    try {
      setLoading(true);

      // Calculate period dates
      const end = new Date();
      const start = new Date();

      switch (period) {
        case "7d":
          start.setDate(start.getDate() - 7);
          break;
        case "30d":
          start.setDate(start.getDate() - 30);
          break;
        case "90d":
          start.setDate(start.getDate() - 90);
          break;
      }

      const response = await inventoryApi.getAccuracyMetrics(
        user.shopId,
        start.toISOString(),
        end.toISOString()
      );

      setMetrics(response.data.metrics);
    } catch (error) {
      console.error("Error loading accuracy metrics:", error);
      toast.error("Failed to load accuracy metrics");
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "improving":
        return <TrendingUp className="w-5 h-5 text-green-400" />;
      case "declining":
        return <TrendingDown className="w-5 h-5 text-red-400" />;
      default:
        return <Minus className="w-5 h-5 text-gray-400" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case "improving":
        return "text-green-400";
      case "declining":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-400";
    if (score >= 60) return "text-yellow-400";
    return "text-orange-400";
  };

  const getAccuracyRate = () => {
    if (!metrics) return 0;
    const total = metrics.accurateSuggestions + metrics.inaccurateSuggestions;
    if (total === 0) return 0;
    return ((metrics.accurateSuggestions / total) * 100).toFixed(1);
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

  if (!metrics) {
    return (
      <div className="p-6">
        <div className="bg-[#1a1a1a] rounded-lg border border-gray-800 p-6 text-center">
          <p className="text-gray-400">No accuracy data available for this period</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Target className="w-7 h-7 text-[#FFCC00]" />
            PO Suggestion Accuracy Tracking
          </h1>
          <p className="text-gray-400 mt-1">
            Monitor how accurate your purchase order suggestions are over time
          </p>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-2 bg-[#1a1a1a] border border-gray-800 rounded-lg p-1">
          <button
            onClick={() => setPeriod("7d")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              period === "7d"
                ? "bg-[#FFCC00] text-black"
                : "text-gray-400 hover:text-white"
            }`}
          >
            7 Days
          </button>
          <button
            onClick={() => setPeriod("30d")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              period === "30d"
                ? "bg-[#FFCC00] text-black"
                : "text-gray-400 hover:text-white"
            }`}
          >
            30 Days
          </button>
          <button
            onClick={() => setPeriod("90d")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              period === "90d"
                ? "bg-[#FFCC00] text-black"
                : "text-gray-400 hover:text-white"
            }`}
          >
            90 Days
          </button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Average Accuracy Score */}
        <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 rounded-lg border border-purple-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-400">Avg Accuracy Score</h3>
            <BarChart3 className="w-5 h-5 text-purple-400" />
          </div>
          <p className={`text-3xl font-bold ${getScoreColor(metrics.averageAccuracyScore)}`}>
            {metrics.averageAccuracyScore.toFixed(1)}
            <span className="text-base text-gray-400">/100</span>
          </p>
          <div className="flex items-center gap-1 mt-2">
            {getTrendIcon(metrics.trend)}
            <span className={`text-sm ${getTrendColor(metrics.trend)}`}>
              {metrics.trend === "improving"
                ? "Improving"
                : metrics.trend === "declining"
                ? "Declining"
                : "Stable"}
            </span>
          </div>
        </div>

        {/* Accuracy Rate */}
        <div className="bg-gradient-to-r from-green-900/20 to-blue-900/20 rounded-lg border border-green-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-400">Accuracy Rate</h3>
            <CheckCircle className="w-5 h-5 text-green-400" />
          </div>
          <p className="text-3xl font-bold text-green-400">
            {getAccuracyRate()}
            <span className="text-base text-gray-400">%</span>
          </p>
          <p className="text-sm text-gray-400 mt-2">
            {metrics.accurateSuggestions} accurate / {metrics.accurateSuggestions + metrics.inaccurateSuggestions}{" "}
            assessed
          </p>
        </div>

        {/* Total Suggestions */}
        <div className="bg-gradient-to-r from-yellow-900/20 to-orange-900/20 rounded-lg border border-yellow-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-400">Total Suggestions</h3>
            <Calendar className="w-5 h-5 text-yellow-400" />
          </div>
          <p className="text-3xl font-bold text-white">{metrics.totalSuggestions}</p>
          <div className="flex items-center gap-4 mt-2 text-sm">
            <span className="text-green-400">{metrics.approvedSuggestions} approved</span>
            <span className="text-red-400">{metrics.rejectedSuggestions} rejected</span>
          </div>
        </div>

        {/* Pending Assessment */}
        <div className="bg-gradient-to-r from-orange-900/20 to-red-900/20 rounded-lg border border-orange-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-400">Pending Assessment</h3>
            <Clock className="w-5 h-5 text-orange-400" />
          </div>
          <p className="text-3xl font-bold text-orange-400">{metrics.pendingAssessment}</p>
          <p className="text-sm text-gray-400 mt-2">
            {((metrics.pendingAssessment / metrics.totalSuggestions) * 100).toFixed(1)}% of total
          </p>
        </div>
      </div>

      {/* Breakdown Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Suggestion Outcomes */}
        <div className="bg-[#1a1a1a] rounded-lg border border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Suggestion Outcomes</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-gray-300">Approved</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white font-semibold">{metrics.approvedSuggestions}</span>
                <span className="text-xs text-gray-400">
                  ({((metrics.approvedSuggestions / metrics.totalSuggestions) * 100).toFixed(1)}%)
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-400" />
                <span className="text-gray-300">Rejected</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white font-semibold">{metrics.rejectedSuggestions}</span>
                <span className="text-xs text-gray-400">
                  ({((metrics.rejectedSuggestions / metrics.totalSuggestions) * 100).toFixed(1)}%)
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-gray-300">Expired</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white font-semibold">{metrics.expiredSuggestions}</span>
                <span className="text-xs text-gray-400">
                  ({((metrics.expiredSuggestions / metrics.totalSuggestions) * 100).toFixed(1)}%)
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-700">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                <span className="text-gray-300">Converted to PO</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white font-semibold">{metrics.suggestionsWithPO}</span>
                <span className="text-xs text-gray-400">
                  ({((metrics.suggestionsWithPO / metrics.totalSuggestions) * 100).toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Assessment Status */}
        <div className="bg-[#1a1a1a] rounded-lg border border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Assessment Status</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-gray-300">Accurate Suggestions</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-400 font-semibold">{metrics.accurateSuggestions}</span>
                <span className="text-xs text-gray-400">
                  ({getAccuracyRate()}% of assessed)
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-400" />
                <span className="text-gray-300">Inaccurate Suggestions</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-red-400 font-semibold">{metrics.inaccurateSuggestions}</span>
                <span className="text-xs text-gray-400">
                  (
                  {(
                    (metrics.inaccurateSuggestions /
                      (metrics.accurateSuggestions + metrics.inaccurateSuggestions || 1)) *
                    100
                  ).toFixed(1)}
                  % of assessed)
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-gray-700">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-400" />
                <span className="text-gray-300">Pending Assessment</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-orange-400 font-semibold">{metrics.pendingAssessment}</span>
                <span className="text-xs text-gray-400">
                  ({((metrics.pendingAssessment / metrics.totalSuggestions) * 100).toFixed(1)}% of total)
                </span>
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="mt-6 p-4 bg-blue-900/20 border border-blue-700 rounded-lg">
            <p className="text-sm text-blue-300">
              <strong>How it works:</strong> Suggestions are automatically assessed after they expire or are rejected.
              The system checks if items actually stocked out to determine accuracy. You can also manually assess
              suggestions.
            </p>
          </div>
        </div>
      </div>

      {/* How to Improve */}
      <div className="bg-gradient-to-r from-yellow-900/20 to-green-900/20 rounded-lg border border-yellow-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-yellow-400" />
          Tips to Improve Accuracy
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <p className="font-semibold text-white">Regular Stock Updates</p>
            <p className="text-sm text-gray-400">
              Keep inventory quantities up to date. Accurate stock data leads to better predictions.
            </p>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-white">Consistent Usage Tracking</p>
            <p className="text-sm text-gray-400">
              Record all stock movements (sales, damages, etc.) to help the system learn usage patterns.
            </p>
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-white">Review Thresholds</p>
            <p className="text-sm text-gray-400">
              Adjust low stock thresholds for items based on actual usage to reduce false suggestions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
