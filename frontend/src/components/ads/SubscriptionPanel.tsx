"use client";

// Shop self-serve ads subscription (lifecycle Phase 4, decision #5). Renders the three ads tiers as
// a comparison of what each INCLUDES (campaigns / channels / AI lead answering) — not just a price —
// so a shop can see what an upgrade unlocks. The current tier is marked; richer tiers show the delta
// ("Adds: …"). Tier capabilities come from the backend catalog (sub.tiers → TIER_LIMITS), so the
// panel can't drift from what billing enforces. Tier names are Ads Lite/Plus/Pro (adsTierLabel),
// deliberately distinct from the general subscription plan that reuses starter/growth/business.
//
// Change tier (upgrade now / downgrade next cycle) or cancel — no admin approval. A 402 means
// "add a card first" (§9.1).

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, CreditCard, Check, Minus } from "lucide-react";
import toast from "react-hot-toast";
import {
  getMySubscription, changeMyTier, cancelMySubscription, adsTierLabel,
  type AdSubscription, type AdTierOption, type FlatTierName, type ShopCapacity,
} from "@/services/api/ads";

const CHANNEL_LABEL: Record<string, string> = { facebook: "Facebook", instagram: "Instagram", google: "Google" };
const channelName = (c: string) => CHANNEL_LABEL[c] ?? c;

