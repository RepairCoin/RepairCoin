"use client";

import type { FilterOption } from "../types";

interface FilterTabsProps<T extends string> {
  /** Array of filter options */
  options: FilterOption<T>[];
  /** Currently selected value */
  value: T;
  /** Called when selection changes */
  onChange: (value: T) => void;
  /** Whether tabs are disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Reusable filter tabs / button group component
 */
export default function FilterTabs<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
  className = "",
}: FilterTabsProps<T>) {
  return (
    <div className={`flex gap-1.5 sm:gap-2 overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0 scrollbar-hide ${className}`}>
      {options.map((option) => {
        const isActive = value === option.value;
        const activeColor = option.activeColor || option.color || "bg-[#FFCC00]";
        const activeTextColor = activeColor === "bg-[#FFCC00]" ? "text-[#101010]" : "text-white";

        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            disabled={disabled}
            className={`relative flex-shrink-0 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-200 ${
              isActive
                ? `${activeColor} ${activeTextColor}`
                : "bg-[#1e1f22] text-white hover:bg-[#2a2b2f]"
            } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {option.label}
            {option.count !== undefined && ` (${option.count})`}
          </button>
        );
      })}
    </div>
  );
}
