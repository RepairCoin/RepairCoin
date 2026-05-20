"use client";

import React, { useState, useEffect } from "react";
import { AlertCircle } from "lucide-react";
import {
  getAiMetrics,
  AiMetricsRange,
  AiMetricsResponse,
} from "@/services/api/aiMetrics";
import { AISalesImpactRangePicker } from "./AISalesImpactRangePicker";
import { AISalesImpactEmptyState } from "./AISalesImpactEmptyState";
import { AISalesImpactBusinessCard } from "./AISalesImpactBusinessCard";
import { AISalesImpactPerformanceCard } from "./AISalesImpactPerformanceCard";

/**
 * AI Sales Agent Impact section — mounts above the configuration cards
 * in AISalesAgentSettings.tsx (scope-doc decision B: lead with outcome,
 * then settings).
 *
 * Owns its own state (range, fetch lifecycle) — the parent just mounts
 * `<AISalesImpactSection />`. Re-fetches on range change. Backend caches
 * per (shopId, range) for 60s so picker toggling is cheap.
 *
 * State machine:
 *   - loading + no prior data       → full skeleton
 *   - error + no prior data         → error banner replaces section
 *   - belowThreshold                → empty state
 *   - data present, no error        → two cards
 *   - data present, refetch failed  → cards stay, small inline notice
 */

const DEFAULT_RANGE: AiMetricsRange = "30d";

export const AISalesImpactSection: React.FC = () => {
  const [range, setRange] = useState<AiMetricsRange>(DEFAULT_RANGE);
  const [metrics, setMetrics] = useState<AiMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError("");
        const data = await getAiMetrics(range);
        if (!cancelled) setMetrics(data);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Failed to load AI metrics"
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [range]);

  const showSkeleton = loading && !metrics && !error;
  const showFatalError = !loading && !!error && !metrics;
  const showEmpty = !!metrics && metrics.belowThreshold && !loading;
  const showCards = !!metrics && !metrics.belowThreshold;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-white">Impact</h3>
        <AISalesImpactRangePicker
          value={range}
          onChange={setRange}
          disabled={loading}
        />
      </div>

      {showSkeleton && <ImpactLoadingSkeleton />}
      {showFatalError && <ImpactErrorBanner message={error} />}
      {showEmpty && <AISalesImpactEmptyState />}
      {showCards && (
        <div className="space-y-4">
          {/* Cards stay visible on refetch failure; show a small inline
              warning above so the user knows the numbers may be stale. */}
          {error && <ImpactStaleDataNotice message={error} />}
          <AISalesImpactBusinessCard
            data={metrics!.businessImpact}
            baselineMinutes={metrics!.baselineMinutes}
          />
          <AISalesImpactPerformanceCard data={metrics!.performance} />
        </div>
      )}
    </div>
  );
};

// ----- Inline loading + error pieces (small, scoped to this section) -----

const ImpactLoadingSkeleton: React.FC = () => (
  <div className="space-y-4">
    <SkeletonCard tileCount={5} />
    <SkeletonCard tileCount={3} />
  </div>
);

const SkeletonCard: React.FC<{ tileCount: number }> = ({ tileCount }) => (
  <div className="bg-[#0D0D0D] border border-[#3F3F3F] rounded-xl p-5">
    <div className="h-4 w-32 bg-[#1a1a1a] rounded animate-pulse mb-4" />
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: tileCount }, (_, i) => (
        <div
          key={i}
          className="bg-[#1a1a1a] border border-[#3F3F3F] rounded-lg p-4"
        >
          <div className="h-3 w-24 bg-[#252525] rounded animate-pulse mb-3" />
          <div className="h-7 w-20 bg-[#252525] rounded animate-pulse" />
        </div>
      ))}
    </div>
  </div>
);

const ImpactErrorBanner: React.FC<{ message: string }> = ({ message }) => (
  <div className="bg-red-900/20 border border-red-700 rounded-xl p-4 flex items-start gap-3">
    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
    <div>
      <p className="text-sm font-semibold text-red-400">
        Couldn&apos;t load AI metrics
      </p>
      <p className="text-sm text-red-300 mt-1">{message}</p>
    </div>
  </div>
);

const ImpactStaleDataNotice: React.FC<{ message: string }> = ({ message }) => (
  <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg px-3 py-2 flex items-center gap-2">
    <AlertCircle className="w-4 h-4 text-orange-400 flex-shrink-0" />
    <p className="text-xs text-orange-300">
      Couldn&apos;t refresh metrics ({message}) — showing the last loaded
      data.
    </p>
  </div>
);
