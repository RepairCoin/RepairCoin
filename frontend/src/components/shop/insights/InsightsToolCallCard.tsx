"use client";

import React, { useState } from "react";
import { Maximize2, Pin, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { InsightsToolCall, ToolDisplay } from "@/services/api/aiInsights";

/**
 * InsightsToolCallCard
 *
 * Renders one tool result as a compact data card directly under the
 * assistant's prose bubble. Branches on `toolCall.display.kind`:
 *
 *   - number    → large yellow figure + label + optional sub-text
 *   - table     → dark table with header row + zebra striping
 *   - list      → label/value rows
 *   - sparkline → mini hand-rolled SVG line chart (no chart-lib dep)
 *
 * If `display` is absent (tool errored — unknown tool name or args
 * validation failure), render nothing. Claude's prose surfaces the
 * failure on its own.
 *
 * Phase 6.5 UI pass:
 *   - **Expand button** in each card header → opens a Dialog with a
 *     larger, more readable rendering of the same data. Replaces the
 *     earlier Copy-to-clipboard action — Square AI's "expand" pattern
 *     is more useful for tables that don't fit comfortably in the
 *     compact card.
 *   - Compact card: text-sm tables w/ zebra striping; text-3xl for
 *     `number` headlines; bigger sparkline (240×40).
 *   - Expanded dialog: text-base tables, wider columns, text-5xl
 *     headline numbers, 600×140 sparkline.
 *
 * Theming: dark card (`bg-[#0f0f0f]` + `border-gray-800`) matching
 * panel bubbles; yellow `#FFCC00` reserved for the single most-
 * important value.
 */
export const InsightsToolCallCard: React.FC<{
  toolCall: InsightsToolCall;
  /**
   * Phase 6.3 — called when the user taps a chip in a
   * `follow_ups`-kind display. Receives the chip text; the panel
   * uses it as the next user message. Other display kinds ignore.
   */
  onFollowupClick?: (question: string) => void;
  /**
   * Phase 7.3 — the user's question that produced this card. Used
   * by the Pin button to save the question via POST
   * /api/ai/insights/pinned. Absent on cards that aren't tied to a
   * specific user-question turn (shouldn't happen in practice but
   * makes the prop optional so legacy callers still compile).
   */
  originatingQuestion?: string;
  /**
   * Phase 7.3 — invoked when the user taps the Pin button.
   * Receives the question text + a `done` callback to call after
   * the pin completes (network round-trip happens in the panel).
   * Undefined while loading or for `follow_ups` rendering.
   */
  onPin?: (questionText: string) => Promise<void>;
}> = ({ toolCall, onFollowupClick, originatingQuestion, onPin }) => {
  if (!toolCall.display) return null;
  const display = toolCall.display;

  // `follow_ups` chips are an exploration affordance, not a data card
  // — no tool-name header, no expand-to-modal button, no card chrome.
  // Render the chip row directly so it visually reads as part of the
  // assistant's reply, not a separate result.
  if (display.kind === "follow_ups") {
    return (
      <FollowUpsRow display={display} onFollowupClick={onFollowupClick} />
    );
  }

  const title = humanizeToolName(toolCall.tool);
  return (
    <div className="rounded-lg bg-[#0f0f0f] border border-gray-800 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-wide text-gray-500">
          {title}
        </p>
        <div className="flex items-center gap-2">
          {originatingQuestion && onPin && (
            <PinButton question={originatingQuestion} onPin={onPin} />
          )}
          <ExpandButton title={title} display={display} />
        </div>
      </div>
      <DisplayBody display={display} />
    </div>
  );
};

// ---------- follow_ups chip row ----------

const FollowUpsRow: React.FC<{
  display: Extract<ToolDisplay, { kind: "follow_ups" }>;
  onFollowupClick?: (question: string) => void;
}> = ({ display, onFollowupClick }) => {
  if (display.items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {display.items.map((q, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onFollowupClick?.(q)}
          disabled={!onFollowupClick}
          className="text-[11px] text-gray-300 bg-[#1A1A1A] border border-gray-700 hover:border-[#FFCC00] hover:text-white rounded-full px-3 py-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {q}
        </button>
      ))}
    </div>
  );
};

// ---------- expand-to-dialog ----------

// ---------- Phase 7.3 — Pin button ----------

/**
 * Tap to save the user's question to `ai_insights_pinned_queries`.
 * Optimistic state: shows ✓ briefly after the pin lands. Disabled
 * while in-flight. Errors set a brief red state then revert.
 */
