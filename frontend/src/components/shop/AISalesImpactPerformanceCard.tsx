"use client";

import React from "react";
import { AiMetricsPerformance } from "@/services/api/aiMetrics";
import { AISalesImpactMetricTile } from "./AISalesImpactMetricTile";

/**
 * AI Performance card — the operational "feature → employee" framing
 * (scope-doc Section 4 + executive sc2.png). 3 metrics, dark-themed to
 * match the surrounding AI settings panel.
 *
 * "Bookings the AI booked" is the same underlying data as the Business
 * Impact card's "Bookings your AI booked" — surfaced under both cards
 * because the framing differs (revenue outcome vs operational
 * throughput). See scope-doc Section 4.
 */
export interface AISalesImpactPerformanceCardProps {
  data: AiMetricsPerformance;
}

const formatCount = (n: number): string => Math.round(n).toLocaleString();

/** Conversion rate arrives as 0..1; render as a percentage with one decimal. */
const formatPercent = (n: number): string => `${(n * 100).toFixed(1)}%`;

const formatSeconds = (n: number): string => `${n.toFixed(1)}s`;

export const AISalesImpactPerformanceCard: React.FC<AISalesImpactPerformanceCardProps> = ({
  data,
}) => {
  return (
    <div className="bg-[#0D0D0D] border border-[#3F3F3F] rounded-xl p-5">
      <h3 className="text-sm font-semibold text-white mb-4">AI Performance</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <AISalesImpactMetricTile
          label="Chat-to-booking rate"
          value={formatPercent(data.conversionRate)}
          tooltip="Share of AI conversations that turned into a paid or completed booking, in this window."
        />
        <AISalesImpactMetricTile
          label="Average reply speed"
          value={formatSeconds(data.avgResponseTimeSeconds)}
          tooltip="Average time from a customer's message to the AI's reply, across successful AI replies in this window."
        />
        <AISalesImpactMetricTile
          label="Bookings the AI booked"
          value={formatCount(data.bookingsCreated)}
          tooltip="Same data as 'Bookings your AI booked' above — surfaced here as an operational throughput metric."
        />
      </div>
    </div>
  );
};
