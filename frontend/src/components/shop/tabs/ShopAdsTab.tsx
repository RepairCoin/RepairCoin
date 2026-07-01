"use client";

// Shop Ads view. Onboarding is a GATED, ordered flow so a first-timer only sees the next
// step — not everything at once:
//   Step 1  Choose a plan (subscribe)
//   Step 2  Connect your Meta ad account   (only when the self-serve connect flow is enabled)
//   Step 3  Request a campaign             (admin then builds it → goes live)
// Each step unlocks the next; the campaign rail + performance appear once there's activity.

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Megaphone, TrendingUp, AlertTriangle, Plus, X, Lock } from "lucide-react";
import toast from "react-hot-toast";
import { LeadKanban } from "@/components/ads/LeadKanban";
import { AdMessageThread } from "@/components/ads/AdMessageThread";
import { SubscriptionPanel } from "@/components/ads/SubscriptionPanel";
import { MetaConnectCard } from "@/components/ads/MetaConnectCard";
import { GoogleConnectCard } from "@/components/ads/GoogleConnectCard";
import { AwaitingResponse } from "@/components/ads/AwaitingResponse";
import { AdEnrollmentCTA } from "@/components/ads/AdEnrollmentCTA";
import { CampaignBriefFields, briefToApi, emptyBrief, type BriefValue } from "@/components/ads/CampaignBriefFields";
import {
  listShopCampaigns, getShopCampaignPerformance, getShopCapacity,
  listMyCampaignRequests, submitCampaignRequest, getMySubscription, getMetaConnection, fmtMoney, fmtRoi,
  type AdCampaign, type CampaignPerformance, type ShopCapacity, type AdCampaignRequest,
  type FlatTierName, type MetaConnection,
} from "@/services/api/ads";

const REQ_STATUS_CLS: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-400",
  approved: "bg-blue-500/15 text-blue-400",
  building: "bg-blue-500/15 text-blue-400",
  live: "bg-green-500/15 text-green-400",
  declined: "bg-red-500/15 text-red-400",
  cancelled: "bg-gray-500/15 text-gray-400",
};

