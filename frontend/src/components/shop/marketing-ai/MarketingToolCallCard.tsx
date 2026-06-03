"use client";

import React, { useState } from "react";
import {
  Users,
  Mail,
  Megaphone,
  Send,
  Loader2,
  Check,
  Image as ImageIcon,
  Copy,
  RefreshCw,
} from "lucide-react";
import {
  MarketingToolCall,
  MarketingToolDisplay,
} from "@/services/api/aiMarketing";
import { sendCampaign } from "@/services/api/marketing";
import { CampaignReviewModal } from "./CampaignReviewModal";

/**
 * Inline card rendered under an assistant bubble for one tool the
 * model invoked. Mirrors InsightsToolCallCard's switch-on-kind pattern
 * but with marketing-specific display variants:
 *
 *   - audience_summary  → compact preview chip (recipient count + sample)
 *   - campaign_draft    → primary tap-to-open card; opens review modal
 *   - campaign_send     → inline confirm chip for an already-reviewed draft
 *   - strategy_chips    → row of tappable starter chips
 *
 * Tools that errored arrive with `display` undefined — render nothing;
 * Claude's prose will mention the failure.
 *
 * `onChipClick` is the panel's submit pipeline — strategy chips re-
 * enter chat as fresh user messages.
 */
export const MarketingToolCallCard: React.FC<{
  toolCall: MarketingToolCall;
  onChipClick?: (prompt: string) => void;
}> = ({ toolCall, onChipClick }) => {
  if (!toolCall.display) return null;

  switch (toolCall.display.kind) {
    case "audience_summary":
      return <AudienceSummaryCard d={toolCall.display} />;
    case "campaign_draft":
      return <CampaignDraftCard d={toolCall.display} />;
    case "campaign_send":
      return <CampaignSendCard d={toolCall.display} />;
    case "strategy_chips":
      return <StrategyChipsRow d={toolCall.display} onPick={onChipClick} />;
    case "campaign_image_proposal":
      return (
        <CampaignImageProposalCard d={toolCall.display} onRegenerate={onChipClick} />
      );
  }
};

// ----- audience_summary -----

const AudienceSummaryCard: React.FC<{
  d: Extract<MarketingToolDisplay, { kind: "audience_summary" }>;
}> = ({ d }) => {
  // Detect the degenerate case — shop asked for "top N" via
  // audienceFilters.limit, but their total customer base is smaller
  // than N. The card should make this explicit so the shop doesn't
  // wonder why the segment count is so small.
  //
  // Only fires when:
  //   - shop literally asked for a numeric limit ("top 50" → limit=50)
  //   - we know the total (totalShopCustomers populated)
  //   - the total is smaller than what the shop asked for
  //
  // Heuristic deliberately conservative — doesn't fire for "top spenders"
  // (no numeric limit) or for lapsed/active segments (those are
  // self-explanatory at any size).
  const askedFor =
    typeof d.audienceFilters?.limit === "number" ? d.audienceFilters.limit : null;
  const total = d.totalShopCustomers;
  const showSmallShopNote =
    askedFor != null && total != null && total < askedFor;

  return (
    <div className="rounded-lg bg-[#0f0f0f] border border-gray-800 px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <Users className="w-4 h-4 text-[#FFCC00]" />
        <p className="text-[10px] uppercase tracking-wide text-gray-500">
          Audience
        </p>
      </div>
      <p className="text-sm text-white">
        <span className="text-[#FFCC00] font-semibold">
          {d.resolvedCount.toLocaleString()}
        </span>{" "}
        {d.resolvedCount === 1 ? "customer" : "customers"} match
      </p>
      <p className="text-xs text-gray-400 mt-0.5">{d.label}</p>
      {showSmallShopNote && (
        <p className="mt-1.5 text-[11px] text-amber-400">
          Your shop has {total!.toLocaleString()}{" "}
          {total === 1 ? "customer" : "customers"} total — that&apos;s why this
          is smaller than the {askedFor!.toLocaleString()} you asked for.
        </p>
      )}
      {/* Sample chips — only render when the segment actually has
          matches. The chips come from the shop's full customer list
          (not segment-filtered), so when resolvedCount=0 they'd show
          customers who EXPLICITLY don't match the segment — actively
          misleading. Hiding the row entirely is the honest fallback;
          a fully-correct fix would query segment recipients
          separately, but that's a heavier change for a small UX gain. */}
      {d.resolvedCount > 0 && d.sampleNames && d.sampleNames.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {d.sampleNames.slice(0, 5).map((n, i) => (
            <span
              key={i}
              className="text-[10px] text-gray-300 bg-[#1A1A1A] border border-gray-700 rounded-full px-2 py-0.5"
            >
              {n}
            </span>
          ))}
          {d.resolvedCount > (d.sampleNames?.length ?? 0) && (
            <span className="text-[10px] text-gray-500">
              +{d.resolvedCount - (d.sampleNames?.length ?? 0)} more
            </span>
          )}
        </div>
      )}
    </div>
  );
};

// ----- campaign_draft (primary tap-to-open card) -----

