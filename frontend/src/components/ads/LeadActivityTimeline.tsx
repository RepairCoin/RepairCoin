"use client";

// Ads System — lead follow-up tracking (Phase 1). Read-only timeline of every contact and status
// move on a lead: calls, emails, notes, and Kanban status changes. Works for ALL leads (form/manual
// and chat-channel alike), unlike the chat-only conversation view. Uses the shadcn Dialog shell.
// See docs/tasks/strategy/ads-system/ads-lead-followup-tracking-plan.md.

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Phone, Mail, StickyNote, ArrowRightLeft, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getLeadActivities, type AdLeadActivity, type AdLeadActivityType, type LeadMode } from "@/services/api/ads";

const TYPE_META: Record<AdLeadActivityType, { label: string; icon: React.ReactNode }> = {
  call: { label: "Call", icon: <Phone className="w-3.5 h-3.5 text-[#FFCC00]" /> },
  email: { label: "Email", icon: <Mail className="w-3.5 h-3.5 text-[#FFCC00]" /> },
  note: { label: "Note", icon: <StickyNote className="w-3.5 h-3.5 text-[#FFCC00]" /> },
  status_change: { label: "Status", icon: <ArrowRightLeft className="w-3.5 h-3.5 text-gray-400" /> },
};

const when = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString()} · ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
};

// "no_answer" -> "No answer"
const prettyOutcome = (o: string) => o.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

// Email bodies are stored as HTML — show a plain-text preview in the timeline.
const stripHtml = (html: string) =>
  html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

// Engagement chips from a Resend email activity's meta (Phase 4 webhook events).
const engagementChips = (meta: Record<string, any>): { label: string; tone: string }[] => {
  const chips: { label: string; tone: string }[] = [];
  if (meta.delivered) chips.push({ label: "Delivered", tone: "text-emerald-400 bg-emerald-400/10" });
  if (meta.opened) chips.push({ label: "Opened", tone: "text-sky-400 bg-sky-400/10" });
  if (meta.clicked) chips.push({ label: "Clicked", tone: "text-[#FFCC00] bg-[#FFCC00]/10" });
  if (meta.bounced) chips.push({ label: "Bounced", tone: "text-red-400 bg-red-400/10" });
  if (meta.complained) chips.push({ label: "Marked spam", tone: "text-red-400 bg-red-400/10" });
  return chips;
};

export const LeadActivityTimeline: React.FC<{
  leadId: string;
  leadName?: string | null;
  open: boolean;
  onClose: () => void;
  mode?: LeadMode;
}> = ({ leadId, leadName, open, onClose, mode = "admin" }) => {
  const [items, setItems] = useState<AdLeadActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await getLeadActivities(leadId, mode).catch(() => [])); }
    finally { setLoading(false); }
  }, [leadId, mode]);

  useEffect(() => { if (open) void load(); }, [open, load]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[#0F0F0F] border-white/10 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#FFCC00]" /> Activity{leadName ? ` — ${leadName}` : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-[200px] max-h-[55vh] overflow-y-auto pr-1 space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm py-6 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
          ) : items.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">No activity yet. Calls, emails, notes and status changes show up here.</p>
          ) : (
            items.map((a) => {
              const meta = TYPE_META[a.type];
              return (
                <div key={a.id} className="flex gap-2.5">
                  <div className="mt-0.5 shrink-0">{meta.icon}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">{meta.label}</span>
                      {a.outcome && <span className="text-[11px] text-gray-400 px-1.5 py-0.5 rounded bg-white/5">{prettyOutcome(a.outcome)}</span>}
                      <span className="text-[11px] text-gray-500 ml-auto shrink-0">{when(a.createdAt)}</span>
                    </div>
                    {a.subject && <p className="text-xs text-gray-300 mt-0.5">{a.subject}</p>}
                    {a.body && (
                      <p className="text-xs text-gray-400 mt-0.5 whitespace-pre-wrap break-words line-clamp-3">
                        {a.type === "email" ? stripHtml(a.body) : a.body}
                      </p>
                    )}
                    {a.type === "email" && engagementChips(a.meta || {}).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {engagementChips(a.meta || {}).map((c) => (
                          <span key={c.label} className={`text-[10px] px-1.5 py-0.5 rounded ${c.tone}`}>{c.label}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LeadActivityTimeline;
