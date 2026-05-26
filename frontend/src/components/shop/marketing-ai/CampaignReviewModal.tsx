"use client";

import React, { useState } from "react";
import { Send, Loader2, AlertCircle, Users, Mail } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  sendCampaign,
  CampaignDeliveryResult,
} from "@/services/api/marketing";

/**
 * CampaignReviewModal
 *
 * The destructive-confirm gate for AI-drafted campaigns. Opens from
 * CampaignDraftCard when the shop taps "Preview". Shows the full
 * subject + body with editable textareas + recipient summary + the
 * "Send N emails" button that fires
 *   POST /api/marketing/campaigns/:id/send
 *
 * Per scope §5 Q4 — mass-send is destructive, so the modal-confirm is
 * non-negotiable. Per the codebase lesson from PR #391, all text uses
 * hardcoded dark-contrast colors (bg-gray-900, text-white / gray-100 /
 * gray-300 / gray-400) so theme-token resolution can't accidentally
 * make text unreadable.
 *
 * Caveat: v1 doesn't persist edits back to the draft. The subject +
 * body the user types in the textareas are display-only; the existing
 * sendCampaign endpoint uses what's already persisted in the campaigns
 * table. Phase 3.5 will wire the edit path through a PATCH on the
 * campaign before the send fires. For now, the shop's editing acts as
 * a final-review checkpoint; if they want to change the copy they
 * cancel + ask the AI to redraft.
 */
export const CampaignReviewModal: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSubject: string;
  initialBody: string;
  campaignId: string;
  audienceLabel: string;
  recipientCount: number;
  onSent: (result: CampaignDeliveryResult) => void;
}> = ({
  open,
  onOpenChange,
  initialSubject,
  initialBody,
  campaignId,
  audienceLabel,
  recipientCount,
  onSent,
}) => {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const onConfirm = async () => {
    setState("sending");
    setError(null);
    try {
      const result = await sendCampaign(campaignId);
      onSent(result);
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ||
        (err as Error)?.message ||
        "Send failed. Please try again.";
      setError(msg);
      setState("error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // Hardcoded dark contrast — see PR #391 lesson.
        className="sm:max-w-2xl bg-gray-900 border border-gray-800 text-white"
      >
        <DialogHeader>
          <DialogTitle className="text-white">Review before sending</DialogTitle>
          <DialogDescription className="text-gray-300">
            This will send the email immediately. Sent emails can&apos;t be
            recalled — review subject + body, then confirm.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Audience summary chip */}
          <div className="flex items-center gap-3 rounded-lg bg-gray-800/60 border border-gray-700 px-3 py-2">
            <Users className="w-4 h-4 text-[#FFCC00] flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium">
                {recipientCount.toLocaleString()}{" "}
                {recipientCount === 1 ? "recipient" : "recipients"}
              </p>
              <p className="text-xs text-gray-400 truncate">{audienceLabel}</p>
            </div>
            <span className="text-[10px] uppercase tracking-wide text-gray-400 flex items-center gap-1">
              <Mail className="w-3 h-3" />
              email
            </span>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1.5">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] transition-colors"
              maxLength={200}
              disabled={state === "sending"}
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1.5">
              Body
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] transition-colors resize-y font-mono"
              disabled={state === "sending"}
            />
            <p className="mt-1.5 text-[11px] text-gray-500">
              Editing here doesn&apos;t change the saved draft yet — use the
              manual Marketing tab to fully edit before sending. For quick
              redrafts, ask the AI to rewrite.
            </p>
          </div>

          {error && (
            <div className="rounded-md bg-red-900/30 border border-red-700/60 px-3 py-2 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-300 leading-relaxed">{error}</p>
            </div>
          )}
        </div>

        {/* Footer — Cancel + Send. Red button for the destructive verb. */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={state === "sending"}
            className="px-4 py-2 rounded-md text-sm text-gray-300 hover:text-white hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={state === "sending"}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium bg-red-600 text-white hover:bg-red-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {state === "sending" ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                Send {recipientCount.toLocaleString()}{" "}
                {recipientCount === 1 ? "email" : "emails"}
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
