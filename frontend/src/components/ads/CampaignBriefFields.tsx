"use client";

// Shared campaign-brief inputs (services / budget / offer / radius / goal). Reused by
// the opt-in form (AdEnrollmentCTA) and the recurring campaign-request form in the
// shop Ads tab's campaign rail (ShopAdsTab). Controlled — parent owns the value.

import React, { useEffect, useState } from "react";
import {
  CAMPAIGN_GOALS, getMetaConnection, getAdChannelEligibility,
  type CampaignBrief, type CampaignGoal, type AdChannel, type AdChannelEligibility,
} from "@/services/api/ads";
import { getShopServices, type ShopService } from "@/services/api/services";

// Multi-channel foundation (Google Ads plan, Slice 2). Off by default — Standard shops + everyone
// sees no change until the rollout flag is on.
const GOOGLE_CHANNEL_ENABLED = process.env.NEXT_PUBLIC_ADS_GOOGLE_ENABLED === "true";

export interface BriefValue {
  serviceIds: string[];
  budgetUsd: string;
  offer: string;
  radius: string;
  goal: CampaignGoal | "";
  channel: AdChannel;
}
export const emptyBrief: BriefValue = { serviceIds: [], budgetUsd: "", offer: "", radius: "", goal: "", channel: "meta" };

/** Convert the UI value to the API brief shape. */
export function briefToApi(v: BriefValue): CampaignBrief {
  return {
    promoteServiceIds: v.serviceIds,
    monthlyBudgetCents: v.budgetUsd ? Math.round(parseFloat(v.budgetUsd) * 100) : null,
    offer: v.offer.trim() || null,
    targetRadiusMiles: v.radius ? parseInt(v.radius, 10) : null,
    goal: v.goal || null,
    channel: v.channel,
  };
}

export const CampaignBriefFields: React.FC<{
  shopId: string;
  value: BriefValue;
  onChange: (v: BriefValue) => void;
}> = ({ shopId, value, onChange }) => {
  const [services, setServices] = useState<ShopService[]>([]);
  // The shop's connected ad-account currency — so the budget reads in their own currency,
  // not an assumed "$". Null until loaded / when no account is connected.
  const [currency, setCurrency] = useState<string | null>(null);
  // Channel eligibility (tier + connection) — only fetched when the Google rollout flag is on.
  const [channels, setChannels] = useState<AdChannelEligibility | null>(null);

  useEffect(() => {
    let on = true;
    getShopServices(shopId, { limit: 100 })
      .then((r) => {
        if (!on) return;
        const list: ShopService[] = (r as any)?.data ?? (r as any)?.items ?? [];
        setServices(list.filter((s) => s.active));
      })
      .catch(() => {});
    getMetaConnection().then((c) => { if (on) setCurrency(c.currency ?? null); }).catch(() => {});
    if (GOOGLE_CHANNEL_ENABLED) {
      getAdChannelEligibility().then((e) => { if (on) setChannels(e); }).catch(() => {});
    }
    return () => { on = false; };
  }, [shopId]);

  const set = (patch: Partial<BriefValue>) => onChange({ ...value, ...patch });
  const toggle = (id: string) =>
    set({ serviceIds: value.serviceIds.includes(id) ? value.serviceIds.filter((x) => x !== id) : [...value.serviceIds, id] });

  return (
    <div className="rounded-lg border border-gray-700 bg-[#0F0F0F] p-3 space-y-3">
      <p className="text-sm font-medium text-gray-300">
        Tell us what to advertise <span className="text-gray-500 font-normal">(optional — helps us build the right campaign)</span>
      </p>

      {GOOGLE_CHANNEL_ENABLED && channels && (
        <div>
          <p className="text-xs text-gray-400 mb-1.5">Channel</p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => set({ channel: "meta" })}
              className={`text-xs px-2.5 py-1 rounded-md border ${value.channel === "meta" ? "border-[#FFCC00] text-white bg-[#FFCC00]/10" : "border-gray-700 text-gray-400 hover:text-white"}`}
            >
              Facebook / Instagram
            </button>
            {(() => {
              const g = channels.google;
              const disabled = !(g.eligible && g.connected); // Google connect (Slice 1) not built yet → always disabled for now
              const hint = !g.eligible ? "Business plan" : !g.connected ? "Connect Google first" : "";
              return (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => !disabled && set({ channel: "google" })}
                  title={hint || "Google Ads"}
                  className={`text-xs px-2.5 py-1 rounded-md border inline-flex items-center gap-1.5 ${
                    value.channel === "google"
                      ? "border-[#FFCC00] text-white bg-[#FFCC00]/10"
                      : disabled
                      ? "border-gray-800 text-gray-600 cursor-not-allowed"
                      : "border-gray-700 text-gray-400 hover:text-white"
                  }`}
                >
                  Google
                  {hint && <span className="text-[10px] px-1 py-0.5 rounded bg-white/5 text-gray-500">{hint}</span>}
                </button>
              );
            })()}
          </div>
        </div>
      )}

      {services.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 mb-1.5">Which services?</p>
          <div className="flex flex-wrap gap-1.5">
            {services.map((s) => (
              <button
                key={s.serviceId}
                type="button"
                onClick={() => toggle(s.serviceId)}
                className={`text-xs px-2.5 py-1 rounded-full border ${value.serviceIds.includes(s.serviceId) ? "border-[#FFCC00] text-white bg-[#FFCC00]/10" : "border-gray-700 text-gray-400 hover:text-white"}`}
              >
                {s.serviceName}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-xs text-gray-400">
          Monthly ad budget{currency ? ` (${currency})` : ""}
          <input type="number" min={0} value={value.budgetUsd} onChange={(e) => set({ budgetUsd: e.target.value })} placeholder="e.g. 3000"
            className="mt-1 w-full px-2.5 py-1.5 bg-[#141414] border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:border-[#FFCC00]" />
        </label>
        <label className="text-xs text-gray-400">
          Target radius (miles)
          <input type="number" min={1} max={100} value={value.radius} onChange={(e) => set({ radius: e.target.value })} placeholder="e.g. 10"
            className="mt-1 w-full px-2.5 py-1.5 bg-[#141414] border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:border-[#FFCC00]" />
        </label>
      </div>

      <label className="block text-xs text-gray-400">
        Special offer to feature
        <input type="text" value={value.offer} onChange={(e) => set({ offer: e.target.value })} placeholder="e.g. 20% off screen repair this month"
          className="mt-1 w-full px-2.5 py-1.5 bg-[#141414] border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:border-[#FFCC00]" />
      </label>

      <div>
        <p className="text-xs text-gray-400 mb-1.5">Goal</p>
        <div className="flex flex-wrap gap-1.5">
          {CAMPAIGN_GOALS.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => set({ goal: value.goal === g.value ? "" : g.value })}
              className={`text-xs px-2.5 py-1 rounded-md border ${value.goal === g.value ? "border-[#FFCC00] text-white bg-[#FFCC00]/10" : "border-gray-700 text-gray-400 hover:text-white"}`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CampaignBriefFields;
