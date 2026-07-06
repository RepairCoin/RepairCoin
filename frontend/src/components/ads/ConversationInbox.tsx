"use client";

// Ads System (Part B redesign, P2) — the Conversation Inbox. Leads shown as message rows with a
// derived conversation state, newest activity first, and a "Needs you" filter — the day-to-day home
// for working leads in the AI-first flow (the AI handles first contact + routine replies; the shop
// steps in when a customer reply is unanswered). Clicking a row opens the thread. Mode-aware:
// shop hits /ads/shop/conversations, admin hits /ads/leads/conversations.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Inbox, Bot, User, MessageSquare } from "lucide-react";
import {
  getShopConversations, getLeadConversations,
  type LeadConversationItem, type ConversationState,
} from "@/services/api/ads";
import { LeadConversation } from "@/components/ads/LeadConversation";

const STATE_BADGE: Record<ConversationState, { label: string; cls: string }> = {
  needs_human: { label: "Needs you", cls: "bg-red-500/15 text-red-300 border border-red-500/30" },
  ai_engaged: { label: "AI engaged", cls: "bg-blue-500/15 text-blue-300 border border-blue-500/30" },
  awaiting_ai: { label: "AI greeting…", cls: "bg-[#FFCC00]/15 text-[#FFCC00] border border-[#FFCC00]/30" },
  dormant: { label: "Dormant", cls: "bg-gray-500/15 text-gray-400 border border-white/10" },
  quiet: { label: "New", cls: "bg-white/5 text-gray-300 border border-white/10" },
};

function relTime(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export const ConversationInbox: React.FC<{ mode: "admin" | "shop"; campaignId?: string }> = ({ mode, campaignId }) => {
  const [items, setItems] = useState<LeadConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"needs" | "all">("needs");
  const [convo, setConvo] = useState<{ id: string; name: string | null; aiPaused: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = mode === "shop"
        ? await getShopConversations(campaignId).catch(() => [])
        : await getLeadConversations({ campaignId }).catch(() => []);
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, [mode, campaignId]);

  useEffect(() => { void load(); }, [load]);

  const needsCount = useMemo(() => items.filter((i) => i.needsHuman).length, [items]);
  // Default to the "Needs you" tab only when there's something there; else show All.
  useEffect(() => { setFilter(needsCount > 0 ? "needs" : "all"); }, [needsCount]);

  const shown = filter === "needs" ? items.filter((i) => i.needsHuman) : items;

  if (loading) {
    return <div className="flex items-center gap-2 text-gray-400 text-sm py-6"><Loader2 className="w-4 h-4 animate-spin" /> Loading conversations…</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {(["needs", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs font-medium px-3 py-1.5 rounded-md border transition-colors ${filter === f ? "bg-[#FFCC00] text-black border-transparent" : "bg-transparent text-gray-300 border-white/10 hover:bg-white/5"}`}
          >
            {f === "needs" ? `Needs you${needsCount ? ` · ${needsCount}` : ""}` : `All · ${items.length}`}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="flex flex-col items-center gap-2 text-gray-500 text-sm py-10 rounded-xl border border-white/10 bg-[#141414]">
          <Inbox className="w-6 h-6 text-gray-600" />
          {filter === "needs" ? "Nothing needs you right now — the AI is handling active chats." : "No conversations yet."}
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 divide-y divide-white/5 overflow-hidden">
          {shown.map((c) => {
            const badge = STATE_BADGE[c.conversationState];
            const preview = c.lastBody ? c.lastBody : "No messages yet";
            return (
              <button
                key={c.id}
                onClick={() => setConvo({ id: c.id, name: c.name, aiPaused: c.aiPaused })}
                className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors flex items-start gap-3"
              >
                <div className="mt-0.5 shrink-0 text-gray-500">
                  {c.lastAuthor === "ai" ? <Bot className="w-4 h-4" /> : c.lastDirection === "inbound" ? <User className="w-4 h-4 text-red-300" /> : <MessageSquare className="w-4 h-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-white truncate">{c.name || c.email || "Unnamed lead"}</span>
                    <span className="text-[11px] text-gray-500 shrink-0">{relTime(c.lastAt || c.createdAt)}</span>
                  </div>
                  <p className={`text-xs mt-0.5 truncate ${c.lastDirection === "inbound" ? "text-gray-200" : "text-gray-400"}`}>
                    {c.lastDirection === "inbound" ? "" : c.lastAuthor === "ai" ? "AI: " : "You: "}{preview}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {c.escalated
                      ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-200 border border-red-500/40">🔥 Ready to book</span>
                      : <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>}
                    {mode === "admin" && c.campaignName && <span className="text-[10px] text-gray-500 truncate">{c.campaignName}</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {convo && (
        <LeadConversation
          leadId={convo.id}
          leadName={convo.name}
          open={!!convo}
          mode={mode}
          initialAiPaused={convo.aiPaused}
          onClose={() => { setConvo(null); void load(); }}
        />
      )}
    </div>
  );
};

export default ConversationInbox;
