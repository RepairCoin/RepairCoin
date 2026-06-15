"use client";

// Ads System — shop-facing "Request ads" opt-in. Shown in the shop's Ads tab. v1
// keeps campaign creation admin-only, so this lets a shop SIGNAL interest and pick a
// preferred plan; an admin then approves (which sets the plan) and builds the campaign.
// Self-contained: fetches its own enrollment state. Renders nothing once the shop is
// approved AND has live campaigns (the rest of the tab takes over).

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Megaphone, Clock, CheckCircle2, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import {
  getMyEnrollment, requestAdsEnrollment, type AdEnrollment, type AdPlanType,
} from "@/services/api/ads";

const PLANS: { value: AdPlanType; label: string; blurb: string }[] = [
  { value: "b", label: "Managed (recommended)", blurb: "We run your ads and handle everything. You pay for ad spend plus a small margin." },
  { value: "a", label: "Dashboard only", blurb: "You keep your own Facebook ad account; we provide the dashboard for a flat monthly fee." },
  { value: "c", label: "Pay per result", blurb: "We run ads at our risk; you pay only when a booking comes in." },
];

export const AdEnrollmentCTA: React.FC<{ hasCampaigns: boolean }> = ({ hasCampaigns }) => {
  const [enrollment, setEnrollment] = useState<AdEnrollment | null>(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<AdPlanType>("b");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setEnrollment(await getMyEnrollment().catch(() => null)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    setSubmitting(true);
    try {
      await requestAdsEnrollment(plan, message.trim() || undefined);
      toast.success("Request sent! An admin will review it shortly.");
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || e?.message || "Couldn't send request.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;
  // Already running ads (approved, or admin-created campaigns with no request on file)
  // → don't nag; let the rest of the tab show the live ads.
  if (hasCampaigns && enrollment?.status !== "pending" && enrollment?.status !== "declined") return null;

  // Approved, campaign not built yet.
  if (enrollment?.status === "approved") {
    return (
      <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-white">You're enrolled in the ad program 🎉</p>
          <p className="text-sm text-gray-300 mt-0.5">Your campaign is being set up — leads and performance will show here once it goes live.</p>
        </div>
      </div>
    );
  }

  // Pending review.
  if (enrollment?.status === "pending") {
    return (
      <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 flex items-start gap-3">
        <Clock className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-white">Your ad request is pending review.</p>
          <p className="text-sm text-gray-300 mt-0.5">An admin will approve it and set up your campaign soon. We'll notify you.</p>
        </div>
      </div>
    );
  }

  // Declined → show reason + allow re-request below.
  const declined = enrollment?.status === "declined";

  return (
    <div className="rounded-xl border border-white/10 bg-[#141414] p-5">
      {declined && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 mb-4 flex items-start gap-2">
          <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-gray-300">
            Your previous request was declined{enrollment?.declineReason ? `: ${enrollment.declineReason}` : "."} You can request again below.
          </p>
        </div>
      )}

      <div className="flex items-center gap-2 mb-1">
        <Megaphone className="w-5 h-5 text-[#FFCC00]" />
        <h3 className="text-lg font-semibold text-white">Get more customers with ads</h3>
      </div>
      <p className="text-sm text-gray-400 mb-4">
        We run Facebook &amp; Google ads for your shop, capture every customer who responds, and show you exactly what you got back. Pick how you'd like to work with us:
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

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Anything you want us to know? (optional)"
        rows={2}
        className="w-full px-3 py-2 bg-[#0F0F0F] border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:border-[#FFCC00] mb-3"
      />

      <button
        onClick={submit}
        disabled={submitting}
        className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-md bg-[#FFCC00] text-black hover:bg-[#E6B800] disabled:opacity-50"
      >
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}
        {declined ? "Request again" : "Request ads"}
      </button>
      <p className="text-xs text-gray-500 mt-2">No commitment — an admin will review and reach out before anything goes live.</p>
    </div>
  );
};

export default AdEnrollmentCTA;
