"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  DollarSign,
  RefreshCw,
  TrendingUp,
  Wallet,
  Landmark,
  Cog,
  Calculator,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";
import { DashboardHeader } from "@/components/ui/DashboardHeader";
import { adminApi } from "@/services/api/admin";
import { useBlockchainEnabled } from "@/contexts/AppConfigContext";

interface RevenueReport {
  totalRevenue: number;
  totalOperations: number;
  totalStakers: number;
  totalDAO: number;
  purchasesByTier: Record<string, { count: number; revenue: number }>;
  averageDiscount: number;
}

interface TierBreakdown {
  period: string;
  tierBreakdown: Record<
    string,
    { purchases: number; rcnSold: number; revenue: number; avgDiscount: string }
  >;
  summary: {
    totalPurchases: number;
    totalRCNSold: number;
    totalRevenue: number;
    revenueAtStandardPricing: number;
    overallDiscountGiven: string;
    revenueLostToDiscounts: number;
  };
}

interface Projections {
  assumptions: { monthlyRCNSales: number; averageTier: string; assumedStakedRCG: number };
  projections: { monthlyStakerRevenue: number; annualStakerRevenue: number; averageAPR: number };
}

const usd = (n: number | undefined) =>
  `$${(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const TIER_STYLE: Record<string, string> = {
  standard: "text-amber-400",
  premium: "text-purple-400",
  elite: "text-indigo-400",
};

export function RevenueAnalyticsTab() {
  const [week, setWeek] = useState<RevenueReport | null>(null);
  const [byTier, setByTier] = useState<TierBreakdown | null>(null);
  const [loading, setLoading] = useState(true);

  // Stakers / DAO revenue-sharing + staker projections are blockchain-governance
  // features that don't exist yet (no stakers/DAO in database-only mode). Hide
  // them until blockchain is re-enabled — then 100% of RCN sales is platform revenue.
  const blockchainEnabled = useBlockchainEnabled();

  // Custom range
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [range, setRange] = useState<RevenueReport | null>(null);
  const [rangeLoading, setRangeLoading] = useState(false);

  // Projections
  const [monthlyVolume, setMonthlyVolume] = useState(100000);
  const [averageTier, setAverageTier] = useState("standard");
  const [projections, setProjections] = useState<Projections | null>(null);
  const [projLoading, setProjLoading] = useState(false);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const [weekRes, tierRes] = await Promise.all([
        adminApi.getCurrentWeekRevenue(),
        adminApi.getRevenueByTier(),
      ]);
      if (weekRes?.success) setWeek(weekRes.data);
      if (tierRes?.success) setByTier(tierRes.data);
    } catch (err) {
      console.error("Failed to load revenue analytics:", err);
      toast.error("Failed to load revenue analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const runRange = async () => {
    if (!startDate || !endDate) {
      toast.error("Pick a start and end date");
      return;
    }
    setRangeLoading(true);
    try {
      const res = await adminApi.getRevenueRange(startDate, endDate);
      if (res?.success) setRange(res.data);
      else toast.error("Failed to load range");
    } catch (err) {
      console.error("Revenue range failed:", err);
      toast.error("Failed to load range");
    } finally {
      setRangeLoading(false);
    }
  };

  const runProjections = async () => {
    setProjLoading(true);
    try {
      const res = await adminApi.getRevenueProjections(monthlyVolume, averageTier);
      if (res?.success) setProjections(res.data);
      else toast.error("Failed to calculate projections");
    } catch (err) {
      console.error("Revenue projections failed:", err);
      toast.error("Failed to calculate projections");
    } finally {
      setProjLoading(false);
    }
  };

  const DistributionCard = ({ report, title }: { report: RevenueReport; title: string }) => (
    <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold">{title}</h3>
        <span className="text-xs text-gray-500">
          avg discount {report.averageDiscount?.toFixed(1) ?? 0}%
        </span>
      </div>
      <p className="text-3xl font-bold text-white mb-1">{usd(report.totalRevenue)}</p>
      <p className="text-xs text-gray-500 mb-4">Total revenue (RCN sales)</p>
      {blockchainEnabled && (
        <div className="grid grid-cols-3 gap-3">
          <Split icon={Cog} label="Operations" value={report.totalOperations} pct="80%" color="text-blue-400" />
          <Split icon={Wallet} label="Stakers" value={report.totalStakers} pct="10%" color="text-emerald-400" />
          <Split icon={Landmark} label="DAO" value={report.totalDAO} pct="10%" color="text-violet-400" />
        </div>
      )}
      {report.purchasesByTier && (
        <div className="mt-4 pt-4 border-t border-gray-800 grid grid-cols-3 gap-3">
          {["standard", "premium", "elite"].map((t) => (
            <div key={t}>
              <p className={`text-xs capitalize ${TIER_STYLE[t]}`}>{t}</p>
              <p className="text-sm text-white font-medium">{usd(report.purchasesByTier[t]?.revenue)}</p>
              <p className="text-[11px] text-gray-500">{report.purchasesByTier[t]?.count ?? 0} purchases</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Revenue Analytics"
        subtitle={
          blockchainEnabled
            ? "RCN sales revenue, the 80/10/10 distribution, tier discounts, and staker projections"
            : "RCN sales revenue and shop-tier discounts"
        }
        icon={DollarSign}
        gradientFrom="from-emerald-500"
        gradientTo="to-green-600"
        actions={
          <button
            onClick={loadOverview}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      ) : (
        <>
          {/* Current week + custom range distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {week && <DistributionCard report={week} title="This Week" />}

            <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-5">
              <h3 className="text-white font-semibold mb-4">Custom Range</h3>
              <div className="flex flex-wrap items-end gap-3 mb-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Start</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-3 py-2 bg-[#2F2F2F] border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">End</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-3 py-2 bg-[#2F2F2F] border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <button
                  onClick={runRange}
                  disabled={rangeLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {rangeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                  Calculate
                </button>
              </div>
              {range ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-2xl font-bold text-white">{usd(range.totalRevenue)}</p>
                    <p className="text-xs text-gray-500">Total revenue</p>
                  </div>
                  {blockchainEnabled && (
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <MiniSplit label="Ops" value={range.totalOperations} />
                      <MiniSplit label="Stakers" value={range.totalStakers} />
                      <MiniSplit label="DAO" value={range.totalDAO} />
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Pick a date range to see its revenue for the period.</p>
              )}
            </div>
          </div>

          {/* By-tier breakdown (last 30 days) */}
          {byTier && (
            <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">Revenue by Shop Tier</h3>
                <span className="text-xs text-gray-500">last 30 days</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs uppercase tracking-wide border-b border-gray-800">
                      <th className="text-left py-2 font-medium">Tier</th>
                      <th className="text-right py-2 font-medium">Purchases</th>
                      <th className="text-right py-2 font-medium">RCN Sold</th>
                      <th className="text-right py-2 font-medium">Revenue</th>
                      <th className="text-right py-2 font-medium">Discount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {["standard", "premium", "elite"].map((t) => {
                      const row = byTier.tierBreakdown[t];
                      return (
                        <tr key={t} className="border-b border-gray-800/60">
                          <td className={`py-2.5 capitalize font-medium ${TIER_STYLE[t]}`}>{t}</td>
                          <td className="py-2.5 text-right text-gray-300">{row?.purchases ?? 0}</td>
                          <td className="py-2.5 text-right text-gray-300">
                            {(row?.rcnSold ?? 0).toLocaleString()} RCN
                          </td>
                          <td className="py-2.5 text-right text-white font-medium">{usd(row?.revenue)}</td>
                          <td className="py-2.5 text-right text-gray-400">{row?.avgDiscount ?? "0%"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
                <Summary label="Total Revenue" value={usd(byTier.summary.totalRevenue)} accent="text-emerald-400" />
                <Summary label="At Standard Pricing" value={usd(byTier.summary.revenueAtStandardPricing)} />
                <Summary label="Overall Discount" value={byTier.summary.overallDiscountGiven} />
                <Summary label="Revenue Given to Discounts" value={usd(byTier.summary.revenueLostToDiscounts)} accent="text-orange-400" />
              </div>
            </div>
          )}

          {/* Staker revenue projections — blockchain-governance only (hidden in DB-only mode) */}
          {blockchainEnabled && (
          <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Calculator className="w-5 h-5 text-violet-400" />
              <h3 className="text-white font-semibold">Staker Revenue Projections</h3>
            </div>
            <div className="flex flex-wrap items-end gap-3 mb-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Monthly RCN Volume</label>
                <input
                  type="number"
                  min={0}
                  value={monthlyVolume}
                  onChange={(e) => setMonthlyVolume(Number(e.target.value))}
                  className="px-3 py-2 bg-[#2F2F2F] border border-gray-600 rounded-lg text-white text-sm w-40 focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Average Tier</label>
                <select
                  value={averageTier}
                  onChange={(e) => setAverageTier(e.target.value)}
                  className="px-3 py-2 bg-[#2F2F2F] border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-violet-500 capitalize"
                >
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                  <option value="elite">Elite</option>
                </select>
              </div>
              <button
                onClick={runProjections}
                disabled={projLoading}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {projLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
                Project
              </button>
            </div>
            {projections && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Summary label="Monthly Staker Revenue" value={usd(projections.projections.monthlyStakerRevenue)} accent="text-emerald-400" />
                <Summary label="Annual Staker Revenue" value={usd(projections.projections.annualStakerRevenue)} accent="text-emerald-400" />
                <Summary label="Average APR" value={`${projections.projections.averageAPR?.toFixed(2) ?? 0}%`} accent="text-violet-400" />
              </div>
            )}
            <p className="text-[11px] text-gray-600 mt-3">
              Assumes ~30M RCG staked. Stakers receive 10% of RCN-sales revenue.
            </p>
          </div>
          )}
        </>
      )}
    </div>
  );
}

const Split: React.FC<{ icon: React.ComponentType<{ className?: string }>; label: string; value: number; pct: string; color: string }> = ({
  icon: Icon,
  label,
  value,
  pct,
  color,
}) => (
  <div className="bg-[#101010] rounded-xl p-3 border border-gray-800/60">
    <div className="flex items-center gap-1.5 mb-1">
      <Icon className={`w-3.5 h-3.5 ${color}`} />
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-[10px] text-gray-600 ml-auto">{pct}</span>
    </div>
    <p className="text-lg font-bold text-white">{usd(value)}</p>
  </div>
);

const MiniSplit: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div>
    <p className="text-sm font-semibold text-white">{usd(value)}</p>
    <p className="text-[10px] text-gray-500">{label}</p>
  </div>
);

const Summary: React.FC<{ label: string; value: string; accent?: string }> = ({ label, value, accent }) => (
  <div className="bg-[#101010] rounded-xl p-3 border border-gray-800/60">
    <p className="text-xs text-gray-400 mb-1">{label}</p>
    <p className={`text-lg font-bold ${accent ?? "text-white"}`}>{value}</p>
  </div>
);

export default RevenueAnalyticsTab;
