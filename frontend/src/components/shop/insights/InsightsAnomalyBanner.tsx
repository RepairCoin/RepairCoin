"use client";

import React from "react";
import { AlertTriangle, X, ArrowRight } from "lucide-react";
import { Anomaly, AnomalyMetricKey } from "@/services/api/aiInsights";

/**
 * InsightsAnomalyBanner
 *
 * Phase 7.2.16 — top-of-panel anomaly banner. Renders up to 3 active
 * anomalies the nightly cron detected (week-over-week changes that
 * cleared a severity band on one of the 5 starter metrics). Backed by
 * `ai_insights_anomalies`; expires 14 days after detection or when the
 * shop owner dismisses.
 *
 * One row per anomaly:
 *   - severity-toned left bar (low=amber / medium=orange / high=red)
 *   - Claude's `phrasing` sentence, OR a template fallback when
 *     phrasing is null (spend-cap exhausted or Claude call failed —
 *     backend leaves the column NULL on either path so the banner can
 *     degrade gracefully without showing nothing).
 *   - "Tell me more" chip → submits `followUpQuestion` through the
 *     same chat pipeline as Phase 6.3 follow-up chips. Auto-dismisses
 *     after the tap so the banner doesn't keep nagging post-drill-in.
 *   - "Detected Xh ago" recency hint + dismiss X.
 *
 * Errors loading or dismissing are non-fatal — the panel hides the
 * banner silently. Chat + pinned tabs keep working.
 */
export const InsightsAnomalyBanner: React.FC<{
  anomalies: Anomaly[];
  onAskFollowup: (anomaly: Anomaly) => void;
  onDismiss: (id: string) => void;
}> = ({ anomalies, onAskFollowup, onDismiss }) => {
  if (anomalies.length === 0) return null;

  return (
    <div
      className="space-y-2 mb-3"
      role="region"
      aria-label="Recent anomalies in your shop's data"
    >
      {anomalies.map((a) => (
        <AnomalyRow
          key={a.id}
          anomaly={a}
          onAskFollowup={onAskFollowup}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
};

// ---------- one anomaly row ----------

const AnomalyRow: React.FC<{
  anomaly: Anomaly;
  onAskFollowup: (anomaly: Anomaly) => void;
  onDismiss: (id: string) => void;
}> = ({ anomaly, onAskFollowup, onDismiss }) => {
  const tone = SEVERITY_TONES[anomaly.severity];
  const text = anomaly.phrasing ?? templatePhrasing(anomaly);

  return (
    <div
      className={`relative rounded-lg border ${tone.border} ${tone.bg} pl-3 pr-8 py-2.5`}
    >
      {/* Left-edge severity bar — pure visual cue; the row already
          conveys severity via background tone, this just makes it
          scannable at the corner of the eye. */}
      <span
        aria-hidden="true"
        className={`absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r ${tone.bar}`}
      />

      <div className="flex items-start gap-2">
        <AlertTriangle
          className={`w-4 h-4 flex-shrink-0 mt-0.5 ${tone.icon}`}
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-100 leading-relaxed break-words">
            {text}
          </p>
          <div className="mt-1.5 flex items-center gap-3 flex-wrap">
            {anomaly.followUpQuestion && (
              <button
                type="button"
                onClick={() => onAskFollowup(anomaly)}
                className={`inline-flex items-center gap-1 text-[11px] font-medium ${tone.linkText} hover:underline`}
              >
                Tell me more
                <ArrowRight className="w-3 h-3" aria-hidden="true" />
              </button>
            )}
            <span className="text-[10px] text-gray-500">
              Detected {formatRelative(anomaly.detectedAt)}
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onDismiss(anomaly.id)}
        title="Dismiss"
        aria-label="Dismiss this anomaly"
        className="absolute top-1.5 right-1.5 p-1 rounded-md text-gray-500 hover:text-gray-200 hover:bg-black/30 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

// ---------- severity tone palette ----------

type Tone = {
  border: string;
  bg: string;
  bar: string;
  icon: string;
  linkText: string;
};

const SEVERITY_TONES: Record<Anomaly["severity"], Tone> = {
  low: {
    border: "border-amber-700/40",
    bg: "bg-amber-900/15",
    bar: "bg-amber-500/70",
    icon: "text-amber-400",
    linkText: "text-amber-300",
  },
  medium: {
    border: "border-orange-700/50",
    bg: "bg-orange-900/20",
    bar: "bg-orange-500",
    icon: "text-orange-400",
    linkText: "text-orange-300",
  },
  high: {
    border: "border-red-700/60",
    bg: "bg-red-900/25",
    bar: "bg-red-500",
    icon: "text-red-400",
    linkText: "text-red-300",
  },
};

// ---------- template fallback when phrasing is null ----------

const METRIC_LABELS: Record<AnomalyMetricKey, string> = {
  weekly_revenue: "weekly revenue",
  weekly_no_shows: "weekly no-shows",
  weekly_cancellations: "weekly cancellations",
  weekly_ai_conversations: "weekly AI conversations",
  weekly_bookings: "weekly bookings",
};

/**
 * Bare-bones template used when Claude phrasing is unavailable. Kept
 * deliberately neutral — we don't know good/bad here without the
 * server's `upIsGood` flag, and we'd rather under-claim than mislabel.
 */
function templatePhrasing(a: Anomaly): string {
  const label = METRIC_LABELS[a.metricKey] ?? a.metricKey;
  const current = formatValue(a.metricKey, a.currentValue);
  const prior = formatValue(a.metricKey, a.priorValue);
  const deltaText =
    a.deltaPct === null ? "" : ` (${formatDeltaPct(a.deltaPct)})`;
  return `Your ${label} changed from ${prior} to ${current} this week${deltaText}.`;
}

function formatValue(key: AnomalyMetricKey, value: number): string {
  if (key === "weekly_revenue") {
    return `$${value.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  }
  return Math.round(value).toLocaleString();
}

function formatDeltaPct(deltaPct: number): string {
  const sign = deltaPct > 0 ? "+" : "";
  return `${sign}${Math.round(deltaPct)}%`;
}

// ---------- relative time ----------

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "just now";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 14) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}
