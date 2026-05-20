"use client";

import React from "react";
import { AiMetricsBusinessImpact } from "@/services/api/aiMetrics";
import { AISalesImpactMetricTile } from "./AISalesImpactMetricTile";

/**
 * Business Impact card — the "Revenue you didn't have to chase" framing
 * (scope-doc Section 4 + executive sc1.png). 5 metrics, dark-themed to
 * match the surrounding AI settings panel.
 *
 * Labels are shop-owner-perspective per scope-doc decision 1 (resolved
 * by exec, see Section 6). Final copy gets a review pass before ship.
 */
export interface AISalesImpactBusinessCardProps {
  data: AiMetricsBusinessImpact;
  /** Configured human-reply baseline, used in the "Time saved" subtitle. */
  baselineMinutes: number;
}

const formatCount = (n: number): string => Math.round(n).toLocaleString();

const formatUsd = (n: number): string =>
  `$${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatHours = (n: number): string => `${n.toFixed(1)}h`;

const formatBaselineSubtitle = (baselineMinutes: number): string => {
  if (baselineMinutes % 60 === 0) {
    return `Estimated · vs your ${baselineMinutes / 60}h baseline`;
  }
  return `Estimated · vs your ${baselineMinutes}m baseline`;
};

export const AISalesImpactBusinessCard: React.FC<AISalesImpactBusinessCardProps> = ({
  data,
  baselineMinutes,
}) => {
  return (
    <div className="bg-[#0D0D0D] border border-[#3F3F3F] rounded-xl p-5">
      <h3 className="text-sm font-semibold text-white mb-4">Business Impact</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <AISalesImpactMetricTile
          label="Conversations your AI handled"
          value={formatCount(data.aiConversations)}
          tooltip="Distinct conversations where the AI replied at least once in this window."
        />
        <AISalesImpactMetricTile
          label="Bookings your AI booked"
          value={formatCount(data.bookingsGenerated)}
          tooltip="Service bookings that came from an AI conversation and are paid or completed."
        />
        <AISalesImpactMetricTile
          label="Revenue you didn't have to chase"
          value={formatUsd(data.revenueGenerated)}
          tooltip="Total USD from AI-originated bookings (status paid or completed). Refunded, cancelled, expired, and no-show orders are excluded."
        />
        <AISalesImpactMetricTile
          label="Customers your AI brought back"
          value={formatCount(data.customersRecovered)}
          tooltip="Customers who received a follow-up nudge and then booked within 7 days, in the same conversation."
        />
        <AISalesImpactMetricTile
          label="Time your AI saved you"
          value={formatHours(data.responseTimeSavedHours)}
          subtitle={formatBaselineSubtitle(baselineMinutes)}
          tooltip="An estimate: (your configured human-reply baseline minus the AI's average reply time) multiplied by the number of AI-handled conversations. Edit your baseline in the Behavior settings below."
        />
      </div>
    </div>
  );
};
