"use client";

// Ads System Stage 5 — per-industry analytics (admin only). Compares ROI / CPL /
// CPB / revenue across industries so the commercial team can double down on the
// verticals that are crushing it. Reads /ads/analytics/by-industry.

import React, { useEffect, useState } from "react";
import { Loader2, BarChart3 } from "lucide-react";
import { getIndustryAnalytics, fmtUsd, fmtRoi, type IndustryRow } from "@/services/api/ads";

export const IndustryAnalytics: React.FC = () => {
  const [rows, setRows] = useState<IndustryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getIndustryAnalytics()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center gap-2 text-gray-400 text-sm py-4"><Loader2 className="w-4 h-4 animate-spin" /> Loading industry analytics…</div>;
  }
  if (rows.length === 0) return null;

  return (
    <section>
      <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-[#FFCC00]" /> By Industry
      </h3>
      <div className="rounded-xl border border-white/10 overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-[#1A1A1A] text-gray-400">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Industry</th>
              <th className="text-right px-4 py-2 font-medium">Campaigns</th>
              <th className="text-right px-4 py-2 font-medium">Spend</th>
              <th className="text-right px-4 py-2 font-medium">Revenue</th>
              <th className="text-right px-4 py-2 font-medium">ROI</th>
              <th className="text-right px-4 py-2 font-medium">CPL</th>
              <th className="text-right px-4 py-2 font-medium">CPB</th>
              <th className="text-right px-4 py-2 font-medium">Bookings</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.industrySlug ?? `i${i}`} className="border-t border-white/5">
                <td className="px-4 py-2.5 text-white">{r.industryName}</td>
                <td className="px-4 py-2.5 text-right text-gray-300">{r.campaignCount}</td>
                <td className="px-4 py-2.5 text-right text-gray-300">{fmtUsd(r.totalSpendCents)}</td>
                <td className="px-4 py-2.5 text-right text-gray-300">{fmtUsd(r.totalRevenueCents)}</td>
                <td className={`px-4 py-2.5 text-right font-medium ${r.roi != null && r.roi >= 0 ? "text-[#FFCC00]" : "text-red-400"}`}>{fmtRoi(r.roi)}</td>
                <td className="px-4 py-2.5 text-right text-gray-300">{fmtUsd(r.cplCents)}</td>
                <td className="px-4 py-2.5 text-right text-gray-300">{fmtUsd(r.cpbCents)}</td>
                <td className="px-4 py-2.5 text-right text-gray-300">{r.totalBookings}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default IndustryAnalytics;
