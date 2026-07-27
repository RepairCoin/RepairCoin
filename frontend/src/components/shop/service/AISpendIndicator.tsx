"use client";

import { useEffect, useState } from "react";
import { DollarSign, AlertTriangle } from "lucide-react";
import { getAiSpend, AISpendSnapshot } from "@/services/api/services";

/**
 * AISpendIndicator
 *
 * Phase 3 Task 12 — shows the shop their current AI spend vs. their monthly
 * budget. Mirrors what the orchestrator's SpendCapEnforcer reads internally
 * so the shop can see the same number that gates AI replies.
 *
 * Color states:
 *   - default (< 70%): green-tinted, "you're fine" vibe
 *   - warning (70-99%): amber, "you're approaching the cap"
 *   - danger (>= 100%): red, "AI is currently throttled or off"
 *
 * Self-fetches on mount. Errors render an inline note instead of a stack
 * trace; this is a side panel widget, not a critical-path UI.
 */

const CHEAPER_MODEL_THRESHOLD = 0.7;

export function AISpendIndicator() {
  const [snapshot, setSnapshot] = useState<AISpendSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAiSpend()
      .then((s) => {
        if (cancelled) return;
        if (s) setSnapshot(s);
        else setErrored(true);
      })
      .catch(() => {
        if (!cancelled) setErrored(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400 italic">
        <DollarSign className="w-3 h-3" aria-hidden="true" />
        <span>Loading AI spend…</span>
      </div>
    );
  }

  if (errored || !snapshot) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <DollarSign className="w-3 h-3" aria-hidden="true" />
        <span>AI spend unavailable</span>
      </div>
    );
  }

  const percent = snapshot.percentUsed;
  const overCap = percent >= 1;
  const warning = !overCap && percent >= CHEAPER_MODEL_THRESHOLD;

  const colorClass = overCap
    ? "text-red-300 bg-red-500/10 border-red-500/30"
    : warning
      ? "text-amber-300 bg-amber-500/10 border-amber-500/30"
      : "text-green-300 bg-green-500/10 border-green-500/30";

  const Icon = overCap || warning ? AlertTriangle : DollarSign;
  const percentDisplay = (percent * 100).toFixed(percent < 0.01 ? 2 : 1);

  return (
    <div
      className={`inline-flex items-center gap-2 text-xs font-medium rounded-md border px-2 py-1 ${colorClass}`}
      title={
        overCap
          ? "Monthly AI budget exceeded. AI replies are paused until the next monthly rollover."
          : warning
            ? "Approaching monthly AI budget. AI is now using a cheaper model for new replies."
            : `${snapshot.callsThisMonth} AI calls this month, $${snapshot.currentMonthSpendUsd.toFixed(2)} spent of $${snapshot.monthlyBudgetUsd.toFixed(2)} budget.`
      }
    >
      <Icon className="w-3 h-3" aria-hidden="true" />
      <span>
        AI spend: ${snapshot.currentMonthSpendUsd.toFixed(2)} / ${snapshot.monthlyBudgetUsd.toFixed(2)}
        <span className="text-[10px] text-gray-500 ml-1">({percentDisplay}%)</span>
      </span>
    </div>
  );
}
