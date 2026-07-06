"use client";

// Shop Ads view. Onboarding is a GATED, ordered flow so a first-timer only sees the next
// step — not everything at once:
//   Step 1  Choose a plan (subscribe)
//   Step 2  Connect your Meta ad account   (only when the self-serve connect flow is enabled)
//   Step 3  Request a campaign             (admin then builds it → goes live)
// Each step unlocks the next; the campaign rail + performance appear once there's activity.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Megaphone, TrendingUp, AlertTriangle, Plus, X, Lock, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import { LeadKanban } from "@/components/ads/LeadKanban";
import { ConversationInbox } from "@/components/ads/ConversationInbox";
import { AdMessageThread } from "@/components/ads/AdMessageThread";
import { SubscriptionPanel } from "@/components/ads/SubscriptionPanel";
import { MetaConnectCard } from "@/components/ads/MetaConnectCard";
import { GoogleConnectCard } from "@/components/ads/GoogleConnectCard";
import { AwaitingResponse } from "@/components/ads/AwaitingResponse";
import { AdEnrollmentCTA } from "@/components/ads/AdEnrollmentCTA";
import { CampaignBriefFields, briefToApi, emptyBrief, type BriefValue } from "@/components/ads/CampaignBriefFields";
import {
  listShopCampaigns, getShopCampaignPerformance, getShopCapacity, setShopCampaignOutreachMode,
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

const CAMP_STATUS_CLS: Record<string, string> = {
  active: "text-green-400",
  paused: "text-amber-400",
  draft: "text-blue-400",
  archived: "text-gray-500",
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
      // Land on the campaign LIST (master), not a campaign's detail — the shop picks one to drill in.
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Anchor for the campaigns/detail region — we scroll THIS into view on select instead of the
  // window top, so the detail lands in view without yanking the page up past the plan/connect cards.
  const sectionRef = useRef<HTMLDivElement>(null);
  const scrollToSection = () => {
    requestAnimationFrame(() => sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const select = async (id: string) => {
    setSelectedId(id);
    setPerf(null);
    scrollToSection(); // bring the campaign section (→ detail) to the top of the viewport
    try { setPerf(await getShopCampaignPerformance(id)); }
    catch (e: any) { toast.error(e?.message || "Couldn't load performance."); }
  };

  const backToList = () => {
    setSelectedId(null);
    setPerf(null);
    scrollToSection();
  };

  // Part B — leads view (Conversation Inbox primary vs. Pipeline Kanban) + AI first-contact mode.
  const [leadView, setLeadView] = useState<"inbox" | "pipeline">("inbox");
  const [savingMode, setSavingMode] = useState(false);
  const changeOutreachMode = async (mode: "off" | "draft" | "auto") => {
    if (!selectedId) return;
    setSavingMode(true);
    try {
      await setShopCampaignOutreachMode(selectedId, mode);
      setCampaigns((prev) => prev.map((c) => (c.id === selectedId ? { ...c, aiOutreachMode: mode } : c)));
      toast.success(
        mode === "auto" ? "AI will greet new leads automatically."
          : mode === "draft" ? "AI will draft a first message for you to send."
          : "AI first-contact turned off."
      );
    } catch (e: any) {
      toast.error(e?.response?.data?.error || e?.message || "Couldn't update outreach mode.");
    } finally {
      setSavingMode(false);
    }
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
  const selectedCampaign = campaigns.find((c) => c.id === selectedId) || null;

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

              {/* Scroll anchor — select()/back scroll HERE (not window-top) so the detail lands in
                  view without jumping the page up past the plan/connect cards. */}
              <div ref={sectionRef} className="scroll-mt-4" />

              {/* Request form — list mode only */}
              {!selectedId && reqOpen && (
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

              {!selectedId ? (
                /* ── LIST MODE ── request button + campaigns table + requests in review. Clicking a
                   row opens the performance detail (below), so identical names don't blur together. */
                <div className="space-y-4">
                  <button
                    onClick={() => setReqOpen((v) => !v)}
                    className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-md bg-[#FFCC00] text-black hover:bg-[#E6B800]"
                  >
                    {reqOpen ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />} {reqOpen ? "Cancel" : "Request a campaign"}
                  </button>

                  {campaigns.length > 0 && (
                    <div className="rounded-xl border border-white/10 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-[#1A1A1A] text-gray-400">
                          <tr>
                            <th className="text-left px-4 py-2 font-medium">Campaign</th>
                            <th className="text-left px-4 py-2 font-medium">Status</th>
                            <th className="text-left px-4 py-2 font-medium">Goal</th>
                            <th className="text-right px-4 py-2 font-medium">Budget/day</th>
                            <th className="text-right px-4 py-2 font-medium">Monthly</th>
                          </tr>
                        </thead>
                        <tbody>
                          {campaigns.map((c) => {
                            const req = reqByCampaign.get(c.id);
                            const monthly = monthlyOf(c.id);
                            const ccy = c.currency ?? metaConn?.currency;
                            return (
                              <tr key={c.id} onClick={() => select(c.id)} className="border-t border-white/5 cursor-pointer hover:bg-white/5">
                                <td className="px-4 py-2.5 text-white">{c.name}</td>
                                <td className="px-4 py-2.5"><span className={`capitalize ${CAMP_STATUS_CLS[c.status] ?? "text-gray-300"}`}>{c.status}</span></td>
                                <td className="px-4 py-2.5 text-gray-400 capitalize">{req?.goal ? req.goal.replace(/_/g, " ") : "—"}</td>
                                <td className="px-4 py-2.5 text-right text-gray-300">{fmtMoney(c.dailyBudgetCents, ccy)}</td>
                                <td className="px-4 py-2.5 text-right text-gray-300">{monthly != null ? fmtMoney(monthly, ccy) : "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {pendingReqs.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-300">Requests in review</p>
                      {pendingReqs.map((r) => {
                        const ccy = metaConn?.currency;
                        const line = [
                          r.promoteServiceIds?.length ? `${r.promoteServiceIds.length} service${r.promoteServiceIds.length > 1 ? "s" : ""}` : null,
                          r.monthlyBudgetCents != null ? `${fmtMoney(r.monthlyBudgetCents, ccy)}/mo` : null,
                          r.targetRadiusMiles != null ? `${r.targetRadiusMiles} mi` : null,
                          r.goal ? r.goal.replace(/_/g, " ") : null,
                        ].filter(Boolean).join(" · ");
                        return (
                          <div key={r.id} className="rounded-lg border border-white/10 bg-[#1A1A1A] px-3 py-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-white capitalize">{r.goal ? r.goal.replace(/_/g, " ") : "Campaign"}</p>
                              <span className={`text-[11px] px-2 py-0.5 rounded-full capitalize shrink-0 ${REQ_STATUS_CLS[r.status] ?? "bg-gray-500/15 text-gray-400"}`}>{r.status}</span>
                            </div>
                            {line && <p className="text-xs text-gray-400 mt-0.5 capitalize">{line}</p>}
                            {r.offer && <p className="text-xs text-gray-500 mt-0.5">Offer: {r.offer}</p>}
                            {r.message && <p className="text-xs text-gray-500 mt-0.5 italic">“{r.message}”</p>}
                            {r.declineReason && <p className="text-xs text-red-400/80 mt-0.5">{r.declineReason}</p>}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {!hasActivity && (
                    <p className="text-sm text-gray-500 py-8 text-center rounded-xl border border-white/10 bg-[#141414]">No campaigns yet — request your first one above.</p>
                  )}
                </div>
              ) : (
                /* ── DETAIL MODE ── the selected campaign's performance, in place of the list. */
                <div className="space-y-4">
                  <button onClick={backToList} className="inline-flex items-center gap-2 text-sm font-medium text-gray-300 hover:text-white">
                    <ArrowLeft className="w-4 h-4" /> Back to campaigns
                  </button>
                  <div className="rounded-xl border border-white/10 bg-[#141414] p-5">
                    {!perf ? (
                      <div className="flex items-center gap-2 text-gray-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
                    ) : (
                      <>
                        <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                          <TrendingUp className="w-5 h-5 text-[#FFCC00]" /> {selectedCampaign?.name ?? "Performance"}
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
                        <div className="mt-5 rounded-lg border border-white/10 bg-[#1A1A1A] p-4">
                          <p className="text-sm font-medium text-gray-200">AI first contact</p>
                          <p className="text-xs text-gray-400 mt-0.5 mb-3">
                            How the AI reaches out when a new lead comes in. Speed wins leads — replies still route
                            back to you.
                          </p>
                          <div className="inline-flex rounded-md border border-white/10 overflow-hidden">
                            {([
                              { m: "off", label: "Off", hint: "You contact leads manually" },
                              { m: "draft", label: "Draft", hint: "AI writes it, you send" },
                              { m: "auto", label: "Auto", hint: "AI sends the first message" },
                            ] as const).map(({ m, label, hint }) => {
                              const active = (selectedCampaign?.aiOutreachMode ?? "off") === m;
                              return (
                                <button
                                  key={m}
                                  onClick={() => changeOutreachMode(m)}
                                  disabled={savingMode || active}
                                  title={hint}
                                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${active ? "bg-[#FFCC00] text-black" : "bg-transparent text-gray-300 hover:bg-white/5"} disabled:opacity-100 border-r border-white/10 last:border-r-0`}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                          {(selectedCampaign?.aiOutreachMode ?? "off") === "auto" && (
                            <p className="text-[11px] text-[#FFCC00]/80 mt-2">
                              New leads with an email get an instant AI greeting, on your brand.
                            </p>
                          )}
                        </div>
                        <div className="mt-5">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-gray-300">Leads</p>
                            <div className="inline-flex rounded-md border border-white/10 overflow-hidden">
                              {([
                                { v: "inbox", label: "Conversations" },
                                { v: "pipeline", label: "Pipeline" },
                              ] as const).map(({ v, label }) => (
                                <button
                                  key={v}
                                  onClick={() => setLeadView(v)}
                                  className={`px-3 py-1 text-xs font-medium transition-colors border-r border-white/10 last:border-r-0 ${leadView === v ? "bg-[#FFCC00] text-black" : "bg-transparent text-gray-300 hover:bg-white/5"}`}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>
                          {selectedId && (leadView === "inbox"
                            ? <ConversationInbox mode="shop" campaignId={selectedId} />
                            : <LeadKanban mode="shop" campaignId={selectedId} />)}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
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
