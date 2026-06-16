"use client";

// Admin "Shop messages" inbox (#2). The single, always-reachable entry point to the
// durable shop↔admin ads thread — works in EVERY lifecycle state (pre-subscribe,
// pre-campaign, live), unlike the queue/campaign-detail threads which only appear when
// a request or campaign exists. Lists every shop with messages, newest first, and flags
// the ones awaiting a reply. Click a row to open the thread inline.

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Inbox, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { getAdMessageInbox, type AdInboxEntry } from "@/services/api/ads";
import { AdMessageThread } from "@/components/ads/AdMessageThread";

const timeAgo = (iso: string): string => {
  const then = new Date(iso).getTime();
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
};

export const AdMessagesInbox: React.FC = () => {
  const [entries, setEntries] = useState<AdInboxEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpenShop] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setEntries(await getAdMessageInbox().catch(() => [])); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) return null;
  if (entries.length === 0) return null; // no shop has messaged yet — keep the tab clean

  const awaiting = entries.filter((e) => e.awaitingReply).length;

  return (
    <div className="rounded-xl border border-white/10 bg-[#1A1A1A] p-3">
      <div className="flex items-center gap-2 mb-3">
        <Inbox className="w-5 h-5 text-[#FFCC00]" />
        <h3 className="text-base font-semibold text-white">Shop messages</h3>
        <span className="text-xs px-1.5 py-0.5 rounded bg-[#FFCC00]/20 text-[#FFCC00]">{entries.length}</span>
        {awaiting > 0 && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">{awaiting} need reply</span>
        )}
        <button onClick={() => void load()} className="ml-auto text-gray-400 hover:text-white" title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-2">
        {entries.map((e) => {
          const isOpen = open === e.shopId;
          return (
            <div key={e.shopId}>
              <button
                onClick={() => setOpenShop(isOpen ? null : e.shopId)}
                className={`w-full text-left rounded-lg border p-3 flex items-start gap-3 transition-colors ${isOpen ? "border-[#FFCC00]/60 bg-[#141414]" : "border-white/10 bg-[#141414] hover:border-[#FFCC00]/40"}`}
              >
                {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-white font-medium truncate">{e.shopName || e.shopId}</p>
                    {e.shopName && <span className="text-xs text-gray-500 shrink-0">{e.shopId}</span>}
                    {e.awaitingReply && (
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 shrink-0">Needs reply</span>
                    )}
                    <span className="text-xs text-gray-500 ml-auto shrink-0">{timeAgo(e.lastAt)}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    <span className="capitalize text-gray-500">{e.lastAuthor === "system" ? "event" : e.lastAuthor}:</span>{" "}
                    {e.lastBody}
                  </p>
                </div>
              </button>
              {isOpen && (
                <div className="mt-2">
                  <AdMessageThread mode="admin" shopId={e.shopId} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdMessagesInbox;
