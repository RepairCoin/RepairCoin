"use client";

// First-response SLA widget (Ads System Stage 2). Surfaces leads with no response
// yet, oldest first, with age-of-lead — speed-to-lead is what wins paid leads.
// Self-fetching: admin = /ads/leads/awaiting, shop = /ads/shop/leads/awaiting.

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Clock } from "lucide-react";
import { listAwaitingLeads, listShopAwaitingLeads, type AdLead } from "@/services/api/ads";

const ageLabel = (iso: string): string => {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
};

// >60 min unanswered = getting stale (amber), >4h = hot (red).
const ageTone = (iso: string): string => {
  const mins = (Date.now() - new Date(iso).getTime()) / 60000;
  if (mins > 240) return "text-red-400";
  if (mins > 60) return "text-yellow-400";
  return "text-gray-400";
};

export const AwaitingResponse: React.FC<{ mode: "admin" | "shop" }> = ({ mode }) => {
  const [leads, setLeads] = useState<AdLead[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const fn = mode === "admin" ? listAwaitingLeads : listShopAwaitingLeads;
      setLeads(await fn().catch(() => []));
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return <div className="flex items-center gap-2 text-gray-400 text-sm py-3"><Loader2 className="w-4 h-4 animate-spin" /> Checking leads…</div>;
  }
  if (leads.length === 0) return null; // nothing awaiting — stay out of the way

  return (
    <div className="rounded-xl border border-yellow-500/30 bg-yellow-900/10 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-yellow-400" />
        <span className="text-sm font-semibold text-yellow-300">
          {leads.length} lead{leads.length > 1 ? "s" : ""} awaiting response
        </span>
      </div>
      <div className="space-y-1.5">
        {leads.slice(0, 6).map((l) => (
          <div key={l.id} className="flex items-center justify-between text-sm">
            <span className="text-gray-200 truncate">
              {l.name || l.phone || l.email || "Unnamed lead"}
            </span>
            <span className={`text-xs font-medium ${ageTone(l.createdAt)}`}>{ageLabel(l.createdAt)} ago</span>
          </div>
        ))}
        {leads.length > 6 && <p className="text-xs text-gray-500">+{leads.length - 6} more</p>}
      </div>
    </div>
  );
};

export default AwaitingResponse;
