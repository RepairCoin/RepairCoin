"use client";

import React from "react";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { AiMetricsRange } from "@/services/api/aiMetrics";

/**
 * Range pill selector for the AI Sales Agent Impact section
 * (scope-doc decision C: 7 / 30 / 90 / all, default 30d).
 *
 * Controlled component — the parent owns the active range and gets
 * notified on change. Built on shadcn `ToggleGroup` with `type="single"`.
 *
 * Radix quirk: `type="single"` fires `onValueChange("")` when the user
 * clicks the currently-active item (a "deselect" gesture). We don't
 * want an empty range — the guard below ignores that case.
 */

const RANGE_OPTIONS: ReadonlyArray<{ value: AiMetricsRange; label: string }> = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "all", label: "All" },
];

const VALID_RANGES: ReadonlySet<string> = new Set(
  RANGE_OPTIONS.map((o) => o.value)
);

export interface AISalesImpactRangePickerProps {
  value: AiMetricsRange;
  onChange: (next: AiMetricsRange) => void;
  /** Optional — disable while loading or while a parent fetch is in-flight. */
  disabled?: boolean;
  className?: string;
}

export const AISalesImpactRangePicker: React.FC<AISalesImpactRangePickerProps> = ({
  value,
  onChange,
  disabled,
  className,
}) => {
  return (
    <ToggleGroup
      type="single"
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (VALID_RANGES.has(next)) {
          onChange(next as AiMetricsRange);
        }
      }}
      aria-label="Metrics time range"
      className={`bg-[#1a1a1a] border border-[#3F3F3F] rounded-lg p-0.5 ${className ?? ""}`}
    >
      {RANGE_OPTIONS.map((opt) => (
        <ToggleGroupItem
          key={opt.value}
          value={opt.value}
          aria-label={`Show metrics for ${opt.label}`}
          className="data-[state=on]:bg-[#FFCC00] data-[state=on]:text-black text-gray-400 hover:text-white hover:bg-transparent text-xs font-medium px-3 py-1.5 rounded-md"
        >
          {opt.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
};
