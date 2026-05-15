"use client";

import { Calendar, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";

/**
 * BookingSuggestionCard
 *
 * Tappable card rendered below an AI message bubble when the AI proposed a
 * specific bookable slot (Phase 3 Task 10). Tapping opens the existing
 * service checkout flow with the slot pre-filled, so the customer just
 * confirms + pays.
 *
 * Data shape comes from `messages.metadata.booking_suggestions[]` — populated
 * by the backend's BookingSuggestionParser after validating the AI's
 * fenced JSON block against the real availability set we sent to Claude.
 * Cards never link to slots that aren't actually bookable.
 */

export interface BookingSuggestion {
  serviceId: string;
  /**
   * Phase 5 of multi-service architecture: backend now stamps the service
   * name onto each suggestion so multi-card responses (Phase 3) can label
   * each card with its own service. Optional for backwards compatibility
   * with older payloads — caller falls back to the prop `serviceName`
   * (message-level) when this is missing.
   */
  serviceName?: string;
  slotIso: string;
  humanLabel?: string;
  depositUsd?: number;
}

export interface BookingSuggestionCardProps {
  suggestion: BookingSuggestion;
  /**
   * Fallback service name used only when the suggestion itself doesn't
   * carry one (older backend payloads). Phase 5 callers should prefer
   * letting the suggestion's serviceName drive the label so each card in
   * a multi-card response renders correctly.
   */
  serviceName?: string;
  servicePriceUsd?: number;
  /**
   * Render the card as a read-only audit view — gray styling, no click
   * handler, no chevron, no hover affordance. Used on the shop dashboard
   * so staff can see exactly what slot the AI proposed to the customer
   * without being able to (or expected to) trigger the checkout flow on
   * the customer's behalf. Customer side always passes false (default).
   */
  readOnly?: boolean;
}

export function BookingSuggestionCard({
  suggestion,
  serviceName: serviceNameProp,
  servicePriceUsd,
  readOnly = false,
}: BookingSuggestionCardProps) {
  const router = useRouter();

  const handleTap = () => {
    // Navigate to the service checkout route with pre-fill query params.
    // ServiceCheckoutClient (consumer of these params) reads them and auto-
    // opens ServiceCheckoutModal with date + time picked.
    const params = new URLSearchParams();
    params.set("suggestedSlotIso", suggestion.slotIso);
    if (suggestion.depositUsd !== undefined) {
      params.set("suggestedDeposit", String(suggestion.depositUsd));
    }
    router.push(`/service/${suggestion.serviceId}?${params.toString()}`);
  };

  // Best-effort time label: prefer the backend-supplied human label
  // (already in the shop's timezone). Fall back to a locale-rendered
  // version of the ISO.
  const timeLabel =
    suggestion.humanLabel ||
    new Date(suggestion.slotIso).toLocaleString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  // Phase 5: each suggestion now carries its own serviceName. Prefer that
  // over the message-level prop fallback — critical for multi-card
  // responses where each card belongs to a different service.
  const displayServiceName = suggestion.serviceName ?? serviceNameProp;

  if (readOnly) {
    // Audit / shop-side rendering. No button semantics, no click, no
    // hover transitions. Gray palette so the card reads as "this is
    // historical info" rather than "this is interactive."
    return (
      <div
        className="mt-2 w-full bg-gray-800/40 border border-gray-700/60 rounded-xl px-4 py-3 flex items-center gap-3"
        aria-label={`AI proposed booking for ${displayServiceName ?? "this service"} on ${timeLabel} (read-only)`}
      >
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-700/40 flex items-center justify-center">
          <Calendar className="w-4 h-4 text-gray-400" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
            AI proposed slot
          </div>
          {displayServiceName && (
            <div className="text-sm font-semibold text-gray-300 truncate">
              {displayServiceName}
            </div>
          )}
          <div
            className={
              displayServiceName
                ? "text-xs text-gray-400 truncate"
                : "text-sm font-semibold text-gray-300 truncate"
            }
          >
            {timeLabel}
          </div>
          {(servicePriceUsd !== undefined ||
            (suggestion.depositUsd !== undefined && suggestion.depositUsd > 0)) && (
            <div className="text-xs text-gray-500 truncate">
              {servicePriceUsd !== undefined && (
                <span>${servicePriceUsd.toFixed(2)}</span>
              )}
              {servicePriceUsd !== undefined &&
                suggestion.depositUsd !== undefined &&
                suggestion.depositUsd > 0 &&
                " · "}
              {suggestion.depositUsd !== undefined && suggestion.depositUsd > 0 && (
                <span>${suggestion.depositUsd.toFixed(2)} deposit</span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleTap}
      className="mt-2 w-full text-left bg-violet-500/10 border border-violet-400/40 hover:border-violet-300 hover:bg-violet-500/20 rounded-xl px-4 py-3 transition-colors flex items-center gap-3 group"
      aria-label={`Tap to book ${displayServiceName ?? "this service"} on ${timeLabel}`}
    >
      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-violet-400/20 flex items-center justify-center">
        <Calendar className="w-4 h-4 text-violet-300" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-medium text-violet-300/80 uppercase tracking-wide">
          Tap to book
        </div>
        {/* Phase 5: service name now the primary label, with time below it.
            Previously the time was primary and the service name was buried
            in the secondary line — which read ambiguously when Phase 3
            stacked two cards with different services and identical time
            formatting. */}
        {displayServiceName && (
          <div className="text-sm font-semibold text-white truncate">
            {displayServiceName}
          </div>
        )}
        <div
          className={
            displayServiceName
              ? "text-xs text-gray-300 truncate"
              : "text-sm font-semibold text-white truncate"
          }
        >
          {timeLabel}
        </div>
        {(servicePriceUsd !== undefined ||
          (suggestion.depositUsd !== undefined && suggestion.depositUsd > 0)) && (
          <div className="text-xs text-gray-400 truncate">
            {servicePriceUsd !== undefined && (
              <span className="text-[#FFCC00]">${servicePriceUsd.toFixed(2)}</span>
            )}
            {servicePriceUsd !== undefined &&
              suggestion.depositUsd !== undefined &&
              suggestion.depositUsd > 0 &&
              " · "}
            {suggestion.depositUsd !== undefined && suggestion.depositUsd > 0 && (
              <span>${suggestion.depositUsd.toFixed(2)} deposit</span>
            )}
          </div>
        )}
      </div>
      <ChevronRight
        className="w-5 h-5 text-violet-300/60 group-hover:text-violet-200 flex-shrink-0"
        aria-hidden="true"
      />
    </button>
  );
}
