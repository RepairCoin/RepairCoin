"use client";

// Shop-facing self-serve "Subscribe to ads" (lifecycle Phase 5, decision #5). The shop
// picks a tier — the subscription is set IMMEDIATELY (no admin approval) — plus an
// optional brief that becomes the first campaign request the admin builds. A card is
// required (§9.1). Hidden once subscribed: SubscriptionPanel + the campaign rail
// take over.

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Megaphone, CreditCard } from "lucide-react";
import toast from "react-hot-toast";
import {
  getMySubscription, changeMyTier, submitCampaignRequest, FLAT_TIERS,
  type AdSubscription, type FlatTierName,
} from "@/services/api/ads";
import { CampaignBriefFields, briefToApi, emptyBrief, type BriefValue } from "@/components/ads/CampaignBriefFields";

const PLANS = FLAT_TIERS.map((t) => ({ value: t.name, label: t.label, blurb: t.blurb }));

export const AdEnrollmentCTA: React.FC<{ shopId: string; hasCampaigns?: boolean }> = ({ shopId }) => {
  const [sub, setSub] = useState<AdSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<FlatTierName>("growth");
  const [message, setMessage] = useState("");
  const [brief, setBrief] = useState<BriefValue>(emptyBrief);
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
      await submitCampaignRequest(briefToApi(brief), message.trim() || undefined);
      toast.success("You're subscribed! Your campaign request is in — we'll build it shortly.");
      await load();
    } catch (e: any) {
      if (e?.response?.status === 402) toast.error(e?.response?.data?.message || "Add a payment method first.");
      else toast.error(e?.response?.data?.message || e?.response?.data?.error || e?.message || "Couldn't subscribe.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;
  if (sub?.tier) return null; // already subscribed → SubscriptionPanel / the campaign rail take over

  return (
    <div className="rounded-xl border border-white/10 bg-[#141414] p-5">
      <div className="flex items-center gap-2 mb-1">
        <Megaphone className="w-5 h-5 text-[#FFCC00]" />
        <h3 className="text-lg font-semibold text-white">Get more customers with ads</h3>
      </div>
      <p className="text-sm text-gray-400 mb-4">
        We run Facebook &amp; Google ads on your own ad account, capture every customer who responds, and show you exactly what you got back. Pick a plan:
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

      <div className="mb-3">
        <CampaignBriefFields shopId={shopId} value={brief} onChange={setBrief} />
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Anything else you want us to know? (optional)"
        rows={2}
        className="w-full px-3 py-2 bg-[#0F0F0F] border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:border-[#FFCC00] mb-3"
      />

      <button
        onClick={submit}
        disabled={submitting}
        className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-md bg-[#FFCC00] text-black hover:bg-[#E6B800] disabled:opacity-50"
      >
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />} Subscribe &amp; request campaign
      </button>
      <p className="text-xs text-gray-500 mt-2 flex items-center gap-1.5">
        <CreditCard className="w-3.5 h-3.5 shrink-0" /> A card on file is required. You pay your own ad spend directly; the plan fee starts when your first campaign goes live.
      </p>
    </div>
  );
};

export default AdEnrollmentCTA;
