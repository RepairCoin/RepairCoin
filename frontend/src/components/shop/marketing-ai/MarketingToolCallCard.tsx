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
  Store,
  Sparkles,
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
      return <CampaignDraftCard d={toolCall.display} onSubmitPrompt={onChipClick} />;
    case "campaign_send":
      return <CampaignSendCard d={toolCall.display} />;
    case "strategy_chips":
      return <StrategyChipsRow d={toolCall.display} onPick={onChipClick} />;
    case "campaign_image_proposal":
      return (
        <CampaignImageProposalCard d={toolCall.display} onSubmitPrompt={onChipClick} />
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
        <p className="text-xs uppercase tracking-wide text-gray-500">
          Audience
        </p>
      </div>
      <p className="text-sm text-white">
        <span className="text-[#FFCC00] font-semibold">
          {d.resolvedCount.toLocaleString()}
        </span>{" "}
        {d.resolvedCount === 1 ? "customer" : "customers"} match
      </p>
      <p className="text-sm text-gray-400 mt-0.5">{d.label}</p>
      {showSmallShopNote && (
        <p className="mt-1.5 text-sm text-amber-400">
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
              className="text-xs text-gray-300 bg-[#1A1A1A] border border-gray-700 rounded-full px-2 py-0.5"
            >
              {n}
            </span>
          ))}
          {d.resolvedCount > (d.sampleNames?.length ?? 0) && (
            <span className="text-xs text-gray-500">
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
  /** Panel submit pipeline — powers the one-tap "add a banner" suggestions
   *  (each resubmits a message the assistant maps to a banner action). */
  onSubmitPrompt?: (prompt: string) => void;
}> = ({ d, onSubmitPrompt }) => {
  const [open, setOpen] = useState(false);
  const [sentAt, setSentAt] = useState<Date | null>(null);
  const [recipientCount, setRecipientCount] = useState(d.recipientCount);

  // Post-confirm state — emerald success treatment.
  if (sentAt) {
    return (
      <div className="rounded-lg bg-emerald-950/40 border border-emerald-800/60 px-4 py-3">
        <div className="flex items-center gap-2 mb-1">
          <Check className="w-4 h-4 text-emerald-400" />
          <p className="text-xs uppercase tracking-wide text-emerald-400">
            Sent
          </p>
        </div>
        <p className="text-sm text-white truncate">{d.subject}</p>
        <p className="text-sm text-emerald-300/80 mt-0.5">
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
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Campaign draft
            </p>
          </div>
          <span className="text-xs text-gray-500 group-hover:text-[#FFCC00] transition-colors">
            Tap to preview →
          </span>
        </div>
        <p className="text-sm text-white font-medium truncate">{d.subject}</p>
        <p className="text-sm text-gray-400 mt-1 line-clamp-2 break-words">
          {d.bodyPreview}
        </p>
        {d.imageUrl && (
          <div className="mt-2 flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={d.imageUrl}
              alt="Banner"
              className="w-12 h-12 rounded object-cover border border-gray-700 flex-shrink-0"
            />
            <span className="inline-flex items-center gap-1 text-xs text-gray-400">
              <ImageIcon className="w-3 h-3" /> Banner attached
            </span>
          </div>
        )}
        <div className="mt-2 flex items-center gap-3 text-sm text-gray-500">
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
        {d.estimatedRevenue && (
          <p className="mt-1.5 text-sm text-emerald-400/90">
            Est. opportunity: $
            {d.estimatedRevenue.lowUsd.toLocaleString()}–$
            {d.estimatedRevenue.highUsd.toLocaleString()}{" "}
            <span className="text-xs text-gray-500">(rough estimate)</span>
          </p>
        )}
        {d.reward && (
          <p className="mt-1.5 text-sm text-violet-300">
            🎁 Reward:{" "}
            <span className="font-semibold">
              {d.reward.summary
                ? d.reward.summary
                : `${(d.reward.rcnPerRecipient ?? 0).toLocaleString()} RCN each${
                    d.reward.totalRcn != null
                      ? ` · ${d.reward.fulfillment === "on_return" ? "up to " : ""}${d.reward.totalRcn.toLocaleString()} RCN total`
                      : ""
                  }`}
            </span>{" "}
            <span className="text-xs text-gray-500">
              {d.reward.fulfillment === "on_return"
                ? `(when they return${
                    d.reward.returnWindowDays ? `, ${d.reward.returnWindowDays} days` : ""
                  })`
                : "(issued on send)"}
            </span>
          </p>
        )}
        {d.coupon && (
          <p className="mt-1.5 text-sm text-violet-300">
            🎟️ Coupon:{" "}
            <span className="font-semibold font-mono">{d.coupon.code}</span> ·{" "}
            +{d.coupon.bonusRcn.toLocaleString()} RCN{" "}
            <span className="text-xs text-gray-500">(redeemed on next visit)</span>
          </p>
        )}
      </button>

      {/* One-tap banner suggestion — only when the draft has no banner yet.
          Sibling to the tap-to-open button above (buttons can't nest). Each tap
          resubmits a message the assistant turns into a banner action: reuse the
          shop's storefront photo, or design a fresh branded banner. Banners stay
          optional — the owner just sends as-is if they skip this. */}
      {onSubmitPrompt && !d.imageUrl && (
        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap pl-1">
          <span className="text-xs text-gray-500">Add a banner?</span>
          <button
            type="button"
            onClick={() =>
              onSubmitPrompt(
                "Use our storefront photo as the banner for that campaign."
              )
            }
            className="inline-flex items-center gap-1 text-sm px-2 py-1 rounded-md bg-[#1A1A1A] border border-gray-700 text-gray-300 hover:border-[#FFCC00]/60 hover:text-white transition-colors"
          >
            <Store className="w-3 h-3" /> Use storefront
          </button>
          <button
            type="button"
            onClick={() =>
              onSubmitPrompt(
                "Design a banner for that campaign based on its subject and message."
              )
            }
            className="inline-flex items-center gap-1 text-sm px-2 py-1 rounded-md bg-[#1A1A1A] border border-gray-700 text-gray-300 hover:border-[#FFCC00]/60 hover:text-white transition-colors"
          >
            <Sparkles className="w-3 h-3" /> Design one
          </button>
        </div>
      )}

      {open && (
        <CampaignReviewModal
          open={open}
          onOpenChange={setOpen}
          initialSubject={d.subject}
          initialBody={d.bodyPreview}
          campaignId={d.campaignId}
          audienceLabel={d.audienceLabel}
          recipientCount={d.recipientCount}
          bannerImageUrl={d.imageUrl ?? undefined}
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
          className="text-sm text-gray-300 bg-[#1A1A1A] border border-gray-700 hover:border-[#FFCC00] hover:text-white rounded-full px-3 py-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {s}
        </button>
      ))}
    </div>
  );
};

// ----- campaign_image_proposal (AI-generated marketing image) -----

// gpt-image-1's three sizes ↔ shop-friendly shape labels. The card lets the shop
// re-render in another ratio with one tap — it sends a regenerate message the AI
// maps to proposeCampaignImage's `orientation` param (landscape/square/portrait).
const SHAPE_BY_DIMENSIONS: Record<string, "banner" | "square" | "story"> = {
  "1536x1024": "banner",
  "1024x1024": "square",
  "1024x1536": "story",
};
// Each shape carries a proportional glyph (w×h in px, matching the real ratio)
// so the shop SEES the shape — a wide rectangle, a square, a tall rectangle —
// instead of having to know the words "landscape/portrait". The label stays.
const SHAPES: Array<{
  key: "banner" | "square" | "story";
  label: string;
  keyword: string;
  glyph: { w: number; h: number };
}> = [
  { key: "banner", label: "Banner", keyword: "landscape email banner", glyph: { w: 24, h: 16 } },
  { key: "square", label: "Square", keyword: "square social", glyph: { w: 17, h: 17 } },
  { key: "story", label: "Story", keyword: "vertical portrait story", glyph: { w: 13, h: 19 } },
];

const CampaignImageProposalCard: React.FC<{
  d: Extract<MarketingToolDisplay, { kind: "campaign_image_proposal" }>;
  /** The panel's submit pipeline — resubmits the given text as a new user
   *  message (powers both Regenerate and Use-in-campaign). */
  onSubmitPrompt?: (prompt: string) => void;
}> = ({ d, onSubmitPrompt }) => {
  const [copied, setCopied] = useState(false);
  const currentShape = SHAPE_BY_DIMENSIONS[d.dimensions] ?? "banner";

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
        <p className="text-xs uppercase tracking-wide text-gray-500">
          {d.operationType === "edit" ? "Edited image" : "Image proposal"}
        </p>
        <span className="ml-auto text-xs text-gray-500">{d.dimensions}</span>
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

      <p className="mt-2 text-sm text-gray-400 line-clamp-2">{d.prompt}</p>
      <p className="mt-1 text-xs text-gray-600">
        Brand colors + logo applied automatically.
      </p>

      {/* Shape / ratio — proportional glyph + label so the shop sees the actual
          shape (wide / square / tall). Tapping re-renders a generate in that
          ratio, or re-shapes an edit (its default ratio follows the source). */}
      {onSubmitPrompt && (
        <div className="mt-2.5">
          <span className="block text-xs uppercase tracking-wide text-gray-500 mb-1">
            Shape
          </span>
          <div className="flex items-stretch gap-2">
            {SHAPES.map((s) => {
              const active = s.key === currentShape;
              const reshape =
                d.operationType === "edit"
                  ? `Change that image to a ${s.keyword} shape, keeping the same content and text.`
                  : `Regenerate that image as a ${s.keyword} image — ${d.prompt}`;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => onSubmitPrompt(reshape)}
                  title={
                    active ? `Current shape: ${s.label}` : `Re-render as ${s.label}`
                  }
                  className={
                    "flex flex-col items-center gap-1 px-3 py-2 rounded-lg border transition-colors " +
                    (active
                      ? "border-[#FFCC00] bg-[#FFCC00]/10"
                      : "border-gray-700 bg-[#1A1A1A] hover:border-[#FFCC00]/60")
                  }
                >
                  {/* fixed-height area so glyphs of different heights align */}
                  <span className="flex items-center justify-center h-5">
                    <span
                      style={{ width: s.glyph.w, height: s.glyph.h }}
                      className={
                        "rounded-[2px] border-2 " +
                        (active
                          ? "border-[#FFCC00] bg-[#FFCC00]/40"
                          : "border-gray-400")
                      }
                    />
                  </span>
                  <span
                    className={
                      "text-xs font-medium " +
                      (active ? "text-[#FFCC00]" : "text-gray-300")
                    }
                  >
                    {s.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap gap-2">
        {onSubmitPrompt && (
          <button
            type="button"
            onClick={() =>
              onSubmitPrompt(
                `Use this image as the banner in a campaign — image URL: ${d.imageUrl}`
              )
            }
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-[#FFCC00] text-black hover:bg-[#FFD700] transition-colors"
          >
            <Megaphone className="w-3.5 h-3.5" /> Use in campaign
          </button>
        )}
        <button
          type="button"
          onClick={copyLink}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-[#1A1A1A] border border-gray-700 text-gray-300 hover:border-[#FFCC00] hover:text-white transition-colors"
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
        {onSubmitPrompt && (
          <button
            type="button"
            onClick={() => onSubmitPrompt(`Regenerate that image — ${d.prompt}`)}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-[#1A1A1A] border border-gray-700 text-gray-300 hover:border-[#FFCC00] hover:text-white transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Regenerate
          </button>
        )}
      </div>
    </div>
  );
};
