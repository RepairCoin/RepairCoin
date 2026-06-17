"use client";

// Durable shop↔admin ads message thread (lifecycle Phase 2). Self-fetching; `mode`
// picks the endpoint (shop = own thread; admin = a given shop's thread). 'system' rows
// render as centered event lines. Dark theme to match the other ads panels.

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Send, MessageSquare } from "lucide-react";
import toast from "react-hot-toast";
import {
  getMyAdMessages, postMyAdMessage, listShopAdMessages, postShopAdMessage, type AdMessage,
} from "@/services/api/ads";

export const AdMessageThread: React.FC<{ mode: "shop" | "admin"; shopId?: string }> = ({ mode, shopId }) => {
  const [messages, setMessages] = useState<AdMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = mode === "admin" && shopId ? await listShopAdMessages(shopId) : await getMyAdMessages();
      setMessages(list);
    } catch {
      /* leave empty */
    } finally {
      setLoading(false);
    }
  }, [mode, shopId]);

  useEffect(() => { void load(); }, [load]);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      if (mode === "admin" && shopId) await postShopAdMessage(shopId, body);
      else await postMyAdMessage(body);
      setDraft("");
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || e?.message || "Couldn't send message.");
    } finally {
      setSending(false);
    }
  };

  const mine = (m: AdMessage) =>
    (mode === "shop" && m.author === "shop") || (mode === "admin" && m.author === "admin");

  return (
    <div className="rounded-xl border border-white/10 bg-[#141414] p-4">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="w-4 h-4 text-[#FFCC00]" />
        <p className="text-sm font-medium text-gray-200">Messages</p>
        <span className="text-xs text-gray-500">— with {mode === "shop" ? "the FixFlow ads team" : "this shop"}</span>
      </div>

      <div className="max-h-72 overflow-y-auto space-y-2 mb-3 pr-1">
        {loading ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm py-4"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-gray-500 py-4">No messages yet. Start the conversation below.</p>
        ) : (
          messages.map((m) =>
            m.kind === "event" ? (
              <p key={m.id} className="text-center text-xs text-gray-500 py-1">— {m.body} —</p>
            ) : (
              <div key={m.id} className={`flex ${mine(m) ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${mine(m) ? "bg-[#FFCC00]/15 text-white" : "bg-[#1A1A1A] text-gray-200 border border-white/10"}`}>
                  <p className="text-[11px] text-gray-400 mb-0.5 capitalize">{m.author}</p>
                  <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
                </div>
              </div>
            )
          )
        )}
      </div>

      <div className="flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a message…"
          rows={2}
          className="flex-1 px-3 py-2 bg-[#0F0F0F] border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:border-[#FFCC00] resize-none"
        />
        <button
          onClick={send}
          disabled={sending || !draft.trim()}
          className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-md bg-[#FFCC00] text-black hover:bg-[#E6B800] disabled:opacity-50"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send
        </button>
      </div>
    </div>
  );
};

export default AdMessageThread;