const PinButton: React.FC<{
  question: string;
  onPin: (questionText: string) => Promise<void>;
}> = ({ question, onPin }) => {
  const [state, setState] = useState<"idle" | "pinning" | "pinned" | "error">(
    "idle"
  );
  const handleClick = async () => {
    if (state === "pinning" || state === "pinned") return;
    setState("pinning");
    try {
      await onPin(question);
      setState("pinned");
      setTimeout(() => setState("idle"), 1500);
    } catch {
      // Silent fail — pin caps + dup-handling are server-side, but a
      // 5xx or network drop shouldn't crash the card. Brief red
      // indicator + revert.
      setState("error");
      setTimeout(() => setState("idle"), 2000);
    }
  };
  const tone =
    state === "pinned"
      ? "text-green-400"
      : state === "error"
        ? "text-red-400"
        : "text-gray-500 hover:text-[#FFCC00]";
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={state !== "idle"}
      title={
        state === "pinned"
          ? "Pinned"
          : state === "error"
            ? "Couldn't pin — try again"
            : "Pin this question to your saved list"
      }
      aria-label="Pin this question"
      className={`flex items-center gap-1 text-[10px] transition-colors disabled:cursor-default ${tone}`}
    >
      {state === "pinned" ? (
        <Check className="w-3 h-3" />
      ) : (
        <Pin className="w-3 h-3" />
      )}
      <span>
        {state === "pinned" ? "Pinned" : state === "pinning" ? "Pinning…" : "Pin"}
      </span>
    </button>
  );
};