const CampaignDraftCard: React.FC<{
  d: Extract<MarketingToolDisplay, { kind: "campaign_draft" }>;
}> = ({ d }) => {
  const [open, setOpen] = useState(false);
  const [sentAt, setSentAt] = useState<Date | null>(null);
  const [recipientCount, setRecipientCount] = useState(d.recipientCount);

  // Post-confirm state — emerald success treatment.
  if (sentAt) {
    return (
      <div className="rounded-lg bg-emerald-950/40 border border-emerald-800/60 px-4 py-3">
        <div className="flex items-center gap-2 mb-1">
          <Check className="w-4 h-4 text-emerald-400" />
          <p className="text-[10px] uppercase tracking-wide text-emerald-400">
            Sent
          </p>
        </div>
        <p className="text-sm text-white truncate">{d.subject}</p>
        <p className="text-xs text-emerald-300/80 mt-0.5">
          {recipientCount.toLocaleString()} emails queued
        </p>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full text-left rounded-lg bg-[#0f0f0f] border border-gray-800 hover:border-[#FFCC00]/60 hover:bg-[#141414] px-4 py-3 transition-colors group"
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-[#FFCC00]" />
            <p className="text-[10px] uppercase tracking-wide text-gray-500">
              Campaign draft
            </p>
          </div>
          <span className="text-[10px] text-gray-500 group-hover:text-[#FFCC00] transition-colors">
            Tap to preview →
          </span>
        </div>
        <p className="text-sm text-white font-medium truncate">{d.subject}</p>
        <p className="text-xs text-gray-400 mt-1 line-clamp-2 break-words">
          {d.bodyPreview}
        </p>
        <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-500">
          <span className="flex items-center gap-1">
            <Mail className="w-3 h-3" />
            {d.channel}
          </span>
          <span>·</span>
          <span>
            {d.recipientCount.toLocaleString()}{" "}
            {d.recipientCount === 1 ? "recipient" : "recipients"} ({d.audienceLabel})
          </span>
        </div>
      </button>

      {open && (
        <CampaignReviewModal
          open={open}
          onOpenChange={setOpen}
          initialSubject={d.subject}
          initialBody={d.bodyPreview}
          campaignId={d.campaignId}
          audienceLabel={d.audienceLabel}
          recipientCount={d.recipientCount}
          onSent={(result) => {
            setSentAt(new Date());
            setRecipientCount(result.emailsSent);
            setOpen(false);
          }}
        />
      )}
    </>
  );
};

// ----- campaign_send (inline confirm chip) -----

const CampaignSendCard: React.FC<{
  d: Extract<MarketingToolDisplay, { kind: "campaign_send" }>;
}> = ({ d }) => {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const [sentCount, setSentCount] = useState(0);

  const onConfirm = async () => {
    setState("sending");
    setError(null);
    try {
      const result = await sendCampaign(d.campaignId);
      setSentCount(result?.emailsSent ?? d.recipientCount);
      setState("sent");
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

  if (state === "sent") {
    return (
      <div className="rounded-lg bg-emerald-950/40 border border-emerald-800/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <p className="text-sm text-white">
            Sent — {sentCount.toLocaleString()} emails queued
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-[#0f0f0f] border border-gray-800 px-4 py-3">
      <p className="text-sm text-white mb-2">
        Send this draft to{" "}
        <span className="font-semibold text-[#FFCC00]">
          {d.recipientCount.toLocaleString()}{" "}
          {d.recipientCount === 1 ? "customer" : "customers"}
        </span>
        ?
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={state === "sending"}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-[#FFCC00] text-black hover:bg-[#FFD700] text-sm font-medium px-3 py-1.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {state === "sending" ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5" />
              Yes, send
            </>
          )}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
};

// ----- strategy_chips -----

const StrategyChipsRow: React.FC<{
  d: Extract<MarketingToolDisplay, { kind: "strategy_chips" }>;
  onPick?: (prompt: string) => void;
}> = ({ d, onPick }) => {
  if (d.items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {d.items.map((s, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onPick?.(s)}
          disabled={!onPick}
          className="text-[11px] text-gray-300 bg-[#1A1A1A] border border-gray-700 hover:border-[#FFCC00] hover:text-white rounded-full px-3 py-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {s}
        </button>
      ))}
    </div>
  );
};

// ----- campaign_image_proposal (AI-generated marketing image) -----

const CampaignImageProposalCard: React.FC<{
  d: Extract<MarketingToolDisplay, { kind: "campaign_image_proposal" }>;
  onRegenerate?: (prompt: string) => void;
}> = ({ d, onRegenerate }) => {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(d.imageUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — no-op */
    }
  };

  return (
    <div className="rounded-lg bg-[#0f0f0f] border border-gray-800 p-3 max-w-sm">
      <div className="flex items-center gap-2 mb-2">
        <ImageIcon className="w-4 h-4 text-[#FFCC00]" />
        <p className="text-[10px] uppercase tracking-wide text-gray-500">
          {d.operationType === "edit" ? "Edited image" : "Image proposal"}
        </p>
        <span className="ml-auto text-[10px] text-gray-500">{d.dimensions}</span>
      </div>

      {/* Preview — click to open full size. */}
      <a
        href={d.imageUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="Open full size"
        className="block"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={d.imageUrl}
          alt={d.altText}
          loading="lazy"
          className="w-full rounded-md border border-gray-800 hover:border-gray-700 transition-colors"
        />
      </a>

      <p className="mt-2 text-[11px] text-gray-400 line-clamp-2">{d.prompt}</p>
      <p className="mt-1 text-[10px] text-gray-600">
        Brand colors + logo applied automatically.
      </p>

      <div className="mt-2.5 flex gap-2">
        <button
          type="button"
          onClick={copyLink}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-[#FFCC00] text-black hover:bg-[#FFD700] transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" /> Copied
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" /> Copy link
            </>
          )}
        </button>
        {onRegenerate && (
          <button
            type="button"
            onClick={() => onRegenerate(`Regenerate that image — ${d.prompt}`)}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-[#1A1A1A] border border-gray-700 text-gray-300 hover:border-[#FFCC00] hover:text-white transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Regenerate
          </button>
        )}
      </div>
    </div>
  );
};
