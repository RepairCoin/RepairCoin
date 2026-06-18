"use client";

// Shop-facing self-serve "Subscribe to ads" — STEP 1 of onboarding (lifecycle Phase 5,
// decision #5). The shop picks a tier; the subscription is set IMMEDIATELY (no admin
// approval). A card is required (§9.1). This is plan-only — connecting Meta (step 2) and
// requesting a campaign (step 3) happen after, in order. Hidden once subscribed.

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Megaphone, CreditCard } from "lucide-react";
import toast from "react-hot-toast";
import { getMySubscription, changeMyTier, FLAT_TIERS, type AdSubscription, type FlatTierName } from "@/services/api/ads";

const PLANS = FLAT_TIERS.map((t) => ({ value: t.name, label: t.label, blurb: t.blurb }));

export const AdEnrollmentCTA: React.FC<{ onSubscribed?: () => void }> = ({ onSubscribed }) => {
  const [sub, setSub] = useState<AdSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<FlatTierName>("growth");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setSub(await getMySubscription().catch(() => null)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    setSubmitting(true);
    try {
      await changeMyTier(plan);                      // self-serve subscribe — no admin approval
      toast.success("You're subscribed! Next: connect your Meta ad account.");
      await load();
      onSubscribed?.();
    } catch (e: any) {
      if (e?.response?.status === 402) toast.error(e?.response?.data?.message || "Add a payment method first.");
      else toast.error(e?.response?.data?.message || e?.response?.data?.error || e?.message || "Couldn't subscribe.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;
  if (sub?.tier) return null; // already subscribed → later steps take over

  return (
    <div className="rounded-xl border border-white/10 bg-[#141414] p-5">
      <div className="flex items-center gap-2 mb-1">
        <Megaphone className="w-5 h-5 text-[#FFCC00]" />
        <h3 className="text-lg font-semibold text-white">Get more customers with ads</h3>
      </div>
      <p className="text-sm text-gray-400 mb-4">
        We run Facebook &amp; Google ads on your own ad account, capture every customer who responds, and show you
        exactly what you got back. Start by choosing a plan:
      </p>

      <div className="space-y-2 mb-4">
        {PLANS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPlan(p.value)}
            className={`w-full text-left rounded-lg border p-3 transition-colors ${plan === p.value ? "border-[#FFCC00] bg-[#FFCC00]/10" : "border-gray-700 hover:border-gray-500"}`}
          >
            <div className="flex items-center gap-2">
              <span className={`inline-block w-3.5 h-3.5 rounded-full border-2 ${plan === p.value ? "border-[#FFCC00] bg-[#FFCC00]" : "border-gray-500"}`} />
              <span className="text-sm font-medium text-white">{p.label}</span>
            </div>
            <p className="text-sm text-gray-400 mt-1 ml-5">{p.blurb}</p>
          </button>
        ))}
      </div>

      <button
        onClick={submit}
        disabled={submitting}
        className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-md bg-[#FFCC00] text-black hover:bg-[#E6B800] disabled:opacity-50"
      >
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />} Subscribe
      </button>
      <p className="text-xs text-gray-500 mt-2 flex items-center gap-1.5">
        <CreditCard className="w-3.5 h-3.5 shrink-0" /> A card on file is required. You pay your own ad spend directly; the plan fee starts when your first campaign goes live.
      </p>
    </div>
  );
};

export default AdEnrollmentCTA;
