"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";

interface AiLimitNoticeProps {
  /** The shop's monthly AI allowance (tier-derived: $10 / $30 / $75). */
  budgetUsd?: number;
  /** How much has been spent this month. */
  spentUsd?: number;
  className?: string;
}

// WS3 soft-landing notice. Shown inside the AI chat panels once the shop has
// spent its full monthly AI allowance. The assistant keeps working (on a lighter
// model) — this is a non-blocking nudge, NOT an error. Offers the two ways to get
// full-power AI back: upgrade the plan, or add the AI Usage overage add-on. Both
// live in the Plans & Billing hub (?tab=plans), so the CTA funnels there.
export const AiLimitNotice: React.FC<AiLimitNoticeProps> = ({
  budgetUsd,
  spentUsd,
  className = "",
}) => {
  // Full navigation (not router.push): this banner renders INSIDE the assistant's
  // Sheet overlay, so a client-side route change would switch the tab underneath
  // while the Sheet stays open on top (looks like nothing happened). A hard nav
  // tears the overlay down and lands on the plans tab.
  const goToPlans = () => {
    window.location.href = "/shop?tab=plans";
  };
  const usage =
    typeof budgetUsd === "number" && typeof spentUsd === "number"
      ? `$${spentUsd.toFixed(2)} of $${budgetUsd.toFixed(0)} used`
      : null;

  return (
    <div
      className={`rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 ${className}`}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <p className="text-[13px] text-amber-200 leading-relaxed">
            You&apos;ve reached your plan&apos;s monthly AI limit
            {usage ? ` (${usage})` : ""}. Replies now run on a lighter model —
            <span className="font-medium">
              {" "}
              upgrade your plan or add AI&nbsp;Usage overage
            </span>{" "}
            to restore full-power AI.
          </p>
          <button
            type="button"
            onClick={goToPlans}
            className="mt-2 px-3 py-1.5 rounded-md text-xs font-semibold bg-[#FFCC00] text-black hover:bg-[#E6B800] transition-colors"
          >
            View plans &amp; add-ons
          </button>
        </div>
      </div>
    </div>
  );
};

export default AiLimitNotice;
