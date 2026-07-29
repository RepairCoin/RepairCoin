"use client";

import React, { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { getCustomerOrders, canReviewOrder } from "@/services/api/services";

interface ReviewNudgeCardProps {
  /** Navigate to the bookings/orders tab where the review buttons live. */
  onReview: () => void;
}

/**
 * Post-completion review nudge. The review flow already exists in the orders tab, but
 * it relies on the customer remembering to go there — this surfaces a prompt on the
 * overview when they have completed bookings still awaiting a review, feeding the
 * shop-facing reviews that drive marketplace trust. Renders nothing when there's
 * nothing to review.
 */
export const ReviewNudgeCard: React.FC<ReviewNudgeCardProps> = ({ onReview }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await getCustomerOrders({ status: "completed", page: 1, limit: 20 });
        const completed = res?.data ?? [];
        if (completed.length === 0) return;
        // Only those still eligible to review (not already reviewed).
        const eligibility = await Promise.all(
          completed.map((o) =>
            canReviewOrder(o.orderId)
              .then((r) => r.canReview === true)
              .catch(() => false)
          )
        );
        if (active) setCount(eligibility.filter(Boolean).length);
      } catch {
        /* non-blocking — nudge just stays hidden */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (count === 0) return null;

  return (
    <div className="rounded-2xl border border-[#FFCC00]/30 bg-[#FFCC00]/[0.06] p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFCC00]/15">
          <Star className="h-5 w-5 text-[#FFCC00]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">
            {count === 1
              ? "You have a booking to review"
              : `You have ${count} bookings to review`}
          </p>
          <p className="text-xs text-gray-400">
            Share your experience — it helps other customers and the shops you love.
          </p>
        </div>
        <button
          type="button"
          onClick={onReview}
          className="shrink-0 rounded-lg bg-[#FFCC00] px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-[#FFD700]"
        >
          Review
        </button>
      </div>
    </div>
  );
};

export default ReviewNudgeCard;
