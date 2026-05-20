"use client";

import React from "react";
import { BarChart3 } from "lucide-react";

/**
 * Empty state for the AI Sales Agent Impact section.
 *
 * Rendered when the backend returns `belowThreshold === true` (sampleN <
 * MIN_SAMPLE_N) or on initial load before the first fetch resolves.
 * Scope-doc decision I: avoid showing noisy percentages on tiny samples.
 *
 * Single copy variant per implementation doc Phase 3.3 — kept friendly
 * and forward-looking rather than apologetic about the missing data.
 */
export interface AISalesImpactEmptyStateProps {
  className?: string;
}

export const AISalesImpactEmptyState: React.FC<AISalesImpactEmptyStateProps> = ({
  className,
}) => {
  return (
    <div
      className={`bg-[#0D0D0D] border border-[#3F3F3F] rounded-xl p-6 flex items-start gap-3 ${className ?? ""}`}
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#1a1a1a] border border-[#3F3F3F] flex items-center justify-center">
        <BarChart3 className="w-5 h-5 text-[#FFCC00]" />
      </div>
      <div>
        <p className="text-sm font-semibold text-white">Still collecting data</p>
        <p className="text-sm text-gray-400 mt-1">
          Turn the AI on for a service and check back after a few
          conversations. Your impact numbers will show up here once you have
          enough traffic to give a reliable read.
        </p>
      </div>
    </div>
  );
};
