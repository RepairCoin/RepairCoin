"use client";

import React from "react";
import { Info } from "lucide-react";
import Tooltip from "@/components/ui/tooltip";

/**
 * Single metric tile used by both the Business Impact and AI Performance
 * cards. Dark theme to match `AISalesAgentSettings.tsx`. Each tile has:
 *
 *   - small uppercase label
 *   - formatted value (big number)
 *   - optional subtitle (e.g., "Estimated · vs your 4h baseline")
 *   - hover tooltip (Info icon) explaining how the metric is calculated
 *
 * The value is pre-formatted by the parent card — keeps formatting
 * choices (USD, hours, percent) co-located with the metric they describe.
 */
export interface AISalesImpactMetricTileProps {
  label: string;
  value: string;
  tooltip: string;
  /** Optional small line under the value (e.g., baseline disclosure). */
  subtitle?: string;
}

export const AISalesImpactMetricTile: React.FC<AISalesImpactMetricTileProps> = ({
  label,
  value,
  tooltip,
  subtitle,
}) => (
  <div className="bg-[#1a1a1a] border border-[#3F3F3F] rounded-lg p-4">
    <div className="flex items-center justify-between gap-2 mb-1">
      <p className="text-[11px] font-medium uppercase tracking-wider text-gray-500">
        {label}
      </p>
      <Tooltip
        content={<p className="text-xs text-gray-300 leading-relaxed">{tooltip}</p>}
        position="top"
        width="w-64"
        showIcon={true}
        icon={<Info className="w-3.5 h-3.5 text-gray-500 hover:text-gray-300 transition-colors" />}
        triggerClassName="!p-0.5 !bg-transparent hover:!bg-transparent"
      />
    </div>
    <p className="text-2xl font-semibold text-white tabular-nums">{value}</p>
    {subtitle && (
      <p className="text-[11px] text-gray-500 mt-1">{subtitle}</p>
    )}
  </div>
);
