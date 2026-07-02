"use client";

// Admin Ads dashboard (Ads System Stage 1). All-shops summary + campaign list +
// create + per-campaign performance (ROI computed-at-read) + manual daily-metric
// entry. Admin-only; reads/writes /api/ads. Gated by ADS_DASHBOARD_ENABLED upstream.

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Megaphone, TrendingUp, Pause, Play, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { LeadKanban } from "@/components/ads/LeadKanban";
import { AwaitingResponse } from "@/components/ads/AwaitingResponse";
import { IndustryAnalytics } from "@/components/ads/IndustryAnalytics";
import { CreativePreview } from "@/components/ads/CreativePreview";
import { MarginPanel } from "@/components/ads/MarginPanel";
import { CampaignRequestsQueue } from "@/components/ads/CampaignRequestsQueue";
import { AdMessagesInbox } from "@/components/ads/AdMessagesInbox";
import { DraftComposer } from "@/components/ads/DraftComposer";
import { GoogleDraftPanel } from "@/components/ads/GoogleDraftPanel";
import { LandingPageSettings } from "@/components/ads/LandingPageSettings";
import {
  listCampaigns, createCampaign, updateCampaign, goLiveCampaign, getCampaignPerformance,
  enterDailyMetrics, getAllShopsSummary, regenerateAdImage, scaleCampaignBudget, syncCampaignFromMeta, syncCampaignFromGoogle,
  getShopMetaAccount, fmtUsd, fmtMoney, fmtRoi,
  type AdCampaign, type CampaignPerformance, type AllShopsSummary, type ShopMetaAccount,
} from "@/services/api/ads";
import { Wand2, TrendingUp as TrendingUpIcon } from "lucide-react";

const todayStr = () => new Date().toISOString().slice(0, 10);

