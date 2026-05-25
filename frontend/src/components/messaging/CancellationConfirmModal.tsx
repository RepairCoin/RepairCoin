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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel this appointment?</DialogTitle>
          <DialogDescription className="space-y-1 pt-2">
            <span className="block font-medium text-foreground">
              {proposal.serviceName}
            </span>
            <span className="block text-sm">{timeLabel}</span>
            <span className="block text-xs pt-2">
              The slot will be freed and you'll need to re-book if you change your mind.
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label
            htmlFor="cancel-reason"
            className="text-sm font-medium text-foreground"
          >
            Reason{" "}
            <span className="text-xs text-muted-foreground font-normal">
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
            className="resize-none"
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

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Keep appointment
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={submitting}
            aria-label="Confirm cancellation"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Cancelling…
              </>
            ) : (
              "Cancel appointment"
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
