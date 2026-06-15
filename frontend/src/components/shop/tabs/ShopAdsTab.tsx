"use client";

// Shop Ads view (Ads System Stage 1). Read-only: the shop sees the campaigns the
// admin runs for it + per-campaign performance (ROI computed-at-read). Plus the
// pre-flight quality-check banner (risks §5): low review score / few photos warns
// that ads are unlikely to perform. Reads /api/ads/shop/*.

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Megaphone, TrendingUp, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import { LeadKanban } from "@/components/ads/LeadKanban";
import { AwaitingResponse } from "@/components/ads/AwaitingResponse";
import { AdEnrollmentCTA } from "@/components/ads/AdEnrollmentCTA";
import {
  listShopCampaigns, getShopCampaignPerformance, fmtUsd, fmtRoi,
  type AdCampaign, type CampaignPerformance,
} from "@/services/api/ads";

export interface ShopAdsTabProps {
  /** Optional — drives the pre-flight quality banner. Hidden when not provided. */
  reviewScore?: number;
  photoCount?: number;
}

export const ShopAdsTab: React.FC<ShopAdsTabProps> = ({ reviewScore, photoCount }) => {
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [perf, setPerf] = useState<CampaignPerformance | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const c = await listShopCampaigns().catch(() => ({ items: [] as AdCampaign[], total: 0 }));
      setCampaigns(c.items);
      if (c.items[0]) void select(c.items[0].id);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { void load(); }, [load]);

  const select = async (id: string) => {
    setSelectedId(id);
    setPerf(null);
    try { setPerf(await getShopCampaignPerformance(id)); }
    catch (e: any) { toast.error(e?.message || "Couldn't load performance."); }
  };

  // Quality gate — warn only when we actually have the data and it's below bar.
  const lowReview = reviewScore !== undefined && reviewScore < 3.5;
  const fewPhotos = photoCount !== undefined && photoCount < 5;
  const showQualityWarning = lowReview || fewPhotos;

  if (loading) {
    return <div className="flex items-center gap-2 text-gray-400 text-sm py-10"><Loader2 className="w-4 h-4 animate-spin" /> Loading your ads…</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-white flex items-center gap-2">
        <Megaphone className="w-5 h-5 text-[#FFCC00]" /> Your Ads
      </h2>

      {/* Self-serve opt-in (hidden once approved + running) */}
      <AdEnrollmentCTA hasCampaigns={campaigns.length > 0} />

      <AwaitingResponse mode="shop" />

      {showQualityWarning && (
        <div className="rounded-xl border border-yellow-500/40 bg-yellow-900/15 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
          <div className="text-sm text-gray-200 leading-relaxed">
            <span className="font-medium text-yellow-300">Your shop profile may limit ad performance.</span>{" "}
            {lowReview && <>Your review score is below 3.5★. </>}
            {fewPhotos && <>You have fewer than 5 photos. </>}
            Ads send customers to your profile — improving these first makes every ad dollar work harder.
          </div>
        </div>
      )}

      {campaigns.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-[#141414] p-8 text-center text-gray-400 text-sm">
          No ad campaigns yet. When our team runs ads for your shop, they&apos;ll show up here with live performance.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
          {/* Campaign list */}
          <div className="space-y-2">
            {campaigns.map((c) => (
              <button
                key={c.id}
                onClick={() => select(c.id)}
                className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
                  selectedId === c.id ? "border-[#FFCC00] bg-[#FFCC00]/10" : "border-white/10 bg-[#1A1A1A] hover:border-white/25"
                }`}
              >
                <p className="text-sm font-medium text-white">{c.name}</p>
                <p className="text-xs text-gray-500 capitalize">{c.status} · {fmtUsd(c.dailyBudgetCents)}/day</p>
              </button>
            ))}
          </div>

          {/* Performance card — min-w-0 lets this 1fr grid track shrink to the viewport
              so wide children (metric grid, lead kanban) scroll/wrap instead of overflowing. */}
          <div className="min-w-0 rounded-xl border border-white/10 bg-[#141414] p-5">
            {!perf ? (
              <div className="flex items-center gap-2 text-gray-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
            ) : (
              <>
                <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-[#FFCC00]" /> Performance
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Stat label="Spend" value={fmtUsd(perf.roi.totalSpendCents)} />
                  <Stat label="Revenue" value={fmtUsd(perf.roi.totalRevenueCents)} />
                  <Stat label="ROI" value={fmtRoi(perf.roi.roi)} accent />
                  <Stat label="Bookings" value={String(perf.roi.totalBookings)} />
                  <Stat label="Leads" value={String(perf.roi.totalLeads)} />
                  <Stat label="Cost / Lead" value={fmtUsd(perf.roi.cplCents)} />
                  <Stat label="Cost / Booking" value={fmtUsd(perf.roi.cpbCents)} />
                  <Stat label="ROAS" value={perf.roi.roas == null ? "—" : `${perf.roi.roas.toFixed(1)}×`} />
                </div>

                {/* Lead pipeline (read-only) */}
                <div className="mt-5">
                  <p className="text-sm font-medium text-gray-300 mb-2">Leads</p>
                  {selectedId && <LeadKanban mode="shop" campaignId={selectedId} />}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; accent?: boolean }> = ({ label, value, accent }) => (
  <div className="rounded-lg border border-white/10 bg-[#1A1A1A] px-3 py-2.5">
    <p className="text-xs text-gray-500">{label}</p>
    <p className={`text-lg font-semibold ${accent ? "text-[#FFCC00]" : "text-white"}`}>{value}</p>
  </div>
);

export default ShopAdsTab;
