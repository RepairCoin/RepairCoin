"use client";

// Lead pipeline kanban (Ads System Stage 2). Columns = lead statuses; cards =
// leads. Admin can advance a lead's status (and mark lost); shop view is
// read-only. Self-contained: fetches its own leads (admin: /ads/leads, shop:
// /ads/shop/leads). One-click status change (not drag-drop — simpler + reliable).

import React, { useCallback, useEffect, useState } from "react";
import { Loader2, ChevronRight, Phone, Mail, Sparkles, Copy, MessageSquare } from "lucide-react";
import toast from "react-hot-toast";
import {
  listLeads, listShopLeads, updateLeadStatus, draftLeadReply,
  type AdLead, type LeadStatus,
} from "@/services/api/ads";
import { LeadConversation } from "@/components/ads/LeadConversation";

const COLUMNS: { status: LeadStatus; label: string }[] = [
  { status: "new", label: "New" },
  { status: "contacted", label: "Contacted" },
  { status: "booked", label: "Booked" },
  { status: "paid", label: "Paid" },
  { status: "completed", label: "Completed" },
  { status: "lost", label: "Lost" },
];

// The "advance" target for each status (one-click forward). Lost is terminal.
const NEXT: Partial<Record<LeadStatus, LeadStatus>> = {
  new: "contacted", contacted: "booked", booked: "paid", paid: "completed",
};

export interface LeadKanbanProps {
  mode: "admin" | "shop";
  campaignId?: string;
}

export const LeadKanban: React.FC<LeadKanbanProps> = ({ mode, campaignId }) => {
  const [leads, setLeads] = useState<AdLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [draftingId, setDraftingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [convoLead, setConvoLead] = useState<AdLead | null>(null);
  const editable = mode === "admin";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const fn = mode === "admin" ? listLeads : listShopLeads;
      const r = await fn(campaignId ? { campaignId } : undefined).catch(() => ({ items: [] as AdLead[], total: 0 }));
      setLeads(r.items);
    } finally {
      setLoading(false);
    }
  }, [mode, campaignId]);

  useEffect(() => { void load(); }, [load]);

  const move = async (lead: AdLead, status: LeadStatus) => {
    setBusyId(lead.id);
    try {
      const updated = await updateLeadStatus(lead.id, status);
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? updated : l)));
    } catch (e: any) {
      toast.error(e?.message || "Couldn't update lead.");
    } finally {
      setBusyId(null);
    }
  };

  const draft = async (lead: AdLead) => {
    setDraftingId(lead.id);
    try {
      const text = await draftLeadReply(lead.id);
      setDrafts((prev) => ({ ...prev, [lead.id]: text }));
    } catch (e: any) {
      toast.error(e?.message || "Couldn't draft a reply.");
    } finally {
      setDraftingId(null);
    }
  };

  const copyDraft = (text: string) => {
    navigator.clipboard?.writeText(text).then(
      () => toast.success("Copied."),
      () => toast.error("Couldn't copy.")
    );
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-gray-400 text-sm py-6"><Loader2 className="w-4 h-4 animate-spin" /> Loading leads…</div>;
  }

  if (leads.length === 0) {
    return <div className="rounded-xl border border-white/10 bg-[#141414] p-6 text-center text-gray-500 text-sm">No leads yet.</div>;
  }

  const byStatus = (s: LeadStatus) => leads.filter((l) => l.leadStatus === s);

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-3 min-w-max pb-2">
        {COLUMNS.map((col) => {
          const items = byStatus(col.status);
          return (
            <div key={col.status} className="w-60 shrink-0">
              <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">{col.label}</span>
                <span className="text-xs text-gray-500">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((lead) => (
                  <div key={lead.id} className="rounded-lg border border-white/10 bg-[#1A1A1A] p-3">
                    <p className="text-sm font-medium text-white truncate">{lead.name || "Unnamed lead"}</p>
                    <div className="mt-1 space-y-0.5">
                      {lead.phone && <p className="text-xs text-gray-400 flex items-center gap-1.5"><Phone className="w-3 h-3" /> {lead.phone}</p>}
                      {lead.email && <p className="text-xs text-gray-400 flex items-center gap-1.5 truncate"><Mail className="w-3 h-3 shrink-0" /> {lead.email}</p>}
                    </div>
                    <p className="text-[11px] text-gray-600 mt-1.5">
                      {lead.attributionMethod} · {new Date(lead.createdAt).toLocaleDateString()}
                    </p>
                    {editable && (
                      <div className="mt-2 flex items-center gap-2">
                        {NEXT[col.status] && (
                          <button
                            onClick={() => move(lead, NEXT[col.status]!)}
                            disabled={busyId === lead.id}
                            className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded bg-[#FFCC00]/15 text-[#FFCC00] hover:bg-[#FFCC00]/25 disabled:opacity-50 transition-colors"
                          >
                            {busyId === lead.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronRight className="w-3 h-3" />}
                            {COLUMNS.find((c) => c.status === NEXT[col.status])?.label}
                          </button>
                        )}
                        {col.status !== "lost" && col.status !== "completed" && (
                          <button
                            onClick={() => move(lead, "lost")}
                            disabled={busyId === lead.id}
                            className="text-[11px] text-gray-500 hover:text-red-400 disabled:opacity-50"
                          >
                            Lost
                          </button>
                        )}
                        <button
                          onClick={() => setConvoLead(lead)}
                          className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-[#FFCC00] ml-auto"
                          title="Open conversation"
                        >
                          <MessageSquare className="w-3 h-3" /> Chat
                        </button>
                      </div>
                    )}

                    {/* AI-drafted outreach (Stage 3, Option C) — new/contacted only */}
                    {editable && (col.status === "new" || col.status === "contacted") && (
                      <div className="mt-2">
                        {!drafts[lead.id] ? (
                          <button
                            onClick={() => draft(lead)}
                            disabled={draftingId === lead.id}
                            className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded bg-[#1A1A1A] border border-gray-700 text-gray-300 hover:border-[#FFCC00] hover:text-white disabled:opacity-50 transition-colors"
                          >
                            {draftingId === lead.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-[#FFCC00]" />}
                            {draftingId === lead.id ? "Drafting…" : "Draft reply with AI"}
                          </button>
                        ) : (
                          <div className="rounded border border-white/10 bg-[#0F0F0F] p-2">
                            <p className="text-[11px] text-gray-300 leading-relaxed whitespace-pre-wrap">{drafts[lead.id]}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <button onClick={() => copyDraft(drafts[lead.id])} className="inline-flex items-center gap-1 text-[11px] text-[#FFCC00] hover:text-[#E6B800]"><Copy className="w-3 h-3" /> Copy</button>
                              <button onClick={() => draft(lead)} disabled={draftingId === lead.id} className="text-[11px] text-gray-500 hover:text-white disabled:opacity-50">Redraft</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {items.length === 0 && <div className="rounded-lg border border-dashed border-white/5 py-4" />}
              </div>
            </div>
          );
        })}
      </div>

      {convoLead && (
        <LeadConversation
          leadId={convoLead.id}
          leadName={convoLead.name}
          open={!!convoLead}
          onClose={() => setConvoLead(null)}
        />
      )}
    </div>
  );
};

export default LeadKanban;
