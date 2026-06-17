"use client";

// Shop Ads view (Ads System Stage 1). Read-only: the shop sees the campaigns the
// admin runs for it + per-campaign performance (ROI computed-at-read). Plus the
// pre-flight quality-check banner (risks §5): low review score / few photos warns
// that ads are unlikely to perform. Reads /api/ads/shop/*.

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Megaphone, TrendingUp, AlertTriangle, Plus, X } from "lucide-react";
import toast from "react-hot-toast";
import { LeadKanban } from "@/components/ads/LeadKanban";
import { AdMessageThread } from "@/components/ads/AdMessageThread";
import { SubscriptionPanel } from "@/components/ads/SubscriptionPanel";
import { AwaitingResponse } from "@/components/ads/AwaitingResponse";
import { AdEnrollmentCTA } from "@/components/ads/AdEnrollmentCTA";
import { CampaignBriefFields, briefToApi, emptyBrief, type BriefValue } from "@/components/ads/CampaignBriefFields";
import {
  listShopCampaigns, getShopCampaignPerformance, getShopCapacity,
  listMyCampaignRequests, submitCampaignRequest, fmtUsd, fmtRoi,
  type AdCampaign, type CampaignPerformance, type ShopCapacity, type AdCampaignRequest,
} from "@/services/api/ads";

// Status pill colors for in-flight campaign requests shown in the left rail.
const REQ_STATUS_CLS: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-400",
  approved: "bg-blue-500/15 text-blue-400",
  building: "bg-blue-500/15 text-blue-400",
  live: "bg-green-500/15 text-green-400",
  declined: "bg-red-500/15 text-red-400",
  cancelled: "bg-gray-500/15 text-gray-400",
};

export interface ShopAdsTabProps {
  /** The shop's id — needed for the enrollment campaign-brief service picker. */
  shopId: string;
  /** Optional — drives the pre-flight quality banner. Hidden when not provided. */
  reviewScore?: number;
  photoCount?: number;
}

