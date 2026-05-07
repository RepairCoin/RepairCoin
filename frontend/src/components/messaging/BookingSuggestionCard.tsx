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
  slotIso: string;
  humanLabel?: string;
  depositUsd?: number;
}

export interface BookingSuggestionCardProps {
  suggestion: BookingSuggestion;
  /** Service display data — falls back to "this service" when unknown */
  serviceName?: string;
  servicePriceUsd?: number;
}

export function BookingSuggestionCard({
  suggestion,
  serviceName,
  servicePriceUsd,
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

  // Best-effort label: prefer the backend-supplied human label (already in
  // the shop's timezone). Fall back to a locale-rendered version of the ISO.
  const label =
    suggestion.humanLabel ||
    new Date(suggestion.slotIso).toLocaleString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  return (
    <button
      type="button"
      onClick={handleTap}
      className="mt-2 w-full text-left bg-violet-500/10 border border-violet-400/40 hover:border-violet-300 hover:bg-violet-500/20 rounded-xl px-4 py-3 transition-colors flex items-center gap-3 group"
      aria-label={`Tap to book ${serviceName ?? "this service"} on ${label}`}
    >
      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-violet-400/20 flex items-center justify-center">
        <Calendar className="w-4 h-4 text-violet-300" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-medium text-violet-300/80 uppercase tracking-wide">
          Tap to book
        </div>
        <div className="text-sm font-semibold text-white truncate">{label}</div>
        {(serviceName || servicePriceUsd !== undefined) && (
          <div className="text-xs text-gray-400 truncate">
            {serviceName ?? "Service"}
            {servicePriceUsd !== undefined && (
              <>
                {" · "}
                <span className="text-[#FFCC00]">${servicePriceUsd.toFixed(2)}</span>
              </>
            )}
            {suggestion.depositUsd !== undefined && suggestion.depositUsd > 0 && (
              <span className="text-gray-400">
                {" · "}${suggestion.depositUsd.toFixed(2)} deposit
              </span>
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