export const AdminAdsTab: React.FC = () => {
  const [summary, setSummary] = useState<AllShopsSummary | null>(null);
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [perf, setPerf] = useState<CampaignPerformance | null>(null);
  const [metaAccount, setMetaAccount] = useState<ShopMetaAccount | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [savingMetrics, setSavingMetrics] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false); // manual-metrics override (Live mode)
  const [refreshingCreative, setRefreshingCreative] = useState(false);

  // Safeguard 5 — free creative swap on an underperforming live campaign.
  const refreshCreative = async (c: AdCampaign) => {
    setRefreshingCreative(true);
    try {
      await regenerateAdImage(c.id, ""); // empty prompt → auto-derive a fresh creative
      toast.success("New creative generated — free of charge.");
      await load();
      if (selectedId === c.id) await select(c.id);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || "Couldn't refresh the creative.");
    } finally { setRefreshingCreative(false); }
  };

  // Safeguard 4 — scale a test-budget campaign up to its full daily budget.
  const [scaling, setScaling] = useState(false);
  const scaleBudget = async (c: AdCampaign) => {
    setScaling(true);
    try {
      await scaleCampaignBudget(c.id);
      toast.success("Scaled to full budget.");
      await load();
      if (selectedId === c.id) await select(c.id);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || "Couldn't scale the budget.");
    } finally { setScaling(false); }
  };

  // Two-way config sync — pull budget/status back from Meta for this campaign.
  const [syncing, setSyncing] = useState(false);
  const syncFromMeta = async (c: AdCampaign) => {
    setSyncing(true);
    try {
      const r = await syncCampaignFromMeta(c.id);
      if (r.status === "synced") {
        const n = Object.keys(r.changes || {}).length;
        toast.success(`Synced from Meta — updated ${n} field${n > 1 ? "s" : ""}.`);
        await load();
        if (selectedId === c.id) await select(c.id);
      } else if (r.status === "in_sync") {
        toast.success("Already in sync with Meta.");
      } else if (r.status === "diverged") {
        toast.error(r.reason === "meta_deleted"
          ? "This campaign was deleted in Ads Manager — marked archived. It can't go live again."
          : "This campaign was archived in Ads Manager — marked archived here.");
        await load();
        if (selectedId === c.id) await select(c.id);
      } else if (r.status === "skipped") {
        toast(r.reason === "disconnected" ? "Reconnect the shop's Meta account to sync." : "This campaign isn't on Meta yet.");
      } else if (r.status === "error") {
        toast.error("Couldn't reach Meta — please try again.");
      } else {
        toast("Meta config sync isn't enabled.");
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || "Couldn't sync from Meta.");
    } finally { setSyncing(false); }
  };

  // Two-way config sync — pull budget/status back from Google for this campaign (Slice 5).
  const syncFromGoogle = async (c: AdCampaign) => {
    setSyncing(true);
    try {
      const r = await syncCampaignFromGoogle(c.id);
      if (r.status === "synced") {
        const n = Object.keys(r.changes || {}).length;
        toast.success(`Synced from Google — updated ${n} field${n > 1 ? "s" : ""}.`);
        await load();
        if (selectedId === c.id) await select(c.id);
      } else if (r.status === "in_sync") {
        toast.success("Already in sync with Google.");
      } else if (r.status === "diverged") {
        toast.error("This campaign was removed in Google Ads — marked archived here. It can't go live again.");
        await load();
        if (selectedId === c.id) await select(c.id);
      } else if (r.status === "skipped") {
        toast(r.reason === "disconnected" ? "Reconnect the shop's Google account to sync." : "This campaign isn't on Google yet.");
      } else if (r.status === "error") {
        toast.error("Couldn't reach Google — please try again.");
      } else {
        toast("Google config sync isn't enabled.");
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || e?.message || "Couldn't sync from Google.");
    } finally { setSyncing(false); }
  };

  const [form, setForm] = useState({ shopId: "", name: "", dailyBudget: "", notes: "" });
  const [metrics, setMetrics] = useState({
    date: todayStr(), spend: "", impressions: "", clicks: "", leads: "", bookings: "", revenue: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, s] = await Promise.all([
        listCampaigns().catch(() => ({ items: [] as AdCampaign[], total: 0 })),
        getAllShopsSummary().catch(() => null),
      ]);
      setCampaigns(c.items);
      setSummary(s);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const select = async (id: string) => {
    setSelectedId(id);
    setPerf(null);
    setMetaAccount(null);
    try { setPerf(await getCampaignPerformance(id)); }
    catch (e: any) { toast.error(e?.message || "Couldn't load performance."); }
    // Best-effort: learn the shop's Meta-account state (incl. the config-sync flag) so the
    // "Refresh from Meta" button only shows when the feature is on. Never blocks the view.
    const shopId = campaigns.find((c) => c.id === id)?.shopId;
    if (shopId) getShopMetaAccount(shopId).then(setMetaAccount).catch(() => setMetaAccount(null));
  };

  const toggleAiAgent = async (c: AdCampaign) => {
    try {
      await updateCampaign(c.id, { aiAgentEnabled: !c.aiAgentEnabled });
      await load();
      toast.success(c.aiAgentEnabled ? "AI auto-answer off." : "AI auto-answer on — new lead replies are answered automatically.");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't update AI auto-answer.");
    }
  };

  const submitCreate = async () => {
    if (!form.shopId.trim() || !form.name.trim()) {
      toast.error("Shop ID and campaign name are required.");
      return;
    }
    setCreating(true);
    try {
      await createCampaign({
        shopId: form.shopId.trim(),
        name: form.name.trim(),
        dailyBudgetCents: form.dailyBudget ? Math.round(parseFloat(form.dailyBudget) * 100) : 0,
        notes: form.notes.trim() || null,
      });
      toast.success("Campaign created.");
      setShowCreate(false);
      setForm({ shopId: "", name: "", dailyBudget: "", notes: "" });
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Couldn't create campaign.");
    } finally {
      setCreating(false);
    }
  };

  const toggleStatus = async (c: AdCampaign) => {
    try {
      if (c.status === "active") {
        // Pausing is always safe.
        await updateCampaign(c.id, { status: "paused" });
      } else if ((c.metaCampaignId || c.googleCampaignId) && !c.startedAt) {
        // First-time go-live: must run the GATED flow (funding + creative/conversion checks) with an
        // explicit confirmation — NOT a silent raw activate that starts real ad spend. The backend
        // also enforces this (409 use_go_live) for both Meta and Google.
        const platform = c.googleCampaignId ? "Google" : "Meta";
        if (!window.confirm(`Take "${c.name}" live? Your ad account will start spending on ${platform}.`)) return;
        await goLiveCampaign(c.id);
        toast.success("Campaign is live!");
      } else {
        // Re-activating a previously-live campaign — already vetted at first go-live.
        await updateCampaign(c.id, { status: "active" });
      }
      await load();
      if (selectedId === c.id) await select(c.id);
    } catch (e: any) {
      // 409 = tier capacity (§9.5) or use_go_live; otherwise a go-live gate (funding/creative).
      toast.error(e?.response?.data?.message || e?.response?.data?.error || e?.message || "Couldn't update status.");
    }
  };

  const saveMetrics = async () => {
    if (!selectedId) return;
    const num = (v: string) => (v ? parseInt(v, 10) : 0);
    setSavingMetrics(true);
    try {
      const updated = await enterDailyMetrics(selectedId, {
        date: metrics.date,
        spendCents: metrics.spend ? Math.round(parseFloat(metrics.spend) * 100) : 0,
        impressions: num(metrics.impressions),
        clicks: num(metrics.clicks),
        leadsCaptured: num(metrics.leads),
        bookingsCreated: num(metrics.bookings),
        revenueCents: metrics.revenue ? Math.round(parseFloat(metrics.revenue) * 100) : 0,
      });
      setPerf(updated);
      await load(); // refresh summary
      toast.success(`Metrics saved for ${metrics.date}.`);
    } catch (e: any) {
      toast.error(e?.message || "Couldn't save metrics.");
    } finally {
      setSavingMetrics(false);
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-gray-400 text-sm py-10"><Loader2 className="w-4 h-4 animate-spin" /> Loading ads…</div>;
  }

  const selected = campaigns.find((c) => c.id === selectedId) || null;
  // Pre-live (drafting) vs launched (operating): a campaign that has gone live at least once
  // (startedAt) or is active shows the metrics view; otherwise the review/push view.
  const launched = !!selected && (selected.status === "active" || !!selected.startedAt);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-[#FFCC00]" /> Ads
        </h2>
        <Button onClick={() => setShowCreate((v) => !v)} className="bg-[#FFCC00] text-black hover:bg-[#E6B800] font-medium">
          <Plus className="w-4 h-4" /> New Campaign
        </Button>
      </div>

      {/* Shop messages inbox (#2) — reachable in any lifecycle state, flags shops awaiting a reply */}
      <AdMessagesInbox />

      {/* Campaign requests to build (shops self-serve subscribe; admin builds the campaigns) */}
      <CampaignRequestsQueue onBuilt={load} />

      {/* First-response SLA */}
      <AwaitingResponse mode="admin" />

      {/* All-shops summary */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Stat label="Total Spend" value={fmtUsd(summary.totalSpendCents)} />
          <Stat label="Total Revenue" value={fmtUsd(summary.totalRevenueCents)} />
          <Stat label="ROI" value={fmtRoi(summary.totalSpendCents > 0 ? (summary.totalRevenueCents - summary.totalSpendCents) / summary.totalSpendCents : null)} accent />
          <Stat label="Bookings" value={String(summary.totalBookings)} />
          <Stat label="Campaigns" value={String(summary.campaignCount)} />
        </div>
      )}

      {/* Stage 5 — per-industry comparison */}
      <IndustryAnalytics />

      {/* Create form */}
      {showCreate && (
        <div className="rounded-xl border border-[#FFCC00]/30 bg-[#1A1A1A] p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Shop ID"><input className={inputCls} value={form.shopId} onChange={(e) => setForm({ ...form, shopId: e.target.value })} placeholder="e.g. tcoy" /></Field>
          <Field label="Campaign name"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Spring promo" /></Field>
          <Field label="Daily budget (account currency)"><input className={inputCls} type="number" value={form.dailyBudget} onChange={(e) => setForm({ ...form, dailyBudget: e.target.value })} placeholder="25" /></Field>
          <Field label="Notes"><input className={inputCls} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <div className="sm:col-span-2">
            <Button onClick={submitCreate} disabled={creating} className="bg-[#FFCC00] text-black hover:bg-[#E6B800] font-medium">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create
            </Button>
          </div>
        </div>
      )}

      {/* Campaign list */}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#1A1A1A] text-gray-400">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Campaign</th>
              <th className="text-left px-4 py-2 font-medium">Shop</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
              <th className="text-right px-4 py-2 font-medium">Budget/day</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">No campaigns yet.</td></tr>
            )}
            {campaigns.map((c) => (
              <tr key={c.id} className={`border-t border-white/5 cursor-pointer hover:bg-white/5 ${selectedId === c.id ? "bg-white/5" : ""}`} onClick={() => select(c.id)}>
                <td className="px-4 py-2.5 text-white">{c.name}</td>
                <td className="px-4 py-2.5 text-gray-300">{c.shopId}</td>
                <td className="px-4 py-2.5"><StatusBadge status={c.status} /></td>
                <td className="px-4 py-2.5 text-right text-gray-300">{fmtMoney(c.dailyBudgetCents, c.currency)}</td>
                <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => toggleStatus(c)} className="text-gray-400 hover:text-white" title={c.status === "active" ? "Pause" : "Activate"}>
                    {c.status === "active" ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Selected campaign — performance + metric entry */}
      {selected && (
        <div className="rounded-xl border border-white/10 bg-[#141414] p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#FFCC00]" /> {selected.name}
            </h3>
            <div className="flex items-center gap-3">
              <button
                onClick={() => toggleAiAgent(selected)}
                className="inline-flex items-center gap-2 text-xs text-gray-300 hover:text-white"
                title="When on, the AI automatically answers new lead replies"
              >
                <span className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${selected.aiAgentEnabled ? "bg-[#FFCC00]" : "bg-gray-600"}`}>
                  <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${selected.aiAgentEnabled ? "translate-x-3.5" : "translate-x-0.5"}`} />
                </span>
                AI auto-answer
              </button>
              <button onClick={() => select(selected.id)} className="text-gray-400 hover:text-white"><RefreshCw className="w-4 h-4" /></button>
            </div>
          </div>

          {!launched ? (
            /* ─── DRAFTING ─── a Google draft (copy + keywords live on Google, not our creative
               table) gets the lighter Google review→go-live card; a Meta draft gets the full
               creative composer. */
            selected.googleCampaignId ? (
              <GoogleDraftPanel campaign={selected} onGoLive={() => toggleStatus(selected)} />
            ) : (
              <DraftComposer campaign={selected} onChanged={load} />
            )
          ) : !perf ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading performance…</div>
          ) : (
            /* ─── LIVE / OPERATING ─── metrics, true margin, creative, leads. */
            <>
              {/* Two-way config sync — pull budget/status back from Meta. Shown only for pushed
                  campaigns AND when the feature flag is on (from the shop's meta-account check). */}
              {selected.metaCampaignId && metaAccount?.configSyncEnabled && (
                <div className="flex items-center justify-end">
                  <button
                    onClick={() => syncFromMeta(selected)}
                    disabled={syncing}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-50"
                    title="Pull the latest budget & status from Meta Ads Manager"
                  >
                    {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Refresh from Meta
                  </button>
                </div>
              )}
              {/* Two-way config sync for a Google campaign. Shown for any pushed Google campaign;
                  if the feature flag is off server-side the toast says so (no shop-account gate). */}
              {selected.googleCampaignId && (
                <div className="flex items-center justify-end">
                  <button
                    onClick={() => syncFromGoogle(selected)}
                    disabled={syncing}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-50"
                    title="Pull the latest budget & status from Google Ads"
                  >
                    {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Refresh from Google
                  </button>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label="Spend" value={fmtMoney(perf.roi.totalSpendCents, selected.currency)} />
                <Stat label="Revenue" value={fmtMoney(perf.roi.totalRevenueCents, selected.currency)} />
                <Stat label="ROI" value={fmtRoi(perf.roi.roi)} accent />
                <Stat label="Bookings" value={String(perf.roi.totalBookings)} />
                <Stat label="Leads" value={String(perf.roi.totalLeads)} />
                <Stat label="Cost / Lead" value={fmtMoney(perf.roi.cplCents, selected.currency)} />
                <Stat label="Cost / Booking" value={fmtMoney(perf.roi.cpbCents, selected.currency)} />
                <Stat label="ROAS" value={perf.roi.roas == null ? "—" : `${perf.roi.roas.toFixed(1)}×`} />
              </div>

              {/* True margin (Q6) — admin only */}
              <MarginPanel campaignId={selected.id} />

              {/* Safeguard 4 — test budget performed: scale up to full budget */}
              {selected.testBudgetUpgradeReady && (
                <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-3 flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-green-300">Test budget is performing</p>
                    <p className="text-xs text-green-200/80 mt-0.5">It's hit at least break-even ROI over the test window{selected.fullDailyBudgetCents ? ` — scale to ${fmtMoney(selected.fullDailyBudgetCents, selected.currency)}/day` : ""}.</p>
                  </div>
                  <button onClick={() => scaleBudget(selected)} disabled={scaling}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-50 shrink-0">
                    {scaling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TrendingUpIcon className="w-3.5 h-3.5" />} Scale to full budget
                  </button>
                </div>
              )}

              {/* Safeguard 5 — underperformance nudge: swap the creative for free */}
              {selected.needsCreativeRefresh && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-amber-300">This campaign is underperforming</p>
                    <p className="text-xs text-amber-200/80 mt-0.5">{selected.creativeRefreshReason || "Try a fresh creative."} — swapping the creative is free.</p>
                  </div>
                  <button onClick={() => refreshCreative(selected)} disabled={refreshingCreative}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-[#FFCC00] text-black hover:bg-[#E6B800] disabled:opacity-50 shrink-0">
                    {refreshingCreative ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} Refresh creative (free)
                  </button>
                </div>
              )}

              {/* Current ad — read-only (editing lives in the draft, pre-launch) */}
              <CreativePreview campaignId={selected.id} />

              {/* Lead pipeline (Stage 2) */}
              <div>
                <p className="text-sm font-medium text-gray-300 mb-2">Leads</p>
                <LeadKanban mode="admin" campaignId={selected.id} />
              </div>

              {/* 30-day rows */}
              {perf.dailyRows.length > 0 && (
                <div className="rounded-lg border border-white/10 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-[#1A1A1A] text-gray-500">
                      <tr><th className="text-left px-3 py-2">Date</th><th className="text-right px-3 py-2">Spend</th><th className="text-right px-3 py-2">Leads</th><th className="text-right px-3 py-2">Bookings</th><th className="text-right px-3 py-2">Revenue</th></tr>
                    </thead>
                    <tbody>
                      {perf.dailyRows.map((r) => (
                        <tr key={r.date} className="border-t border-white/5">
                          <td className="px-3 py-1.5 text-gray-300">{r.date}</td>
                          <td className="px-3 py-1.5 text-right text-gray-300">{fmtMoney(r.spendCents, selected.currency)}</td>
                          <td className="px-3 py-1.5 text-right text-gray-300">{r.leadsCaptured}</td>
                          <td className="px-3 py-1.5 text-right text-gray-300">{r.bookingsCreated}</td>
                          <td className="px-3 py-1.5 text-right text-gray-300">{fmtMoney(r.revenueCents, selected.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Manual metrics — collapsed override (Meta auto-syncs spend/impressions/clicks). */}
              <div className="rounded-lg border border-white/10 bg-[#1A1A1A]">
                <button onClick={() => setShowMetrics((v) => !v)} className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-gray-400 hover:text-white">
                  <span>Enter metrics manually (override)</span>
                  {showMetrics ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showMetrics && (
                  <div className="px-4 pb-4">
                    <p className="text-xs text-gray-500 mb-3">Meta syncs spend, impressions &amp; clicks automatically — use this only to correct or backfill.</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                      <Field label="Date"><input className={inputCls} type="date" value={metrics.date} onChange={(e) => setMetrics({ ...metrics, date: e.target.value })} /></Field>
                      <Field label={`Spend (${selected.currency || "USD"})`}><input className={inputCls} type="number" value={metrics.spend} onChange={(e) => setMetrics({ ...metrics, spend: e.target.value })} /></Field>
                      <Field label="Impr."><input className={inputCls} type="number" value={metrics.impressions} onChange={(e) => setMetrics({ ...metrics, impressions: e.target.value })} /></Field>
                      <Field label="Clicks"><input className={inputCls} type="number" value={metrics.clicks} onChange={(e) => setMetrics({ ...metrics, clicks: e.target.value })} /></Field>
                      <Field label="Leads"><input className={inputCls} type="number" value={metrics.leads} onChange={(e) => setMetrics({ ...metrics, leads: e.target.value })} /></Field>
                      <Field label="Bookings"><input className={inputCls} type="number" value={metrics.bookings} onChange={(e) => setMetrics({ ...metrics, bookings: e.target.value })} /></Field>
                      <Field label={`Revenue (${selected.currency || "USD"})`}><input className={inputCls} type="number" value={metrics.revenue} onChange={(e) => setMetrics({ ...metrics, revenue: e.target.value })} /></Field>
                    </div>
                    <Button onClick={saveMetrics} disabled={savingMetrics} className="mt-3 bg-[#FFCC00] text-black hover:bg-[#E6B800] font-medium">
                      {savingMetrics ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save metrics
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Landing-page magnet editor — available for both draft and live campaigns */}
          <LandingPageSettings campaign={selected} />
        </div>
      )}
    </div>
  );
};

const inputCls = "w-full px-2.5 py-1.5 bg-[#0F0F0F] border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:border-[#FFCC00] transition-colors";

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-xs text-gray-500 mb-1">{label}</label>
    {children}
  </div>
);

const Stat: React.FC<{ label: string; value: string; accent?: boolean }> = ({ label, value, accent }) => (
  <div className="rounded-lg border border-white/10 bg-[#1A1A1A] px-3 py-2.5">
    <p className="text-xs text-gray-500">{label}</p>
    <p className={`text-lg font-semibold ${accent ? "text-[#FFCC00]" : "text-white"}`}>{value}</p>
  </div>
);

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, string> = {
    active: "bg-green-500/15 text-green-400",
    paused: "bg-yellow-500/15 text-yellow-400",
    draft: "bg-gray-500/15 text-gray-400",
    archived: "bg-gray-700/30 text-gray-500",
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full ${map[status] || map.draft}`}>{status}</span>;
};

export default AdminAdsTab;
