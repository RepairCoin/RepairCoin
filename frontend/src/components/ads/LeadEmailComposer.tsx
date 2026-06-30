"use client";

// Ads System — lead follow-up tracking (Phase 2). Compose + send a tracked email to a lead via
// Resend. On success the send is recorded on the lead's activity timeline and conversation thread.
// If email isn't configured yet (RESEND_API_KEY unset / domain unverified), the modal falls back to
// opening the user's mail client via mailto: so the shop is never blocked.
// See docs/tasks/strategy/ads-system/ads-lead-followup-tracking-plan.md.

import React, { useMemo, useState } from "react";
import { Loader2, Send, Mail } from "lucide-react";
import toast from "react-hot-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { sendLeadEmail, type AdLead } from "@/services/api/ads";

// Light starter templates — editable after selection. {name} is filled with the lead's first name.
const TEMPLATES: { label: string; subject: string; body: string }[] = [
  {
    label: "Thanks for your interest",
    subject: "Thanks for reaching out!",
    body:
      "Hi {name},\n\nThanks for your interest — we'd love to help. Just reply to this email or give us a call and we'll get you booked in at a time that works for you.\n\nLooking forward to it!",
  },
  {
    label: "Ready to book?",
    subject: "Ready to get you booked in",
    body:
      "Hi {name},\n\nFollowing up on your enquiry — are you still looking to get this sorted? Reply with a day/time that suits and we'll lock it in.\n\nTalk soon!",
  },
];

const firstName = (name?: string | null) => (name || "there").trim().split(/\s+/)[0] || "there";

// Minimal, safe HTML from the composed plain text (escape + newline→<br/>).
const toHtml = (text: string): string => {
  const esc = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a">${esc.replace(/\n/g, "<br/>")}</div>`;
};

export const LeadEmailComposer: React.FC<{
  lead: AdLead;
  open: boolean;
  onClose: () => void;
  onSent?: () => void;
}> = ({ lead, open, onClose, onSent }) => {
  const name = useMemo(() => firstName(lead.name), [lead.name]);
  const [subject, setSubject] = useState(TEMPLATES[0].subject);
  const [body, setBody] = useState(TEMPLATES[0].body.replace(/\{name\}/g, name));
  const [sending, setSending] = useState(false);

  const applyTemplate = (t: (typeof TEMPLATES)[number]) => {
    setSubject(t.subject);
    setBody(t.body.replace(/\{name\}/g, name));
  };

  const mailtoFallback = () => {
    if (!lead.email) return;
    window.location.href = `mailto:${lead.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    onClose();
  };

  const send = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error("Add a subject and a message.");
      return;
    }
    setSending(true);
    try {
      await sendLeadEmail(lead.id, subject.trim(), toHtml(body.trim()));
      toast.success("Email sent.");
      onSent?.();
      onClose();
    } catch (e: any) {
      const code = e?.response?.data?.code;
      if (code === "email_not_configured") {
        toast("Email isn't set up yet — opening your mail app instead.", { icon: "✉️" });
        mailtoFallback();
        return;
      }
      toast.error(e?.response?.data?.error || e?.message || "Couldn't send the email.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-[#0F0F0F] border-white/10 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white text-base flex items-center gap-2">
            <Mail className="w-4 h-4 text-[#FFCC00]" /> Email{lead.name ? ` — ${lead.name}` : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="text-gray-500">To:</span>
            <span className="text-gray-200">{lead.email || "no email on file"}</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.label}
                onClick={() => applyTemplate(t)}
                className="text-[11px] px-2 py-1 rounded border border-white/10 bg-[#1A1A1A] text-gray-300 hover:border-[#FFCC00] hover:text-white transition-colors"
              >
                {t.label}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-[#1A1A1A] border border-gray-700 rounded-md text-white text-sm focus:outline-none focus:border-[#FFCC00]"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              className="w-full px-2.5 py-1.5 bg-[#1A1A1A] border border-gray-700 rounded-md text-white text-sm leading-relaxed focus:outline-none focus:border-[#FFCC00]"
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              onClick={mailtoFallback}
              disabled={!lead.email}
              className="text-xs text-gray-400 hover:text-white disabled:opacity-40"
              title="Open in your own mail app instead"
            >
              Use my mail app
            </button>
            <button
              onClick={send}
              disabled={sending || !lead.email || !subject.trim() || !body.trim()}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-[#FFCC00] text-black hover:bg-[#E6B800] disabled:opacity-50"
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Send email
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LeadEmailComposer;