export interface ShopAdsTabProps {
  /** The shop's id — needed for the campaign-brief service picker. */
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
  const [subTier, setSubTier] = useState<FlatTierName | null>(null);
  const [metaConn, setMetaConn] = useState<MetaConnection | null>(null);
  const [reqOpen, setReqOpen] = useState(false);
  const [brief, setBrief] = useState<BriefValue>(emptyBrief);
  const [reqMessage, setReqMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, cap, reqs, sub, meta] = await Promise.all([
        listShopCampaigns().catch(() => ({ items: [] as AdCampaign[], total: 0 })),
        getShopCapacity().catch(() => null),
        listMyCampaignRequests().catch(() => [] as AdCampaignRequest[]),
        getMySubscription().catch(() => null),
        getMetaConnection().catch(() => null),
      ]);
      setCampaigns(c.items);
      setCapacity(cap);
      setRequests(reqs);
      setSubTier(sub?.tier ?? null);
      setMetaConn(meta);
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
      toast.error(e?.response?.data?.message || e?.response?.data?.error || e?.message || "Couldn't send request.");
    } finally {
      setSubmitting(false);
    }
  };

  const lowReview = reviewScore !== undefined && reviewScore < 3.5;
  const fewPhotos = photoCount !== undefined && photoCount < 5;
  const showQualityWarning = lowReview || fewPhotos;

  const reqByCampaign = new Map(requests.filter((r) => r.campaignId).map((r) => [r.campaignId as string, r]));
  const pendingReqs = requests.filter((r) => !r.campaignId && r.status !== "cancelled");
  const monthlyOf = (campaignId: string) => reqByCampaign.get(campaignId)?.monthlyBudgetCents ?? null;

  // ----- Onboarding stage gating -----
  // Order is always Plan → Connect → Request. A campaign can't go live without a connected
  // ad account (§9.6), so the shop can't REQUEST one until connected — otherwise the admin
  // gets a request it can never build. (When the self-serve OAuth flow is off, the FixFlow
  // team connects the account; the shop sees a "being set up" note and waits.)
  const subscribed = !!subTier;
  const connectEnabled = metaConn?.enabled ?? false;        // self-serve OAuth flow live
  const connected = metaConn?.connected ?? false;           // §9.6 gate satisfied
  const needsConnect = subscribed && !connected;            // step 2 not yet done
  const canRequest = subscribed && connected;               // step 3 unlocked
  const hasActivity = campaigns.length > 0 || pendingReqs.length > 0;

  const stepLabels = ["Choose a plan", "Connect ad account", "Request a campaign"];
  const currentStep = !subscribed ? 0 : !connected ? 1 : 2;
  const showStepper = !hasActivity; // hide once they have campaigns/requests (onboarding done)

  if (loading) {
    return <div className="flex items-center gap-2 text-gray-400 text-sm py-10"><Loader2 className="w-4 h-4 animate-spin" /> Loading your ads…</div>;
  }

  const qualityBanner = showQualityWarning && (
    <div className="rounded-xl border border-yellow-500/40 bg-yellow-900/15 p-4 flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
      <div className="text-sm text-gray-200 leading-relaxed">
        <span className="font-medium text-yellow-300">Your shop profile may limit ad performance.</span>{" "}
        {lowReview && <>Your review score is below 3.5★. </>}
        {fewPhotos && <>You have fewer than 5 photos. </>}
        Ads send customers to your profile — improving these first makes every ad dollar work harder.
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-[#FFCC00]" /> Your Ads
        </h2>
        {subscribed && capacity && (
          <span className="text-sm text-gray-300">
            <span className="capitalize">{capacity.tier}</span> plan ·{" "}
            <span className={capacity.remaining <= 0 ? "text-amber-400" : "text-white"}>
              {capacity.usedCampaigns} of {capacity.maxCampaigns} campaigns
            </span>
          </span>
        )}
      </div>

      {showStepper && <Stepper labels={stepLabels} current={currentStep} />}
      {qualityBanner}

      {!subscribed ? (
        /* STEP 1 — choose a plan (nothing else shown to a first-timer) */
        <AdEnrollmentCTA onSubscribed={load} />
      ) : (
        <>
          {/* Plan summary (always, once subscribed) */}
          <SubscriptionPanel onChanged={load} />

          {/* STEP 2 — connect Meta (renders connect/connected/null based on state) */}
          <MetaConnectCard onChanged={load} />

          {/* Connect Google (Google plan, Slice 1) — Business tier; behind the rollout flag. */}
          {process.env.NEXT_PUBLIC_ADS_GOOGLE_ENABLED === "true" && <GoogleConnectCard onChanged={load} />}

          {needsConnect ? (
            /* Gate step 3 until the ad account is connected */
            <div className="rounded-xl border border-white/10 bg-[#141414] p-4 flex items-start gap-3">
              <Lock className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
              <p className="text-sm text-gray-400">
                {connectEnabled
                  ? <>Connect your Meta ad account above to unlock <span className="text-gray-200">requesting a campaign</span>.</>
                  : <>Your ad account isn&apos;t connected yet — our team is setting this up. You&apos;ll be able to <span className="text-gray-200">request a campaign</span> once it&apos;s connected.</>}
              </p>
            </div>
          ) : (
            /* STEP 3 — request a campaign + the live rail/performance */
            <>
              <AwaitingResponse mode="shop" />

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
                {/* Left rail: request button + campaigns + in-flight requests */}
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
                          {c.status} · {fmtMoney(c.dailyBudgetCents, c.currency ?? metaConn?.currency)}/day
                          {monthly != null && <span className="normal-case"> · {fmtMoney(monthly, c.currency ?? metaConn?.currency)}/mo</span>}
                        </p>
                      </button>
                    );
                  })}

                  {pendingReqs.map((r) => (
                    <div key={r.id} className="rounded-lg border border-white/10 bg-[#1A1A1A] px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-white truncate capitalize">{r.goal ? r.goal.replace(/_/g, " ") : "Campaign"}</p>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full capitalize shrink-0 ${REQ_STATUS_CLS[r.status] ?? "bg-gray-500/15 text-gray-400"}`}>{r.status}</span>
                      </div>
                      {(r.monthlyBudgetCents != null || r.declineReason) && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {r.monthlyBudgetCents != null && <>{fmtMoney(r.monthlyBudgetCents, metaConn?.currency)}/mo</>}
                          {r.declineReason && <span className="text-red-400/80"> · {r.declineReason}</span>}
                        </p>
                      )}
                    </div>
                  ))}

                  {!hasActivity && (
                    <p className="text-xs text-gray-500 px-1 py-2">No campaigns yet — request your first one above.</p>
                  )}
                </div>

                {/* Performance card */}
                <div className="min-w-0 rounded-xl border border-white/10 bg-[#141414] p-5">
                  {!selectedId ? (
                    <div className="text-center text-gray-400 text-sm py-8">
                      {campaigns.length === 0
                        ? "Once our team builds your campaign, performance shows up here."
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
                        <Stat label="Spend" value={fmtMoney(perf.roi.totalSpendCents, metaConn?.currency)} />
                        <Stat label="Revenue" value={fmtMoney(perf.roi.totalRevenueCents, metaConn?.currency)} />
                        <Stat label="ROI" value={fmtRoi(perf.roi.roi)} accent />
                        <Stat label="Bookings" value={String(perf.roi.totalBookings)} />
                        <Stat label="Leads" value={String(perf.roi.totalLeads)} />
                        <Stat label="Cost / Lead" value={fmtMoney(perf.roi.cplCents, metaConn?.currency)} />
                        <Stat label="Cost / Booking" value={fmtMoney(perf.roi.cpbCents, metaConn?.currency)} />
                        <Stat label="ROAS" value={perf.roi.roas == null ? "—" : `${perf.roi.roas.toFixed(1)}×`} />
                      </div>
                      <div className="mt-5">
                        <p className="text-sm font-medium text-gray-300 mb-2">Leads</p>
                        {selectedId && <LeadKanban mode="shop" campaignId={selectedId} />}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Durable thread with the FixFlow ads team — available once subscribed */}
          <AdMessageThread mode="shop" />
        </>
      )}
    </div>
  );
};

const Stepper: React.FC<{ labels: string[]; current: number }> = ({ labels, current }) => (
  <div className="flex items-center gap-2 flex-wrap rounded-xl border border-white/10 bg-[#141414] px-4 py-3">
    {labels.map((l, i) => (
      <React.Fragment key={l}>
        <div className={`flex items-center gap-1.5 text-xs ${i === current ? "text-[#FFCC00]" : i < current ? "text-green-400" : "text-gray-500"}`}>
          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full border text-[11px] ${i === current ? "border-[#FFCC00] bg-[#FFCC00]/10" : i < current ? "border-green-400/50 bg-green-400/10" : "border-gray-600"}`}>
            {i < current ? "✓" : i + 1}
          </span>
          {l}
        </div>
        {i < labels.length - 1 && <span className="text-gray-600">→</span>}
      </React.Fragment>
    ))}
  </div>
);

const Stat: React.FC<{ label: string; value: string; accent?: boolean }> = ({ label, value, accent }) => (
  <div className="rounded-lg border border-white/10 bg-[#1A1A1A] px-3 py-2.5">
    <p className="text-xs text-gray-500">{label}</p>
    <p className={`text-lg font-semibold ${accent ? "text-[#FFCC00]" : "text-white"}`}>{value}</p>
  </div>
);

export default ShopAdsTab;
