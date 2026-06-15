"use client";

// Ads System — admin view of shop "Request ads" opt-ins. Lists pending requests with
// Approve / Decline. Approving sets the shop's billing plan to what they requested
// (admin still builds the campaign). Self-contained.

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Inbox, Check, X } from "lucide-react";
import toast from "react-hot-toast";
import { listEnrollments, decideEnrollment, type AdEnrollment, type AdPlanType } from "@/services/api/ads";

const PLAN_LABEL: Record<AdPlanType, string> = { a: "Dashboard (A)", b: "Managed (B)", c: "Pay-per-result (C)" };

export const AdEnrollmentRequests: React.FC<{ onApproved?: () => void }> = ({ onApproved }) => {
  const [requests, setRequests] = useState<AdEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyShop, setBusyShop] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRequests(await listEnrollments("pending").catch(() => [])); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const decide = async (shopId: string, decision: "approved" | "declined") => {
    let reason: string | undefined;
    if (decision === "declined") {
      reason = window.prompt("Reason for declining (optional):") || undefined;
    }
    setBusyShop(shopId);
    try {
      await decideEnrollment(shopId, decision, reason);
      toast.success(decision === "approved" ? "Approved — plan set. Build their campaign next." : "Request declined.");
      await load();
      if (decision === "approved") onApproved?.();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || e?.message || "Couldn't record decision.");
    } finally {
      setBusyShop(null);
    }
  };

  if (loading) return null;
  if (requests.length === 0) return null; // nothing pending — stay out of the way

  return (
    <div className="rounded-xl border border-[#FFCC00]/30 bg-[#FFCC00]/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Inbox className="w-5 h-5 text-[#FFCC00]" />
        <h3 className="text-base font-semibold text-white">Ad program requests</h3>
        <span className="text-xs px-1.5 py-0.5 rounded bg-[#FFCC00]/20 text-[#FFCC00]">{requests.length} pending</span>
      </div>

      <div className="space-y-2">
        {requests.map((r) => (
          <div key={r.shopId} className="rounded-lg border border-white/10 bg-[#1A1A1A] p-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-white">
                Shop <span className="font-medium">{r.shopId}</span>
                <span className="ml-2 text-xs text-gray-400">wants {PLAN_LABEL[r.requestedPlan]}</span>
              </p>
              {r.message && <p className="text-sm text-gray-400 mt-0.5 line-clamp-2">“{r.message}”</p>}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => decide(r.shopId, "approved")}
                disabled={busyShop === r.shopId}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-green-500/15 text-green-400 hover:bg-green-500/25 disabled:opacity-50"
              >
                {busyShop === r.shopId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Approve
              </button>
              <button
                onClick={() => decide(r.shopId, "declined")}
                disabled={busyShop === r.shopId}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" /> Decline
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdEnrollmentRequests;
