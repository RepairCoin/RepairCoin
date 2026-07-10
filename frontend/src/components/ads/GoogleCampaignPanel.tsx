"use client";

// Admin live/operating view — the GOOGLE-specific slice. A Google Search campaign's ad copy +
// keywords live in Google Ads (not our creative table), so this is deliberately small: a link out
// to Google Ads + the two-way config sync. The shared metrics/margin/leads/rows are rendered by the
// parent (AdminAdsTab) for both platforms. Sibling of MetaCampaignPanel — one component per platform
// keeps each platform's element set self-contained (no per-element guards). Custom dark ads theme.

import React from "react";
import { Loader2, RefreshCw, ExternalLink } from "lucide-react";
import type { AdCampaign } from "@/services/api/ads";

export const GoogleCampaignPanel: React.FC<{
  campaign: AdCampaign;
  syncing: boolean;
  onSync: () => void;
}> = ({ campaign, syncing, onSync }) => (
  <div className="flex items-center justify-between gap-3 flex-wrap">
    <a
      href={`https://ads.google.com/aw/campaigns?campaignId=${campaign.googleCampaignId ?? ""}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white"
    >
      <ExternalLink className="w-3.5 h-3.5" /> View ad &amp; keywords in Google Ads
    </a>
    <button
      onClick={onSync}
      disabled={syncing}
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-50"
      title="Pull the latest budget & status from Google Ads"
    >
      {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Refresh from Google
    </button>
  </div>
);

export default GoogleCampaignPanel;
