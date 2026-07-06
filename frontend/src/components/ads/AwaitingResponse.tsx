"use client";

// "Needs you" attention widget (Ads System — Part B redesign, P2). Surfaces conversations where a
// human should step in — a customer reply that no one (not even the AI) has answered, or a lead with
// no AI outreach queued. This REPLACES the old first-response-SLA (first_response_at IS NULL), which
// missed AI-first leads (the AI stamps first_response_at, and the real signal is an unanswered reply).
// Self-fetching + mode-aware: admin = /ads/leads/conversations, shop = /ads/shop/conversations.

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Bell } from "lucide-react";
import { getShopConversations, getLeadConversations, type LeadConversationItem } from "@/services/api/ads";

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
  const [items, setItems] = useState<LeadConversationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = mode === "admin"
        ? await getLeadConversations().catch(() => [])
        : await getShopConversations().catch(() => []);
      setItems(data.filter((c) => c.needsHuman));
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return <div className="flex items-center gap-2 text-gray-400 text-sm py-3"><Loader2 className="w-4 h-4 animate-spin" /> Checking conversations…</div>;
  }
  if (items.length === 0) return null; // nothing needs a human — stay out of the way

  return (
    <div className="rounded-xl border border-red-500/30 bg-red-900/10 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Bell className="w-4 h-4 text-red-400" />
        <span className="text-sm font-semibold text-red-300">
          {items.length} conversation{items.length > 1 ? "s" : ""} need{items.length > 1 ? "" : "s"} you
        </span>
      </div>
      <div className="space-y-1.5">
        {items.slice(0, 6).map((c) => {
          const at = c.lastAt || c.createdAt;
          return (
            <div key={c.id} className="flex items-center justify-between text-sm">
              <span className="text-gray-200 truncate">{c.name || c.phone || c.email || "Unnamed lead"}</span>
              <span className={`text-xs font-medium ${ageTone(at)}`}>{ageLabel(at)} ago</span>
            </div>
          );
        })}
        {items.length > 6 && <p className="text-xs text-gray-500">+{items.length - 6} more</p>}
      </div>
    </div>
  );
};

export default AwaitingResponse;
