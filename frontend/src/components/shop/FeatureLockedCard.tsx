"use client";

import React from "react";
import { Lock } from "lucide-react";
import { TIER_LABELS, getRequiredTier } from "@/config/featureTiers";

interface FeatureLockedCardProps {
  /** The gated feature key (e.g. "aiInsights", "aiMemory"). Drives the plan label. */
  feature: string;
  /** Optional heading override — defaults to "Available on the {Plan} plan". */
  title?: string;
  /** Optional supporting line — defaults to a generic upgrade nudge. */
  description?: string;
  className?: string;
}

// Compact, inline upgrade prompt for a tier-locked feature. Same visual language
// as <TierGate>'s overlay, but a self-contained card that sits inside a panel /
// settings section (no absolute overlay, no fixed min-height). Use it wherever a
// gated AI surface would otherwise 403 for a below-tier shop.
export const FeatureLockedCard: React.FC<FeatureLockedCardProps> = ({
  feature,
  title,
  description,
  className = "",
}) => {
  // Full navigation (not router.push): this card can render INSIDE a Sheet
  // overlay (e.g. the Insights launcher), where a client-side route change would
  // switch the tab underneath while the Sheet stays open on top. A hard nav
  // tears the overlay down and lands on the plans/upgrade surface.
  const goToPlans = () => {
    window.location.href = "/shop?tab=plans";
  };
  const requiredTier = getRequiredTier(feature);
  const planLabel = requiredTier ? TIER_LABELS[requiredTier] : "a higher";

  return (
    <div
      className={`rounded-xl border border-[#303236] bg-[#161616] p-6 text-center ${className}`}
    >
      <div className="w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center bg-[#FFCC00]/20">
        <Lock className="w-6 h-6 text-[#FFCC00]" />
      </div>
      <h3 className="text-base font-bold text-[#FFCC00]">
        {title ?? `Available on the ${planLabel} plan`}
      </h3>
      <p className="text-sm text-gray-300 mt-2 max-w-sm mx-auto">
        {description ??
          "This feature isn’t included in your current plan. Upgrade to unlock it."}
      </p>
      <button
        onClick={goToPlans}
        className="mt-4 px-5 py-2.5 rounded-lg font-medium text-sm bg-[#FFCC00] hover:bg-[#E6B800] text-black transition-colors"
      >
        Upgrade plan
      </button>
    </div>
  );
};

export default FeatureLockedCard;
