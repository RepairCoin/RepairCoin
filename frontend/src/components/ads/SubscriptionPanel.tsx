"use client";

// Shop self-serve ads subscription (lifecycle Phase 4, decision #5). Shows the current
// tier + status, lets the shop change tier (upgrade now / downgrade next cycle) or
// cancel — no admin approval. A 402 means "add a card first" (§9.1).

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, CreditCard } from "lucide-react";
import toast from "react-hot-toast";
import {
  getMySubscription, changeMyTier, cancelMySubscription, FLAT_TIERS,
  type AdSubscription, type FlatTierName,
} from "@/services/api/ads";

export const SubscriptionPanel: React.FC<{ onChanged?: () => void }> = ({ onChanged }) => {
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
      toast.success(
        r.outcome === "downgrade_scheduled"
          ? `Downgrade to ${tier} scheduled for your next cycle.`
          : r.proratedAmountCents ? `Upgraded to ${tier} — prorated $${(r.proratedAmountCents / 100).toFixed(2)}.`
          : `Plan set to ${tier}.`
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

  return (
    <div className="rounded-xl border border-white/10 bg-[#141414] p-4">
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <p className="text-sm font-medium text-gray-200 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-[#FFCC00]" /> Your ads plan
          <span className="text-xs text-gray-500 capitalize">· {sub.subscriptionStatus}</span>
        </p>
        {busy && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {FLAT_TIERS.map((t) => (
          <button
            key={t.name}
            onClick={() => change(t.name)}
            disabled={busy}
            className={`text-xs px-3 py-1.5 rounded-md border disabled:opacity-50 ${sub.tier === t.name ? "border-[#FFCC00] text-white bg-[#FFCC00]/10" : "border-gray-700 text-gray-400 hover:text-white"}`}
          >
            {t.label}{sub.tier === t.name ? " · current" : ""}
          </button>
        ))}
      </div>

      <p className="text-xs text-gray-500 mb-2">Upgrades apply now (prorated); downgrades take effect next cycle.</p>

      {/* Ad-account connection UX lives in <MetaConnectCard/> (rendered in ShopAdsTab). */}

      {sub.history.length > 0 && (
        <div className="space-y-1 mb-3">
          {sub.history.slice(0, 4).map((h) => (
            <p key={h.id} className="text-xs text-gray-500">
              {new Date(h.createdAt).toLocaleDateString()} · {h.kind}{h.toTier ? ` → ${h.toTier}` : ""}
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
