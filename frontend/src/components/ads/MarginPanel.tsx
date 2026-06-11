"use client";

// Ads System (Q6) — admin-only TRUE MARGIN panel. The shop-facing ROI deliberately
// EXCLUDES FixFlow's AI inference cost (that's our COGS, like hosting — it must not
// be conflated with the shop's unit economics). This panel is the internal view
// that folds AI COGS back in, so admins can see FixFlow's real cost of delivery —
// load-bearing for pricing Plan B (margin) and Plan C (per-booking). Never rendered
// in the shop dashboard. Reads /ads/campaigns/:id/margin.

import React, { useEffect, useState } from "react";
import { Loader2, Lock, TrendingDown } from "lucide-react";
import { getCampaignMargin, fmtRoi, fmtUsd, fmtUsdPrecise, type CampaignMargin } from "@/services/api/ads";

const Stat: React.FC<{ label: string; value: string; sub?: string; tone?: "default" | "dip" }> = ({
  label, value, sub, tone = "default",
}) => (
  <div className="rounded-lg border border-white/10 bg-[#1A1A1A] px-3 py-2.5">
    <p className="text-xs text-gray-400">{label}</p>
    <p className={`text-base font-semibold ${tone === "dip" ? "text-amber-400" : "text-white"}`}>{value}</p>
    {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
  </div>
);

export const MarginPanel: React.FC<{ campaignId: string }> = ({ campaignId }) => {
  const [margin, setMargin] = useState<CampaignMargin | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getCampaignMargin(campaignId)
      .then(setMargin)
      .catch(() => setMargin(null))
      .finally(() => setLoading(false));
  }, [campaignId]);

  if (loading) {
    return <div className="flex items-center gap-2 text-gray-400 text-sm py-3"><Loader2 className="w-4 h-4 animate-spin" /> Loading margin…</div>;
  }
  if (!margin) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Lock className="w-4 h-4 text-[#FFCC00]" />
        <p className="text-sm font-medium text-gray-300">True Margin</p>
        <span className="text-xs px-1.5 py-0.5 rounded bg-[#FFCC00]/15 text-[#FFCC00]">Admin only</span>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Shops see ROI excluding AI cost (it&apos;s FixFlow COGS). This folds it back in so you can see our real cost of delivery.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat label="Shop ROI (shown to shop)" value={fmtRoi(margin.shopRoi)} sub={`${fmtUsd(margin.totalRevenueCents)} rev / ${fmtUsd(margin.totalSpendCents)} spend`} />
        <Stat label="AI cost (our COGS)" value={fmtUsdPrecise(margin.aiCostCents)} sub="lead-outreach drafts" />
        <Stat label="True ROI (incl. AI)" value={fmtRoi(margin.trueRoi)} sub="internal" />
        <Stat
          label="ROI dip from AI"
          value={margin.roiDip == null ? "—" : `${(margin.roiDip * 100).toFixed(1)} pts`}
          tone="dip"
        />
      </div>

      {margin.roiDip != null && margin.roiDip > 0 && (
        <p className="text-xs text-gray-500 mt-2 flex items-center gap-1.5">
          <TrendingDown className="w-3.5 h-3.5 text-amber-400" />
          AI inference trims {(margin.roiDip * 100).toFixed(1)} ROI points off this campaign — absorbed by FixFlow, not the shop.
        </p>
      )}
    </div>
  );
};

export default MarginPanel;
