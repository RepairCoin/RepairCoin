"use client";

// Admin panel for a Google campaign that's been built (PAUSED on the shop's Google Ads account)
// but hasn't gone live yet. The Meta DraftComposer is creative-approval shaped and doesn't fit the
// Google flow (the ad copy + keywords live on Google, not in our creative table), so a Google draft
// gets this lighter review-then-go-live card. Matches the custom dark ads theme (not shadcn).

import React, { useState } from "react";
import { Loader2, Rocket, ExternalLink } from "lucide-react";
import { fmtMoney, type AdCampaign } from "@/services/api/ads";

export const GoogleDraftPanel: React.FC<{
  campaign: AdCampaign;
  onGoLive: () => Promise<void> | void;
}> = ({ campaign, onGoLive }) => {
  const [busy, setBusy] = useState(false);
  const status = campaign.googleStatus || "PAUSED";
  const managerUrl = `https://ads.google.com/aw/campaigns?ocid=&campaignId=${campaign.googleCampaignId ?? ""}`;

  const go = async () => {
    setBusy(true);
    try { await onGoLive(); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-white/10 bg-[#1A1A1A] p-4 space-y-3">
        <p className="text-sm text-gray-300">
          Created on Google Ads as a <span className="text-white font-medium">paused</span> Search campaign
          (budget, responsive search ad &amp; keywords). Nothing serves or spends until you take it live.
        </p>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Row label="Google status" value={status} />
          <Row label="Budget / day" value={fmtMoney(campaign.dailyBudgetCents, campaign.currency)} />
          <Row label="Campaign ID" value={campaign.googleCampaignId ?? "—"} mono />
          <Row label="Ad group ID" value={campaign.googleAdGroupId ?? "—"} mono />
        </dl>
        <a
          href={managerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white"
        >
          <ExternalLink className="w-3.5 h-3.5" /> Review in Google Ads
        </a>
      </div>

      <div className="rounded-lg border border-[#FFCC00]/20 bg-[#FFCC00]/5 p-4 space-y-3">
        <p className="text-xs text-gray-400 leading-relaxed">
          Going live enables the campaign, ad group &amp; ad on Google — real spend starts.
          Google requires the shop&apos;s account to have a <span className="text-gray-200">conversion action</span> and
          a <span className="text-gray-200">payment method</span> first; Go Live checks both and tells you what&apos;s missing.
        </p>
        <button
          onClick={go}
          disabled={busy}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FFCC00] text-black font-medium hover:bg-[#E6B800] disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />} Go Live on Google
        </button>
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="flex flex-col">
    <dt className="text-[11px] uppercase tracking-wide text-gray-500">{label}</dt>
    <dd className={`text-gray-200 ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
  </div>
);

export default GoogleDraftPanel;
