"use client";

// Ads System — lead follow-up tracking (Phase 3). Log a call to a lead: dial via tel: and record
// the outcome (reached / no answer / booked / not interested) + an optional note. A logged call
// writes a `call` activity to the timeline and stamps first_response_at server-side, so the blind
// tel: link becomes trackable follow-up. Uses the shadcn Dialog shell.
// See docs/tasks/strategy/ads-system/ads-lead-followup-tracking-plan.md.

import React, { useState } from "react";
import { Loader2, Phone, Check } from "lucide-react";
import toast from "react-hot-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { logLeadActivity, type AdLead, type LeadCallOutcome } from "@/services/api/ads";

const OUTCOMES: { value: LeadCallOutcome; label: string }[] = [
  { value: "reached", label: "Reached" },
  { value: "no_answer", label: "No answer" },
  { value: "booked", label: "Booked" },
  { value: "not_interested", label: "Not interested" },
];

export const LeadCallLogger: React.FC<{
  lead: AdLead;
  open: boolean;
  onClose: () => void;
  onLogged?: () => void;
}> = ({ lead, open, onClose, onLogged }) => {
  const [outcome, setOutcome] = useState<LeadCallOutcome | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!outcome) {
      toast.error("Pick a call outcome.");
      return;
    }
    setSaving(true);
    try {
      await logLeadActivity(lead.id, "call", { outcome, body: note.trim() || undefined });
      toast.success("Call logged.");
      onLogged?.();
      onClose();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || e?.message || "Couldn't log the call.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[#0F0F0F] border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white text-base flex items-center gap-2">
            <Phone className="w-4 h-4 text-[#FFCC00]" /> Log call{lead.name ? ` — ${lead.name}` : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {lead.phone && (
            <a
              href={`tel:${lead.phone}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md bg-[#FFCC00] text-black hover:bg-[#E6B800]"
            >
              <Phone className="w-4 h-4" /> Call {lead.phone}
            </a>
          )}

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Outcome</label>
            <div className="grid grid-cols-2 gap-2">
              {OUTCOMES.map((o) => {
                const active = outcome === o.value;
                return (
                  <button
                    key={o.value}
                    onClick={() => setOutcome(o.value)}
                    className={`inline-flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-md border transition-colors ${
                      active
                        ? "border-[#FFCC00] bg-[#FFCC00]/15 text-white"
                        : "border-white/10 bg-[#1A1A1A] text-gray-300 hover:border-gray-600"
                    }`}
                  >
                    {active && <Check className="w-3.5 h-3.5 text-[#FFCC00]" />} {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="What was discussed, next steps…"
              className="w-full px-2.5 py-1.5 bg-[#1A1A1A] border border-gray-700 rounded-md text-white text-sm leading-relaxed focus:outline-none focus:border-[#FFCC00]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button onClick={onClose} className="text-xs text-gray-400 hover:text-white">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving || !outcome}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-[#FFCC00] text-black hover:bg-[#E6B800] disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save log
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LeadCallLogger;
