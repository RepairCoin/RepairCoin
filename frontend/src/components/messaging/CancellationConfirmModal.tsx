"use client";

import { useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { appointmentsApi } from "@/services/api/appointments";
import { CancellationProposal } from "./CancellationConfirmCard";

/**
 * CancellationConfirmModal
 *
 * Renders shadcn Dialog with appointment summary, optional reason textarea,
 * and a destructive-styled Confirm button. Closing without confirming
 * abandons the action (no API call).
 *
 * Phase 4.2 of the reschedule + cancel chat work. Q4 design decision:
 * cancellation gets a modal (not inline-tap) because the action is
 * irreversible — the slot is freed and the customer would have to re-book.
 * The explicit Confirm-button friction is intentional.
 */

export interface CancellationConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposal: CancellationProposal;
  /**
   * Called after the cancel API call succeeds. Parent updates the card
   * in place to the "Cancelled" visual; Phase 5's event-bus subscriber
   * adds an AI confirmation message into the chat thread.
   */
  onCancelled: () => void;
}

export function CancellationConfirmModal({
  open,
  onOpenChange,
  proposal,
  onCancelled,
}: CancellationConfirmModalProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const timeLabel = formatTimeLabel(proposal.bookingDate, proposal.bookingTime);

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      await appointmentsApi.cancelAppointment(proposal.orderId, reason);
      // Notify parent first so its visual transitions before we close —
      // closing the modal mid-update can leave the card in a flicker.
      onCancelled();
      onOpenChange(false);
      // Reset local form state for next time.
      setReason("");
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
          // The 24h-before guard fires at the backend. If the customer
          // taps Confirm after the booking has crept into the 24h window
          // since the card was rendered, the cancel endpoint rejects 400.
          msg =
            detail ||
            "This appointment is too close to its start time to cancel here. Contact the shop directly.";
          break;
        case 401:
          msg = "Your session has expired. Please log in again.";
          break;
        case 404:
          msg = "We couldn't find this appointment. It may have already been cancelled.";
          break;
        case 500:
          msg = "Something went wrong cancelling the appointment. Try again.";
          break;
        default:
          msg = detail || ax?.message || "Couldn't cancel the appointment.";
      }
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Block close while the network call is in flight — avoids the
        // "cancelled but modal closed before parent updated" race.
        if (submitting) return;
        onOpenChange(next);
        if (!next) {
          // Closing without confirming — reset state for next open.
          setReason("");
          setErrorMessage(null);
        }
      }}
    >
      {/*
        Solid-dark background + explicit light text colors throughout.
        The previous version relied on shadcn theme tokens (bg-background,
        text-muted-foreground) which read as very low contrast against the
        dashboard's dark backdrop — title + description + summary card were
        all near-invisible. Switched to a hard-coded gray-900 surface with
        gray-100 / gray-300 / gray-400 text so the modal is readable
        regardless of the theme variables resolved at runtime.
      */}
      <DialogContent className="sm:max-w-lg bg-gray-900 border-gray-700 text-gray-100">
        <DialogHeader>
          <DialogTitle className="text-white">
            Cancel this appointment?
          </DialogTitle>
          <DialogDescription className="text-gray-300">
            The slot will be freed and you'll need to re-book if you change your mind.
          </DialogDescription>
        </DialogHeader>

        {/* Appointment summary — solid lighter surface so it pops against
            the gray-900 modal body. */}
        <div className="rounded-md border border-gray-700 bg-gray-800 px-3 py-2 space-y-0.5">
          <div className="font-semibold text-white">
            {proposal.serviceName}
          </div>
          <div className="text-sm text-gray-300">{timeLabel}</div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="cancel-reason"
            className="text-sm font-medium text-gray-100"
          >
            Reason{" "}
            <span className="text-xs text-gray-400 font-normal">
              (optional)
            </span>
          </label>
          <Textarea
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. schedule conflict, no longer needed"
            rows={3}
            maxLength={500}
            disabled={submitting}
            className="resize-none bg-gray-800 border-gray-700 text-gray-100 placeholder:text-gray-500"
          />
        </div>

        {errorMessage && (
          <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30 p-3">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">
              {errorMessage}
            </p>
          </div>
        )}

        {/* Tighter button labels — original "Cancel appointment" was wider
            than the chat-thread-embedded modal could render cleanly (button
            text truncated to "Cancel app..."). Shorter, parseable labels
            survive even constrained widths. flex-wrap on the footer covers
            any edge where the constrained parent narrows further. */}
        <DialogFooter className="flex-wrap gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="bg-gray-800 border-gray-700 text-gray-100 hover:bg-gray-700 hover:text-white"
          >
            Keep it
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={submitting}
            aria-label="Confirm cancellation"
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Cancelling…
              </>
            ) : (
              "Yes, cancel"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
