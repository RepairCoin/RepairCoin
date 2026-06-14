"use client";

// Ads System (Stage 3.5) — full AI auto-answer conversation thread for a lead (admin).
// Shows the back-and-forth (lead / AI / admin), lets the admin send a manual reply,
// and trigger an AI answer on demand. When the campaign's AI agent is on, inbound
// replies are answered automatically by the server; this modal is the human view +
// override. Uses the shadcn Dialog shell, dark-themed to match the ads surface.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles, Bot, User, Headset } from "lucide-react";
import toast from "react-hot-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getLeadThread, sendLeadMessage, autoAnswerLead, type LeadMessage } from "@/services/api/ads";

const AUTHOR_META: Record<LeadMessage["author"], { label: string; icon: React.ReactNode; align: string; bubble: string }> = {
  lead: { label: "Lead", icon: <User className="w-3.5 h-3.5" />, align: "items-start", bubble: "bg-[#1A1A1A] text-gray-200 border border-white/10" },
  ai: { label: "AI", icon: <Bot className="w-3.5 h-3.5" />, align: "items-end ml-auto", bubble: "bg-[#FFCC00]/15 text-white border border-[#FFCC00]/30" },
  admin: { label: "You", icon: <Headset className="w-3.5 h-3.5" />, align: "items-end ml-auto", bubble: "bg-[#1F2937] text-white border border-white/10" },
};

export const LeadConversation: React.FC<{
  leadId: string;
  leadName?: string | null;
  open: boolean;
  onClose: () => void;
}> = ({ leadId, leadName, open, onClose }) => {
  const [thread, setThread] = useState<LeadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setThread(await getLeadThread(leadId).catch(() => [])); }
    finally { setLoading(false); }
  }, [leadId]);

  useEffect(() => { if (open) void load(); }, [open, load]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [thread]);

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    try {
      await sendLeadMessage(leadId, body);
      setDraft("");
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || e?.message || "Couldn't send.");
    } finally {
      setSending(false);
    }
  };

  const aiAnswer = async () => {
    setAiBusy(true);
    try {
      await autoAnswerLead(leadId);
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || e?.message || "Couldn't generate a reply.");
    } finally {
      setAiBusy(false);
    }
  };

  // The AI answers the customer's last message — only meaningful when the most
  // recent message is from the lead (otherwise there's nothing new to reply to).
  const canAiAnswer = thread.length > 0 && thread[thread.length - 1].author === "lead";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[#0F0F0F] border-white/10 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#FFCC00]" /> Conversation{leadName ? ` — ${leadName}` : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-[240px] max-h-[50vh] overflow-y-auto pr-1 space-y-2">
          {loading ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm py-6 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
          ) : thread.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">No messages yet. Send the first reply, or use AI answer.</p>
          ) : (
            thread.map((m) => {
              const meta = AUTHOR_META[m.author];
              return (
                <div key={m.id} className={`flex flex-col max-w-[80%] ${meta.align}`}>
                  <span className="text-xs text-gray-500 flex items-center gap-1 mb-0.5">{meta.icon} {meta.label}</span>
                  <div className={`rounded-lg px-3 py-2 text-sm ${meta.bubble}`}>{m.body}</div>
                  {m.author !== "lead" && m.deliveryStatus !== "delivered" && (
                    <span className="text-[11px] text-gray-500 mt-0.5">{m.deliveryStatus === "recorded" ? "recorded (relay manually)" : m.deliveryStatus}</span>
                  )}
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>

        <div className="space-y-2 pt-1">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Type a reply…"
            rows={2}
            className="w-full px-2.5 py-1.5 bg-[#1A1A1A] border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:border-[#FFCC00]"
          />
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={aiAnswer}
              disabled={aiBusy || !canAiAnswer}
              title={canAiAnswer ? "Generate the shop's reply to the customer's last message" : "Waiting on the customer — nothing new to answer"}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-[#1A1A1A] border border-gray-700 text-gray-300 hover:border-[#FFCC00] hover:text-white disabled:opacity-50"
            >
              {aiBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />} AI answer
            </button>
            <button
              onClick={send}
              disabled={sending || !draft.trim()}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-[#FFCC00] text-black hover:bg-[#E6B800] disabled:opacity-50"
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Send
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LeadConversation;