export const SubscriptionPanel: React.FC<{ onChanged?: () => void; capacity?: ShopCapacity | null }> = ({
  onChanged,
  capacity,
}) => {
  const [sub, setSub] = useState<AdSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setSub(await getMySubscription().catch(() => null)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const change = async (tier: FlatTierName) => {
    if (sub?.tier === tier) return;
    setBusy(true);
    try {
      const r = await changeMyTier(tier);
      const name = adsTierLabel(tier);
      toast.success(
        r.outcome === "downgrade_scheduled"
          ? `Downgrade to ${name} scheduled for your next cycle.`
          : r.proratedAmountCents ? `Upgraded to ${name} — prorated $${(r.proratedAmountCents / 100).toFixed(2)}.`
          : `Plan set to ${name}.`
      );
      await load();
      onChanged?.();
    } catch (e: any) {
      if (e?.response?.status === 402) toast.error(e?.response?.data?.message || "Add a payment method first.");
      else toast.error(e?.response?.data?.error || e?.message || "Couldn't change plan.");
    } finally { setBusy(false); }
  };

  const cancel = async () => {
    if (!window.confirm("Cancel ads? Your campaigns will pause at the end of the cycle.")) return;
    setBusy(true);
    try { await cancelMySubscription(); toast.success("Ads cancelled."); await load(); onChanged?.(); }
    catch (e: any) { toast.error(e?.message || "Couldn't cancel."); }
    finally { setBusy(false); }
  };

  if (loading || !sub || !sub.tier) return null; // only for subscribed shops

  const currentIdx = sub.tiers.findIndex((t) => t.name === sub.tier);

  // What a richer tier adds over the current one — the reason to upgrade. Channels first (the most
  // tangible), then AI lead answering, then the campaign bump.
  const upgradeAdds = (t: AdTierOption): string[] => {
    const cur = sub.tiers[currentIdx];
    if (!cur) return [];
    const adds: string[] = [];
    const newChannels = t.channels.filter((c) => !cur.channels.includes(c)).map(channelName);
    if (newChannels.length) adds.push(newChannels.join(" + "));
    if (t.aiAutoAnswer && !cur.aiAutoAnswer) adds.push("AI answers leads");
    if (t.maxCampaigns > cur.maxCampaigns) adds.push(`${t.maxCampaigns} campaigns`);
    return adds;
  };

  return (
    <div className="rounded-xl border border-white/10 bg-[#141414] p-4">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <p className="text-sm font-medium text-gray-200 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-[#FFCC00]" /> Your ads plan
          <span className="text-xs text-gray-500 capitalize">· {sub.subscriptionStatus}</span>
        </p>
        {busy && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {sub.tiers.map((t, idx) => {
          const isCurrent = t.name === sub.tier;
          const isUpgrade = idx > currentIdx;
          const adds = isUpgrade ? upgradeAdds(t) : [];
          return (
            <div
              key={t.name}
              className={`rounded-lg border p-3 flex flex-col ${isCurrent ? "border-[#FFCC00] bg-[#FFCC00]/5" : "border-gray-700 bg-black/20"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-base font-semibold text-white">{adsTierLabel(t.name)}</div>
                  <div className="text-sm text-gray-400">${(t.feeCents / 100).toFixed(0)}/mo</div>
                </div>
                {isCurrent && (
                  <span className="shrink-0 text-xs font-medium text-[#FFCC00] border border-[#FFCC00]/40 rounded px-1.5 py-0.5">
                    Current
                  </span>
                )}
              </div>

              <ul className="mt-3 space-y-1.5 text-sm">
                <li className="flex items-center gap-2 text-gray-200">
                  <Check className="w-3.5 h-3.5 text-[#FFCC00] shrink-0" />
                  {t.maxCampaigns} campaign{t.maxCampaigns > 1 ? "s" : ""}
                </li>
                <li className="flex items-center gap-2 text-gray-200">
                  <Check className="w-3.5 h-3.5 text-[#FFCC00] shrink-0" />
                  {t.channels.map(channelName).join(", ")}
                </li>
                <li className={`flex items-center gap-2 ${t.aiAutoAnswer ? "text-gray-200" : "text-gray-600"}`}>
                  {t.aiAutoAnswer
                    ? <Check className="w-3.5 h-3.5 text-[#FFCC00] shrink-0" />
                    : <Minus className="w-3.5 h-3.5 text-gray-600 shrink-0" />}
                  AI answers leads
                </li>
              </ul>

              {isCurrent && capacity && (
                <div className={`mt-2 text-xs ${capacity.remaining <= 0 ? "text-amber-400" : "text-gray-500"}`}>
                  {capacity.usedCampaigns} of {capacity.maxCampaigns} campaigns used
                </div>
              )}

              {adds.length > 0 && (
                <div className="mt-2 text-xs text-[#FFCC00]/90">Adds: {adds.join(" · ")}</div>
              )}

              <div className="mt-3">
                {isCurrent ? (
                  <span className="block text-center text-xs text-gray-500 py-1.5">Your plan</span>
                ) : isUpgrade ? (
                  <button
                    onClick={() => change(t.name)}
                    disabled={busy}
                    className="w-full text-xs font-medium px-3 py-1.5 rounded-md bg-[#FFCC00] text-black hover:bg-[#e6b800] disabled:opacity-50"
                  >
                    Upgrade
                  </button>
                ) : (
                  <button
                    onClick={() => change(t.name)}
                    disabled={busy}
                    className="w-full text-xs px-3 py-1.5 rounded-md border border-gray-700 text-gray-400 hover:text-white disabled:opacity-50"
                  >
                    Downgrade
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-500 mt-3 mb-2">Upgrades apply now (prorated); downgrades take effect next cycle.</p>

      {/* Ad-account connection UX lives in <MetaConnectCard/> (rendered in ShopAdsTab). */}

      {sub.history.length > 0 && (
        <div className="space-y-1 mb-3">
          {sub.history.slice(0, 4).map((h) => (
            <p key={h.id} className="text-xs text-gray-500">
              {new Date(h.createdAt).toLocaleDateString()} · {h.kind}{h.toTier ? ` → ${adsTierLabel(h.toTier)}` : ""}
              {h.status === "scheduled" ? ` (scheduled ${new Date(h.effectiveAt).toLocaleDateString()})` : ""}
              {h.proratedAmountCents > 0 ? ` · $${(h.proratedAmountCents / 100).toFixed(2)}` : ""}
            </p>
          ))}
        </div>
      )}

      {sub.subscriptionStatus !== "cancelled" && (
        <button onClick={cancel} disabled={busy} className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50">
          Cancel ads
        </button>
      )}
    </div>
  );
};

export default SubscriptionPanel;