const ExpandButton: React.FC<{ title: string; display: ToolDisplay }> = ({
  title,
  display,
}) => (
  <Dialog>
    <DialogTrigger asChild>
      <button
        type="button"
        title="Expand for a larger view"
        aria-label="Expand for a larger view"
        className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-[#FFCC00] transition-colors"
      >
        <Maximize2 className="w-3 h-3" />
        <span>Expand</span>
      </button>
    </DialogTrigger>
    {/* Wide dark dialog — overrides shadcn's bg-background + max-w-lg
        defaults. cn() in DialogContent merges these via tailwind-merge
        so our overrides win cleanly. */}
    <DialogContent className="!max-w-5xl bg-[#0f0f0f] border-gray-800 text-white">
      <DialogTitle className="text-white text-base font-semibold">
        {title}
      </DialogTitle>
      <div className="mt-2 max-h-[70vh] overflow-y-auto pr-1">
        <ExpandedDisplayBody display={display} />
      </div>
    </DialogContent>
  </Dialog>
);

// ---------- per-variant: compact (in-panel) ----------

const DisplayBody: React.FC<{ display: ToolDisplay }> = ({ display }) => {
  switch (display.kind) {
    case "number":
      return <NumberDisplay d={display} />;
    case "table":
      return <TableDisplay d={display} />;
    case "list":
      return <ListDisplay d={display} />;
    case "sparkline":
      return <SparklineDisplay d={display} />;
    case "comparison":
      return <ComparisonDisplay d={display} />;
    case "follow_ups":
      // Handled before DisplayBody in InsightsToolCallCard — render
      // nothing if we somehow get here (e.g. inside the Expand dialog,
      // where chips don't belong).
      return null;
  }
};

const NumberDisplay: React.FC<{
  d: Extract<ToolDisplay, { kind: "number" }>;
}> = ({ d }) => (
  <div>
    {d.label && (
      <p className="text-[11px] text-gray-400 mb-0.5">{d.label}</p>
    )}
    <p className="text-3xl font-semibold text-[#FFCC00] tabular-nums leading-tight">
      {d.primary}
    </p>
    {d.sub && <p className="text-xs text-gray-500 mt-1">{d.sub}</p>}
  </div>
);

const TableDisplay: React.FC<{
  d: Extract<ToolDisplay, { kind: "table" }>;
}> = ({ d }) => (
  <div className="overflow-x-auto -mx-1">
    <table className="w-full text-sm text-gray-200">
      <thead>
        <tr className="border-b border-gray-700">
          {d.columns.map((col, i) => (
            <th
              key={i}
              className="text-left font-medium text-gray-400 py-2 px-2 first:pl-1 last:pr-1 text-xs uppercase tracking-wide"
            >
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {d.rows.map((row, ri) => (
          <tr
            key={ri}
            className="border-b border-gray-900 last:border-b-0 even:bg-[#161616]"
          >
            {row.map((cell, ci) => (
              <td
                key={ci}
                className={`py-2 px-2 first:pl-1 last:pr-1 tabular-nums ${
                  ci === 0 ? "text-gray-500 w-8" : ""
                }`}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const ListDisplay: React.FC<{
  d: Extract<ToolDisplay, { kind: "list" }>;
}> = ({ d }) => (
  <dl className="space-y-1.5">
    {d.items.map((item, i) => (
      <div
        key={i}
        className="flex items-baseline justify-between gap-3 text-sm py-0.5"
      >
        <dt className="text-gray-400 truncate">{item.label}</dt>
        <dd className="text-gray-100 tabular-nums font-medium flex-shrink-0">
          {item.value}
        </dd>
      </div>
    ))}
  </dl>
);

const SparklineDisplay: React.FC<{
  d: Extract<ToolDisplay, { kind: "sparkline" }>;
}> = ({ d }) => (
  <SparklineSvg d={d} width={240} height={40} primarySize="text-base" />
);

const ComparisonDisplay: React.FC<{
  d: Extract<ToolDisplay, { kind: "comparison" }>;
}> = ({ d }) => (
  <div>
    {d.label && (
      <p className="text-[11px] text-gray-400 mb-2">{d.label}</p>
    )}
    <div className="flex items-baseline gap-4">
      <ComparisonTile
        size="compact"
        label="Current"
        value={d.current.value}
        sublabel={d.current.sublabel}
      />
      <DeltaBadge size="compact" delta={d.delta} />
      <ComparisonTile
        size="compact"
        label="Prior"
        value={d.prior.value}
        sublabel={d.prior.sublabel}
        muted
      />
    </div>
  </div>
);

const ComparisonTile: React.FC<{
  size: "compact" | "expanded";
  label: string;
  value: string;
  sublabel?: string;
  muted?: boolean;
}> = ({ size, label, value, sublabel, muted }) => {
  const valueSize =
    size === "expanded" ? "text-3xl" : "text-xl";
  const valueColor = muted ? "text-gray-300" : "text-[#FFCC00]";
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wide text-gray-500">
        {label}
      </span>
      <span className={`${valueSize} font-semibold tabular-nums ${valueColor}`}>
        {value}
      </span>
      {sublabel && (
        <span className="text-[10px] text-gray-500 mt-0.5">{sublabel}</span>
      )}
    </div>
  );
};

const DeltaBadge: React.FC<{
  size: "compact" | "expanded";
  delta: Extract<ToolDisplay, { kind: "comparison" }>["delta"];
}> = ({ size, delta }) => {
  // sentiment → color. Tool decides whether up-is-good for this metric.
  const tone =
    delta.sentiment === "positive"
      ? "text-green-400 bg-green-900/30 border-green-700/40"
      : delta.sentiment === "negative"
        ? "text-red-400 bg-red-900/30 border-red-700/40"
        : "text-gray-400 bg-gray-800 border-gray-700";
  const arrow =
    delta.direction === "up" ? "↑" : delta.direction === "down" ? "↓" : "→";
  // magnitude → padding + font for visual prominence on big jumps.
  const sizeClass =
    size === "expanded"
      ? delta.magnitude === "large"
        ? "text-base px-3 py-1.5"
        : "text-sm px-3 py-1"
      : delta.magnitude === "large"
        ? "text-xs px-2 py-1"
        : "text-[11px] px-2 py-0.5";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border tabular-nums font-medium ${tone} ${sizeClass}`}
      title={`Direction ${delta.direction}, sentiment ${delta.sentiment}`}
    >
      <span aria-hidden="true">{arrow}</span>
      <span>{delta.value}</span>
    </span>
  );
};

// ---------- per-variant: expanded (in-dialog) ----------

const ExpandedDisplayBody: React.FC<{ display: ToolDisplay }> = ({
  display,
}) => {
  switch (display.kind) {
    case "number":
      return <ExpandedNumber d={display} />;
    case "table":
      return <ExpandedTable d={display} />;
    case "list":
      return <ExpandedList d={display} />;
    case "sparkline":
      return <ExpandedSparkline d={display} />;
    case "comparison":
      return <ExpandedComparison d={display} />;
    case "follow_ups":
      // No Expand button is rendered for follow_ups cards, so we
      // shouldn't reach this branch — but type-exhaustiveness requires
      // it. Render nothing.
      return null;
  }
};

const ExpandedNumber: React.FC<{
  d: Extract<ToolDisplay, { kind: "number" }>;
}> = ({ d }) => (
  <div className="py-6">
    {d.label && <p className="text-sm text-gray-400 mb-2">{d.label}</p>}
    <p className="text-5xl font-semibold text-[#FFCC00] tabular-nums leading-tight">
      {d.primary}
    </p>
    {d.sub && <p className="text-sm text-gray-500 mt-3">{d.sub}</p>}
  </div>
);

const ExpandedTable: React.FC<{
  d: Extract<ToolDisplay, { kind: "table" }>;
}> = ({ d }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-base text-gray-200">
      <thead>
        <tr className="border-b-2 border-gray-700">
          {d.columns.map((col, i) => (
            <th
              key={i}
              className="text-left font-semibold text-gray-300 py-3 px-3 first:pl-2 last:pr-2 text-sm uppercase tracking-wide"
            >
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {d.rows.map((row, ri) => (
          <tr
            key={ri}
            className="border-b border-gray-900 last:border-b-0 even:bg-[#161616] hover:bg-[#1a1a1a] transition-colors"
          >
            {row.map((cell, ci) => (
              <td
                key={ci}
                className={`py-3 px-3 first:pl-2 last:pr-2 tabular-nums ${
                  ci === 0 ? "text-gray-500 w-12" : ""
                }`}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
    <p className="text-[11px] text-gray-600 mt-3">
      {d.rows.length} row{d.rows.length === 1 ? "" : "s"}
    </p>
  </div>
);

const ExpandedList: React.FC<{
  d: Extract<ToolDisplay, { kind: "list" }>;
}> = ({ d }) => (
  <dl className="space-y-2 py-2">
    {d.items.map((item, i) => (
      <div
        key={i}
        className="flex items-baseline justify-between gap-6 text-base py-2 border-b border-gray-900 last:border-b-0"
      >
        <dt className="text-gray-400">{item.label}</dt>
        <dd className="text-gray-100 tabular-nums font-medium flex-shrink-0">
          {item.value}
        </dd>
      </div>
    ))}
  </dl>
);

const ExpandedSparkline: React.FC<{
  d: Extract<ToolDisplay, { kind: "sparkline" }>;
}> = ({ d }) => (
  <div className="py-2">
    <SparklineSvg d={d} width={800} height={140} primarySize="text-2xl" />
    <p className="text-[11px] text-gray-600 mt-3">
      {d.series.length} data point{d.series.length === 1 ? "" : "s"}
    </p>
  </div>
);

const ExpandedComparison: React.FC<{
  d: Extract<ToolDisplay, { kind: "comparison" }>;
}> = ({ d }) => (
  <div className="py-4">
    {d.label && <p className="text-sm text-gray-400 mb-4">{d.label}</p>}
    <div className="flex items-baseline gap-8">
      <ComparisonTile
        size="expanded"
        label="Current"
        value={d.current.value}
        sublabel={d.current.sublabel}
      />
      <DeltaBadge size="expanded" delta={d.delta} />
      <ComparisonTile
        size="expanded"
        label="Prior"
        value={d.prior.value}
        sublabel={d.prior.sublabel}
        muted
      />
    </div>
  </div>
);

// ---------- shared sparkline renderer ----------

const SparklineSvg: React.FC<{
  d: Extract<ToolDisplay, { kind: "sparkline" }>;
  width: number;
  height: number;
  primarySize: string;
}> = ({ d, width, height, primarySize }) => {
  const PAD = 2;
  const series = d.series.length > 0 ? d.series : [0];
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  const stepX = series.length > 1 ? (width - PAD * 2) / (series.length - 1) : 0;
  const points = series
    .map((v, i) => {
      const x = PAD + i * stepX;
      const y = PAD + (height - PAD * 2) * (1 - (v - min) / range);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <p className="text-xs text-gray-400">{d.label}</p>
        {d.primary && (
          <p className={`${primarySize} font-semibold text-[#FFCC00] tabular-nums`}>
            {d.primary}
          </p>
        )}
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        className="block"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <polyline
          points={points}
          fill="none"
          stroke="#FFCC00"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
};

/** snake_case → "Snake case" for the small uppercase header label. */
function humanizeToolName(name: string): string {
  return name.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}
