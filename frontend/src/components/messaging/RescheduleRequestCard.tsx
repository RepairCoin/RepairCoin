"use client";

import { useState } from "react";
import { CalendarClock, Check, Loader2, AlertCircle } from "lucide-react";
import { appointmentsApi } from "@/services/api/appointments";

/**
 * RescheduleRequestCard
 *
 * Rendered below an AI message bubble when the AI proposed moving an
 * upcoming booking to a new slot via `propose_reschedule_request`. Source
 * data lives in `messages.metadata.reschedule_proposals[]`.
 *
 * Interaction model (Q4 of reschedule-cancel-scope.md): inline-confirm —
 * a single tap commits the reschedule REQUEST. No modal. The action is
 * non-destructive (the shop still has to approve), and the customer can
 * undo via the existing "cancel pending request" flow in their dashboard.
 *
 * Optimistic state pattern mirrors the InsightsPanel PinButton:
 *   idle → submitting → submitted (✓ for 1.5s sticky → permanent) | error (red for 2s → revert)
 *
 * Phase 4.3 of the reschedule + cancel chat work.
 */

export interface RescheduleProposal {
  orderId: string;
  serviceId: string;
  serviceName: string;
  currentBookingDate: string;
  currentBookingTime: string;
  requestedDate: string;
  requestedTime: string;
  requestedLabel: string;
}

export interface RescheduleRequestCardProps {
  proposal: RescheduleProposal;
  /**
   * Read-only audit variant for shop-side rendering.
   */
  readOnly?: boolean;
  /**
   * Unused at this level — kept for parity with the other proposal cards.
   */
  conversationId?: string;
}

type SubmitState = "idle" | "submitting" | "submitted" | "error";

export function RescheduleRequestCard({
  proposal,
  readOnly = false,
  conversationId: _conversationId,
}: RescheduleRequestCardProps) {
  const [state, setState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentLabel = formatTimeLabel(
    proposal.currentBookingDate,
    proposal.currentBookingTime
  );
  // Prefer the server-supplied human label when available; otherwise fall
  // back to a locale-rendered version (same logic as the other cards).
  const requestedLabel =
    proposal.requestedLabel ||
    formatTimeLabel(proposal.requestedDate, proposal.requestedTime);

  const handleTap = async () => {
    if (state === "submitting" || state === "submitted") return;
    setState("submitting");
    setErrorMessage(null);
    try {
      await appointmentsApi.createRescheduleRequest(
        proposal.orderId,
        proposal.requestedDate,
        proposal.requestedTime
      );
      setState("submitted");
      // No revert timer — "submitted" is the final visual state. The card
      // stays as "request submitted" forever after. Phase 5's event-bus
      // subscriber additionally posts an AI confirmation message into the
      // chat thread.
    } catch (err) {
      const ax = err as {
        response?: { status?: number; data?: { error?: string } };
        message?: string;
      };
      const status = ax?.response?.status;
      const detail = ax?.response?.data?.error;
      let msg: string;
      switch (status) {
        case 400:
          msg =
            detail ||
            "We couldn't submit the request. The slot may no longer be available.";
          break;
        case 401:
          msg = "Your session has expired. Please log in again.";
          break;
        case 409:
          // RescheduleService rejects when a pending request already
          // exists for this order. The AI tool's enum should have
          // excluded the order_id in that case, but a stale client
          // could land here.
          msg = "You already have a pending reschedule request for this booking.";
          break;
        default:
          msg = detail || ax?.message || "Couldn't submit the reschedule request.";
      }
      setErrorMessage(msg);
      setState("error");
      // Revert to idle after 2s so the customer can retry.
      window.setTimeout(() => {
        setState("idle");
        setErrorMessage(null);
      }, 2000);
    }
  };

  if (readOnly) {
    return (
      <div
        className="mt-2 w-full bg-gray-800/40 border border-gray-700/60 rounded-xl px-4 py-3 flex items-center gap-3"
        aria-label={`AI proposed reschedule for ${proposal.serviceName} to ${requestedLabel} (read-only)`}
      >
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-700/40 flex items-center justify-center">
          <CalendarClock className="w-4 h-4 text-gray-400" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
            AI proposed reschedule
          </div>
          <div className="text-sm font-semibold text-gray-300 truncate">
            {proposal.serviceName}
          </div>
          <div className="text-xs text-gray-400 truncate">
            {currentLabel} → {requestedLabel}
          </div>
        </div>
      </div>
    );
  }

  // Submitted (final state) — green check, no further tap.
  if (state === "submitted") {
    return (
      <div
        className="mt-2 w-full bg-emerald-500/10 border border-emerald-400/40 rounded-xl px-4 py-3 flex items-center gap-3"
        aria-label={`Reschedule request submitted for ${proposal.serviceName} to ${requestedLabel}`}
      >
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-emerald-400/20 flex items-center justify-center">
          <Check className="w-4 h-4 text-emerald-300" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-medium text-emerald-300/80 uppercase tracking-wide">
            Request submitted
          </div>
          <div className="text-sm font-semibold text-white truncate">
            {proposal.serviceName}
          </div>
          <div className="text-xs text-gray-300 truncate">
            Moved to {requestedLabel} — shop will approve shortly.
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleTap}
        disabled={state === "submitting"}
        className={
          state === "error"
            ? "mt-2 w-full text-left bg-red-500/10 border border-red-400/50 rounded-xl px-4 py-3 flex items-center gap-3"
            : "mt-2 w-full text-left bg-blue-500/10 border border-blue-400/40 hover:border-blue-300 hover:bg-blue-500/20 rounded-xl px-4 py-3 transition-colors flex items-center gap-3 group disabled:opacity-70 disabled:cursor-wait"
        }
        aria-label={`Tap to request reschedule of ${proposal.serviceName} to ${requestedLabel}`}
      >
        <div
          className={
            state === "error"
              ? "flex-shrink-0 w-9 h-9 rounded-full bg-red-400/20 flex items-center justify-center"
              : "flex-shrink-0 w-9 h-9 rounded-full bg-blue-400/20 flex items-center justify-center"
          }
        >
          {state === "submitting" ? (
            <Loader2
              className="w-4 h-4 text-blue-300 animate-spin"
              aria-hidden="true"
            />
          ) : state === "error" ? (
            <AlertCircle className="w-4 h-4 text-red-300" aria-hidden="true" />
          ) : (
            <CalendarClock className="w-4 h-4 text-blue-300" aria-hidden="true" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div
            className={
              state === "error"
                ? "text-[11px] font-medium text-red-300/80 uppercase tracking-wide"
                : "text-[11px] font-medium text-blue-300/80 uppercase tracking-wide"
            }
          >
            {state === "submitting"
              ? "Sending request…"
              : state === "error"
                ? "Couldn't submit"
                : "Tap to request reschedule"}
          </div>
          <div className="text-sm font-semibold text-white truncate">
            {proposal.serviceName}
          </div>
          <div className="text-xs text-gray-300 truncate">
            {currentLabel} → {requestedLabel}
          </div>
          {state === "error" && errorMessage && (
            <div className="text-[11px] text-red-300/90 mt-1">{errorMessage}</div>
          )}
        </div>
      </button>
    </>
  );
}

function formatTimeLabel(bookingDate: string, bookingTime: string): string {
  const iso = `${bookingDate}T${bookingTime.length === 5 ? `${bookingTime}:00` : bookingTime}`;
  try {
    const d = new Date(iso);
    if (!isNaN(d.getTime())) {
      return d.toLocaleString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    }
  } catch {
    // fall through
  }
  return `${bookingDate} ${bookingTime}`;
}