export const ShopAdsTab: React.FC<ShopAdsTabProps> = ({ shopId, reviewScore, photoCount }) => {
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [perf, setPerf] = useState<CampaignPerformance | null>(null);
  const [capacity, setCapacity] = useState<ShopCapacity | null>(null);
  const [requests, setRequests] = useState<AdCampaignRequest[]>([]);
  const [reqOpen, setReqOpen] = useState(false);
  const [brief, setBrief] = useState<BriefValue>(emptyBrief);
  const [reqMessage, setReqMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, cap, reqs] = await Promise.all([
        listShopCampaigns().catch(() => ({ items: [] as AdCampaign[], total: 0 })),
        getShopCapacity().catch(() => null),
        listMyCampaignRequests().catch(() => [] as AdCampaignRequest[]),
      ]);
      setCampaigns(c.items);
      setCapacity(cap);
      setRequests(reqs);
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

  const submitRequest = async () => {
    setSubmitting(true);
    try {
      await submitCampaignRequest(briefToApi(brief), reqMessage.trim() || undefined);
      toast.success("Campaign request sent!");
      setBrief(emptyBrief); setReqMessage(""); setReqOpen(false);
      await load();
    } catch (e: any) {
      // 409 = tier capacity reached → surface the upsell from the API.
      toast.error(e?.response?.data?.message || e?.response?.data?.error || e?.message || "Couldn't send request.");
    } finally {
      setSubmitting(false);
    }
  };

  // Quality gate — warn only when we actually have the data and it's below bar.
  const lowReview = reviewScore !== undefined && reviewScore < 3.5;
  const fewPhotos = photoCount !== undefined && photoCount < 5;
  const showQualityWarning = lowReview || fewPhotos;

  // Combine requests into the campaign rail: a live request links to its campaign (its
  // $/mo annotates the card); in-flight ones (no campaign yet) show as status rows.
  const reqByCampaign = new Map(requests.filter((r) => r.campaignId).map((r) => [r.campaignId as string, r]));
  const pendingReqs = requests.filter((r) => !r.campaignId && r.status !== "cancelled");
  const monthlyOf = (campaignId: string) => reqByCampaign.get(campaignId)?.monthlyBudgetCents ?? null;

  if (loading) {
    return <div className="flex items-center gap-2 text-gray-400 text-sm py-10"><Loader2 className="w-4 h-4 animate-spin" /> Loading your ads…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-[#FFCC00]" /> Your Ads
        </h2>
        {capacity && campaigns.length > 0 && (
          <span className="text-sm text-gray-300">
            <span className="capitalize">{capacity.tier}</span> plan ·{" "}
            <span className={capacity.remaining <= 0 ? "text-amber-400" : "text-white"}>
              {capacity.usedCampaigns} of {capacity.maxCampaigns} campaigns
            </span>
          </span>
        )}
      </div>

      {/* Self-serve ads plan (Phase 4) — primary section, top of the page */}
      <SubscriptionPanel />

      {/* Self-serve opt-in (hidden once approved + running) */}
      <AdEnrollmentCTA shopId={shopId} hasCampaigns={campaigns.length > 0} />

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

      {/* Request-a-campaign form — full width when open (brief fields need the room) */}
      {reqOpen && (
        <div className="rounded-xl border border-[#FFCC00]/30 bg-[#141414] p-4 space-y-3">
          <p className="text-sm font-medium text-gray-200">Request a campaign</p>
          <CampaignBriefFields shopId={shopId} value={brief} onChange={setBrief} />
          <textarea
            value={reqMessage}
            onChange={(e) => setReqMessage(e.target.value)}
            placeholder="Anything else for this campaign? (optional)"
            rows={2}
            className="w-full px-3 py-2 bg-[#0F0F0F] border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:border-[#FFCC00]"
          />
          <button
            onClick={submitRequest}
            disabled={submitting}
            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-md bg-[#FFCC00] text-black hover:bg-[#E6B800] disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Send request
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        {/* Left rail: request button + campaigns + in-flight requests (combined to save space) */}
        <div className="space-y-2">
          <button
            onClick={() => setReqOpen((v) => !v)}
            className="w-full inline-flex items-center justify-center gap-1.5 text-sm font-medium px-3 py-2 rounded-md bg-[#FFCC00] text-black hover:bg-[#E6B800]"
          >
            {reqOpen ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {reqOpen ? "Cancel" : "Request a campaign"}
          </button>

          {campaigns.map((c) => {
            const monthly = monthlyOf(c.id);
            return (
              <button
                key={c.id}
                onClick={() => select(c.id)}
                className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
                  selectedId === c.id ? "border-[#FFCC00] bg-[#FFCC00]/10" : "border-white/10 bg-[#1A1A1A] hover:border-white/25"
                }`}
              >
                <p className="text-sm font-medium text-white">{c.name}</p>
                <p className="text-xs text-gray-500 capitalize">
                  {c.status} · {fmtUsd(c.dailyBudgetCents)}/day
                  {monthly != null && <span className="normal-case"> · ${(monthly / 100).toFixed(0)}/mo</span>}
                </p>
              </button>
            );
          })}

          {/* In-flight requests not yet built into a campaign */}
          {pendingReqs.map((r) => (
            <div key={r.id} className="rounded-lg border border-white/10 bg-[#1A1A1A] px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-white truncate capitalize">{r.goal ? r.goal.replace(/_/g, " ") : "Campaign"}</p>
                <span className={`text-[11px] px-2 py-0.5 rounded-full capitalize shrink-0 ${REQ_STATUS_CLS[r.status] ?? "bg-gray-500/15 text-gray-400"}`}>{r.status}</span>
              </div>
              {(r.monthlyBudgetCents != null || r.declineReason) && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {r.monthlyBudgetCents != null && <>${(r.monthlyBudgetCents / 100).toFixed(0)}/mo</>}
                  {r.declineReason && <span className="text-red-400/80"> · {r.declineReason}</span>}
                </p>
              )}
            </div>
          ))}

          {campaigns.length === 0 && pendingReqs.length === 0 && (
            <p className="text-xs text-gray-500 px-1 py-2">No campaigns yet. Request one above.</p>
          )}
        </div>

        {/* Performance card — min-w-0 lets this 1fr grid track shrink to the viewport
            so wide children (metric grid, lead kanban) scroll/wrap instead of overflowing. */}
        <div className="min-w-0 rounded-xl border border-white/10 bg-[#141414] p-5">
          {!selectedId ? (
            <div className="text-center text-gray-400 text-sm py-8">
              {campaigns.length === 0
                ? "When our team runs ads for your shop, performance shows up here."
                : "Select a campaign to see its performance."}
            </div>
          ) : !perf ? (
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

      {/* Durable thread with the FixFlow ads team (Phase 2) */}
      <AdMessageThread mode="shop" />
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
