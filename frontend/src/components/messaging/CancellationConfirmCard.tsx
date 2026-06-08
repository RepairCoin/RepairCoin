"use client";

import { useState } from "react";
import { XCircle } from "lucide-react";
import { CancellationConfirmModal } from "./CancellationConfirmModal";

/**
 * CancellationConfirmCard
 *
 * Rendered below an AI message bubble when the AI proposed cancelling an
 * upcoming booking via `propose_cancellation`. Source data lives in
 * `messages.metadata.cancellation_proposals[]` — populated server-side by
 * AgentOrchestrator after validating the tool_use block.
 *
 * Interaction model (Q4 of reschedule-cancel-scope.md): the card itself
 * opens a confirmation modal — single-tap commit is intentionally NOT used
 * here. Cancellation is destructive (slot is freed; customer would have to
 * re-book to undo). The modal's explicit Confirm button is the safety
 * friction we want.
 *
 * Phase 4.1 of the reschedule + cancel chat work.
 */

export interface CancellationProposal {
  orderId: string;
  serviceId: string;
  serviceName: string;
  bookingDate: string;
  bookingTime: string;
  withinCancellationWindow: boolean;
}

export interface CancellationConfirmCardProps {
  proposal: CancellationProposal;
  /**
   * Read-only audit variant for shop-side rendering. The shop staff sees the
   * card so they know "the AI proposed this cancellation to the customer"
   * but cannot trigger it themselves. Customer side always passes false.
   */
  readOnly?: boolean;
  /**
   * Threaded into the modal's success path so the parent ConversationThread
   * can refetch / refresh the conversation if it wants to. Currently
   * unused at the card level — kept for parity with BookingSuggestionCard.
   */
  conversationId?: string;
}

export function CancellationConfirmCard({
  proposal,
  readOnly = false,
  conversationId: _conversationId,
}: CancellationConfirmCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  // Once the modal's Confirm path succeeds we flip the card to a "cancelled"
  // state in-place. Phase 5's event-bus subscriber will additionally post
  // an AI confirmation message into the chat, but the card change here
  // gives immediate visual feedback even before that message lands.
  const [didCancel, setDidCancel] = useState(false);

  const timeLabel = formatBookingTimeLabel(
    proposal.bookingDate,
    proposal.bookingTime
  );

  // 24h-guard branch: when the appointment is within the cancellation
  // window, render the card in a disabled / informational shape with an
  // inline hint. Tap is dead. The AI should also have refused to call the
  // tool in this case (orchestrator drops it server-side), but defense in
  // depth — if a stale client somehow renders a within-window proposal,
  // the customer can't tap-through to a guaranteed 400.
  if (!proposal.withinCancellationWindow) {
    return (
      <div
        className="mt-2 w-full bg-gray-800/40 border border-gray-700/60 rounded-xl px-4 py-3 flex items-center gap-3"
        aria-label={`Cancellation unavailable for ${proposal.serviceName} on ${timeLabel} — within 24 hours of the appointment`}
      >
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-700/40 flex items-center justify-center">
          <XCircle className="w-4 h-4 text-gray-400" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
            Cancellation unavailable
          </div>
          <div className="text-sm font-semibold text-gray-300 truncate">
            {proposal.serviceName}
          </div>
          <div className="text-xs text-gray-400 truncate">{timeLabel}</div>
          <div className="text-[11px] text-gray-500 mt-1">
            Within 24 hours — contact the shop directly to cancel.
          </div>
        </div>
      </div>
    );
  }

  if (readOnly) {
    // Audit / shop-side rendering. No button semantics, no click. Gray
    // palette so the card reads as historical context.
    return (
      <div
        className="mt-2 w-full bg-gray-800/40 border border-gray-700/60 rounded-xl px-4 py-3 flex items-center gap-3"
        aria-label={`AI proposed cancellation for ${proposal.serviceName} on ${timeLabel} (read-only)`}
      >
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-700/40 flex items-center justify-center">
          <XCircle className="w-4 h-4 text-gray-400" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
            AI proposed cancellation
          </div>
          <div className="text-sm font-semibold text-gray-300 truncate">
            {proposal.serviceName}
          </div>
          <div className="text-xs text-gray-400 truncate">{timeLabel}</div>
        </div>
      </div>
    );
  }

  // Post-confirm state: the customer tapped Confirm in the modal and the
  // API call succeeded. The card stays in place as a record of the
  // cancellation, but the tap is dead and styling is muted-green so it
  // reads as "already done."
  if (didCancel) {
    return (
      <div
        className="mt-2 w-full bg-emerald-500/10 border border-emerald-400/40 rounded-xl px-4 py-3 flex items-center gap-3"
        aria-label={`Cancelled: ${proposal.serviceName} on ${timeLabel}`}
      >
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-emerald-400/20 flex items-center justify-center">
          <XCircle className="w-4 h-4 text-emerald-300" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-medium text-emerald-300/80 uppercase tracking-wide">
            Cancelled
          </div>
          <div className="text-sm font-semibold text-white truncate">
            {proposal.serviceName}
          </div>
          <div className="text-xs text-gray-300 truncate">{timeLabel}</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="mt-2 w-full text-left bg-red-500/10 border border-red-400/40 hover:border-red-300 hover:bg-red-500/20 rounded-xl px-4 py-3 transition-colors flex items-center gap-3 group"
        aria-label={`Tap to cancel ${proposal.serviceName} on ${timeLabel}`}
      >
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-red-400/20 flex items-center justify-center">
          <XCircle className="w-4 h-4 text-red-300" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-medium text-red-300/80 uppercase tracking-wide">
            Tap to cancel
          </div>
          <div className="text-sm font-semibold text-white truncate">
            {proposal.serviceName}
          </div>
          <div className="text-xs text-gray-300 truncate">{timeLabel}</div>
        </div>
      </button>

      <CancellationConfirmModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        proposal={proposal}
        onCancelled={() => setDidCancel(true)}
      />
    </>
  );
}

/**
 * Locale-render the booking date + time so the card matches the user's
 * timezone hint. Falls back to the raw string if Date parsing fails.
 */
function formatBookingTimeLabel(
  bookingDate: string,
  bookingTime: string
): string {
  if (!bookingDate || !bookingTime) return 'No date provided';
  // Compose a parseable ISO-ish string. booking_time can be either HH:MM or
  // HH:MM:SS; both work for Date.parse when prefixed with "T".
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
