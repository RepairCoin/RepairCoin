"use client";

// Admin live/operating view — the META-specific slice: two-way config sync, Safeguard-4 test-budget
// scale-up, Safeguard-5 creative-refresh nudge, and the read-only ad creative. These are all
// Meta-only (image creative, ad-set budget, Advantage+); a Google campaign uses GoogleCampaignPanel
// instead. The shared metrics/margin/leads/rows are rendered by the parent (AdminAdsTab). Custom
// dark ads theme.

import React from "react";
import { Loader2, RefreshCw, Wand2, TrendingUp } from "lucide-react";
import { CreativePreview } from "@/components/ads/CreativePreview";
import { fmtMoney, type AdCampaign } from "@/services/api/ads";

export const MetaCampaignPanel: React.FC<{
  campaign: AdCampaign;
  /** Meta config sync available (pushed + shop's account flag on). */
  configSyncEnabled: boolean;
  syncing: boolean;
  onSync: () => void;
  scaling: boolean;
  onScale: () => void;
  refreshing: boolean;
  onRefreshCreative: () => void;
}> = ({ campaign, configSyncEnabled, syncing, onSync, scaling, onScale, refreshing, onRefreshCreative }) => (
  <>
    {/* Two-way config sync — pull budget/status back from Meta Ads Manager. */}
    {configSyncEnabled && (
      <div className="flex items-center justify-end">
        <button
          onClick={onSync}
          disabled={syncing}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-50"
          title="Pull the latest budget & status from Meta Ads Manager"
        >
          {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Refresh from Meta
        </button>
      </div>
    )}

    {/* Safeguard 4 — test budget performed: scale up to full budget. */}
    {campaign.testBudgetUpgradeReady && (
      <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-3 flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-medium text-green-300">Test budget is performing</p>
          <p className="text-xs text-green-200/80 mt-0.5">It&apos;s hit at least break-even ROI over the test window{campaign.fullDailyBudgetCents ? ` — scale to ${fmtMoney(campaign.fullDailyBudgetCents, campaign.currency)}/day` : ""}.</p>
        </div>
        <button onClick={onScale} disabled={scaling}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-50 shrink-0">
          {scaling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TrendingUp className="w-3.5 h-3.5" />} Scale to full budget
        </button>
      </div>
    )}

    {/* Safeguard 5 — underperformance nudge: swap the creative for free. */}
    {campaign.needsCreativeRefresh && (
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-medium text-amber-300">This campaign is underperforming</p>
          <p className="text-xs text-amber-200/80 mt-0.5">{campaign.creativeRefreshReason || "Try a fresh creative."} — swapping the creative is free.</p>
        </div>
        <button onClick={onRefreshCreative} disabled={refreshing}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-[#FFCC00] text-black hover:bg-[#E6B800] disabled:opacity-50 shrink-0">
          {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />} Refresh creative (free)
        </button>
      </div>
    )}

    {/* Current ad — read-only (editing lives in the draft, pre-launch). */}
    <CreativePreview campaignId={campaign.id} />
  </>
);

export default MetaCampaignPanel;
