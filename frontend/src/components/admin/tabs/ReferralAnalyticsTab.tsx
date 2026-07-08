"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Share2, RefreshCw, Loader2, Trophy, Users, CheckCircle2, Clock, Coins, TrendingUp } from "lucide-react";
import toast from "react-hot-toast";
import { DashboardHeader } from "@/components/ui/DashboardHeader";
import { adminApi } from "@/services/api/admin";

interface ReferralSummary {
  total: number;
  completed: number;
  pending: number;
  expired: number;
  rcnPaid: number;
  conversionRate: number;
  last7Days: number;
  last30Days: number;
}

interface LeaderboardEntry {
  referrerAddress: string;
  referrerName?: string;
  totalReferrals: number;
  successfulReferrals: number;
  totalEarnedRcn: number;
  lastReferralDate?: string;
}

const num = (n: number | undefined) => (n ?? 0).toLocaleString();

export function ReferralAnalyticsTab() {
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.getReferralAnalytics();
      if (res?.success) {
        setSummary(res.data?.summary || null);
        setLeaderboard(res.data?.leaderboard || []);
      } else {
        toast.error("Failed to load referral analytics");
      }
    } catch (err) {
      console.error("Failed to load referral analytics:", err);
      toast.error("Failed to load referral analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const short = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`;

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Referral Analytics"
        subtitle="Referral program performance, conversion, and top referrers"
        icon={Share2}
        gradientFrom="from-fuchsia-500"
        gradientTo="to-violet-600"
        actions={
          <button
            onClick={load}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-fuchsia-500" />
        </div>
      ) : summary ? (
        <>
          {/* Headline stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Total Referrals" value={num(summary.total)} icon={Users} accent="text-white" />
            <Stat label="Completed" value={num(summary.completed)} icon={CheckCircle2} accent="text-emerald-400" />
            <Stat label="Pending" value={num(summary.pending)} icon={Clock} accent="text-yellow-400" />
            <Stat
              label="Conversion Rate"
              value={`${summary.conversionRate.toFixed(1)}%`}
              icon={TrendingUp}
              accent="text-fuchsia-400"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="RCN Paid Out" value={`${num(summary.rcnPaid)} RCN`} icon={Coins} accent="text-yellow-400" />
            <Stat label="New (7 days)" value={`+${num(summary.last7Days)}`} icon={TrendingUp} accent="text-teal-400" />
            <Stat label="New (30 days)" value={`+${num(summary.last30Days)}`} icon={TrendingUp} accent="text-teal-400" />
            <Stat label="Expired" value={num(summary.expired)} icon={Clock} accent="text-gray-400" />
          </div>

          {/* Leaderboard */}
          <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-5">
            <h3 className="flex items-center gap-2 text-white font-semibold mb-4">
              <Trophy className="w-5 h-5 text-[#FFCC00]" />
              Top Referrers
            </h3>
            {leaderboard.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs uppercase tracking-wide border-b border-gray-800">
                      <th className="text-left py-2 font-medium w-10">#</th>
                      <th className="text-left py-2 font-medium">Referrer</th>
                      <th className="text-right py-2 font-medium">Referrals</th>
                      <th className="text-right py-2 font-medium">Successful</th>
                      <th className="text-right py-2 font-medium">RCN Earned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((r, i) => (
                      <tr key={`${r.referrerAddress}-${i}`} className="border-b border-gray-800/60">
                        <td className="py-2.5">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-fuchsia-500/15 text-fuchsia-400 text-xs font-bold">
                            {i + 1}
                          </span>
                        </td>
                        <td className="py-2.5">
                          <p className="text-white font-medium">{r.referrerName || "Anonymous"}</p>
                          <p className="text-gray-500 text-xs font-mono">{short(r.referrerAddress)}</p>
                        </td>
                        <td className="py-2.5 text-right text-gray-300">{num(r.totalReferrals)}</td>
                        <td className="py-2.5 text-right text-emerald-400">{num(r.successfulReferrals)}</td>
                        <td className="py-2.5 text-right text-white font-medium">{num(r.totalEarnedRcn)} RCN</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No referrals yet.</p>
            )}
          </div>
        </>
      ) : (
        <p className="text-gray-500 text-center py-16">No referral data available.</p>
      )}
    </div>
  );
}

const Stat: React.FC<{ label: string; value: string; icon: React.ComponentType<{ className?: string }>; accent: string }> = ({
  label,
  value,
  icon: Icon,
  accent,
}) => (
  <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-4">
    <div className="flex items-center justify-between mb-2">
      <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
      <Icon className="w-4 h-4 text-gray-600" />
    </div>
    <p className={`text-2xl font-bold ${accent}`}>{value}</p>
  </div>
);

export default ReferralAnalyticsTab;
