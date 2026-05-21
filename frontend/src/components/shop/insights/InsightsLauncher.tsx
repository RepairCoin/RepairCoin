"use client";

import React, { useState } from "react";
import { BarChart3, Maximize2, Minimize2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { InsightsPanel } from "./InsightsPanel";

/**
 * InsightsLauncher
 *
 * Persistent chart-icon launcher in the shop dashboard's right-side
 * action cluster. Clicking opens a right-side slide-over (shadcn
 * `Sheet`) housing the multi-turn Business-Data Insights chat.
 *
 * Phase 4.2 ships this skeleton + launcher styling. Phase 4.3 wires
 * the real `InsightsPanel`. Phase 6.5 (UI enhancement pass) bumps
 * the default Sheet width to `sm:max-w-2xl` and adds an
 * expand-to-large toggle (`sm:max-w-5xl`) for data-heavy answers
 * (tables, multi-card replies).
 *
 * Shop-only — `DashboardLayout` gates this on `userRole === 'shop'`.
 * Placed AFTER `HelpAssistantLauncher` in the action cluster (Help
 * first, Insights second).
 */
export const InsightsLauncher: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Open Business-Data Insights"
          className="relative p-2.5 rounded-full bg-[#FFCC00] text-[#1e1f22] hover:bg-[#e6b800] transition-all duration-300 lg:shadow-[0_2px_8px_4px_#101010]"
        >
          <BarChart3 className="w-6 h-6" />
        </button>
      </SheetTrigger>

      {/* Width: default ~672px (sm:max-w-2xl) for normal chat. Expanded
          ~1024px (sm:max-w-5xl) for table-heavy answers — Square AI's
          analytics panel does the same thing. cn() via the shadcn
          variant deduping handles the override of the baked
          sm:max-w-sm cleanly. */}
      <SheetContent
        side="right"
        className={`bg-[#101010] border-l border-gray-800 text-white p-6 flex flex-col transition-[max-width] duration-200 ease-out ${
          isExpanded ? "sm:max-w-5xl" : "sm:max-w-2xl"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <SheetTitle className="text-white">Business Insights</SheetTitle>
            <p className="text-xs text-gray-400 mt-1">
              Ask about your shop&apos;s revenue, customers, services, and AI
              assistant impact.
            </p>
          </div>
          {/* Expand / collapse toggle. Placed BEFORE shadcn's built-in
              close `X` (which absolute-positions at right-4 top-4) so
              the two buttons don't fight for the same corner. The
              wrapper's `mr-8` reserves space for the close button. */}
          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            aria-label={isExpanded ? "Collapse panel" : "Expand panel"}
            title={isExpanded ? "Collapse panel" : "Expand panel"}
            className="mr-8 mt-0.5 p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-800 transition-colors flex-shrink-0"
          >
            {isExpanded ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>

        <InsightsPanel />
      </SheetContent>
    </Sheet>
  );
};
