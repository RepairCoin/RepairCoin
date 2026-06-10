"use client";

import React, { useState, useEffect } from "react";
import { Send, Loader2, AlertCircle, Users, Mail, CalendarClock, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  sendCampaign,
  scheduleCampaign,
  rewardPrecheck,
  RewardPrecheck,
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
  /** Banner embedded at the top of the email, if any — rendered in the
   *  preview so the shop sees the actual image before sending. */
  bannerImageUrl?: string | null;
  onSent: (result: CampaignDeliveryResult) => void;
}> = ({
  open,
  onOpenChange,
  initialSubject,
  initialBody,
  campaignId,
  audienceLabel,
  recipientCount,
  bannerImageUrl,
  onSent,
}) => {
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  // Phase 3 — send now vs schedule for later.
  const [mode, setMode] = useState<"now" | "later">("now");
  const [scheduleAt, setScheduleAt] = useState("");
  const [scheduledFor, setScheduledFor] = useState<Date | null>(null);
  // Pre-flight reward affordability — warn + disable Send BEFORE the tap when the
  // shop can't cover an on-send RCN reward. The server gate still backs this up.
  const [precheck, setPrecheck] = useState<RewardPrecheck | null>(null);

  useEffect(() => {
    if (!open) {
      setPrecheck(null);
      return;
    }
    let cancelled = false;
    rewardPrecheck(campaignId)
      .then((p) => { if (!cancelled) setPrecheck(p); })
      .catch(() => { if (!cancelled) setPrecheck(null); });
    return () => { cancelled = true; };
  }, [open, campaignId]);

  const balanceShort = precheck?.applicable === true && precheck.affordable === false;

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

  const onSchedule = async () => {
    if (!scheduleAt) {
      setError("Pick a date and time to schedule.");
      setState("error");
      return;
    }
    const when = new Date(scheduleAt);
    if (isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      setError("Schedule time must be in the future.");
      setState("error");
      return;
    }
    setState("sending");
    setError(null);
    try {
      await scheduleCampaign(campaignId, when.toISOString());
      setScheduledFor(when);
      setState("idle");
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ||
        (err as Error)?.message ||
        "Couldn't schedule. Please try again.";
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

          {/* Email preview — what recipients see (banner + subject + body).
              Reflects live edits to the fields below. */}
          <div>
            <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1.5">
              Preview
            </label>
            <div className="rounded-lg overflow-hidden border border-gray-700 bg-white">
              {bannerImageUrl && (
                // Full banner, width-constrained, natural height — matches the
                // email renderer (max-width:100%; height:auto). NOT object-cover,
                // which would crop the banner in the preview.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={bannerImageUrl}
                  alt="Campaign banner"
                  className="w-full h-auto block"
                />
              )}
              <div className="px-4 py-4">
                <h3 className="text-base font-bold text-gray-900 text-center break-words">
                  {subject}
                </h3>
                <div className="mt-2 text-sm text-gray-700 whitespace-pre-line break-words">
                  {body}
                </div>
              </div>
            </div>
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

          {/* When to send — now or scheduled (Phase 3 send-later). */}
          {!scheduledFor && (
            <div>
              <label className="block text-xs uppercase tracking-wide text-gray-400 mb-1.5">
                When to send
              </label>
              <div className="flex gap-2">
                {(["now", "later"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    disabled={state === "sending"}
                    className={
                      "flex-1 px-3 py-2 rounded-md text-sm font-medium border transition-colors disabled:opacity-50 " +
                      (mode === m
                        ? "border-[#FFCC00] bg-[#FFCC00]/10 text-white"
                        : "border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600")
                    }
                  >
                    {m === "now" ? "Send now" : "Schedule for later"}
                  </button>
                ))}
              </div>
              {mode === "later" && (
                <input
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={(e) => setScheduleAt(e.target.value)}
                  disabled={state === "sending"}
                  className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-[#FFCC00] transition-colors [color-scheme:dark]"
                />
              )}
            </div>
          )}

          {balanceShort && precheck && (
            <div className="rounded-md bg-amber-900/30 border border-amber-600/60 px-3 py-2 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-200 leading-relaxed">
                This campaign&apos;s reward needs{" "}
                <span className="font-semibold">{precheck.required.toLocaleString()} RCN</span>, but the shop&apos;s
                balance is <span className="font-semibold">{precheck.available.toLocaleString()} RCN</span>. Buy
                more RCN or lower the reward before sending.
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-red-900/30 border border-red-700/60 px-3 py-2 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-300 leading-relaxed">{error}</p>
            </div>
          )}
        </div>

        {/* Footer — scheduled-success, or Cancel + Send/Schedule. */}
        {scheduledFor ? (
          <div className="flex items-center justify-between gap-3 pt-2">
            <p className="flex items-center gap-2 text-sm text-emerald-400">
              <Check className="w-4 h-4 flex-shrink-0" />
              Scheduled for{" "}
              {scheduledFor.toLocaleString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 rounded-md text-sm font-medium bg-gray-700 text-white hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={state === "sending"}
              className="px-4 py-2 rounded-md text-sm text-gray-300 hover:text-white hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            {mode === "later" ? (
              <button
                type="button"
                onClick={onSchedule}
                disabled={state === "sending" || balanceShort}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium bg-[#FFCC00] text-black hover:bg-[#FFD700] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {state === "sending" ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Scheduling…
                  </>
                ) : (
                  <>
                    <CalendarClock className="w-3.5 h-3.5" />
                    Schedule
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={onConfirm}
                disabled={state === "sending" || balanceShort}
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
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
