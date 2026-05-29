"use client";

import React, { useEffect, useState } from "react";
import { HelpCircle, Maximize2, Minimize2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { HelpAssistantPanel } from "./HelpAssistantPanel";
import { useVoiceDispatchStore } from "@/stores/voiceDispatchStore";

/**
 * HelpAssistantLauncher
 *
 * Persistent "?" launcher in the shop dashboard's right-side action
 * cluster. Clicking opens a right-side slide-over (shadcn `Sheet`)
 * housing the multi-turn How-To Assistant chat.
 *
 * Phase 6.5 UI enhancement pass (mirroring InsightsLauncher):
 *   - Default Sheet width bumped to `sm:max-w-2xl` (672px) so
 *     numbered procedure steps + UI label callouts don't wrap.
 *   - Expand toggle (`Maximize2` / `Minimize2`) flips to
 *     `sm:max-w-5xl` (~1024px) for long article-expansion views.
 *   - Toggle placed before shadcn's built-in `X` close (which
 *     absolute-positions at `right-4 top-4`) — `mr-8` reserves
 *     space so the two buttons don't fight for the same corner.
 *
 * Shop-only — `DashboardLayout` gates this on `userRole === 'shop'`
 * because the help corpus is shop-facing.
 */
export const HelpAssistantLauncher: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [open, setOpen] = useState(false);

  // Voice AI Dispatcher Phase 3 — open when router classifies a voice
  // command as "help". Panel reads + consumes the dispatch on mount.
  const pendingDomain = useVoiceDispatchStore((s) => s.pending?.domain);
  const pendingDispatchId = useVoiceDispatchStore((s) => s.pending?.dispatchId);
  useEffect(() => {
    if (pendingDomain === "help") {
      setOpen(true);
    }
  }, [pendingDomain, pendingDispatchId]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Open How-To Assistant"
          className="relative p-2.5 rounded-full bg-[#FFCC00] text-[#1e1f22] hover:bg-[#e6b800] transition-all duration-300 lg:shadow-[0_2px_8px_4px_#101010]"
        >
          <HelpCircle className="w-6 h-6" />
        </button>
      </SheetTrigger>

      <SheetContent
        side="right"
        className={`bg-[#101010] border-l border-gray-800 text-white p-6 flex flex-col transition-[max-width] duration-200 ease-out ${
          isExpanded ? "sm:max-w-5xl" : "sm:max-w-2xl"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <SheetTitle className="text-white">How-To Assistant</SheetTitle>
            <p className="text-xs text-gray-400 mt-1">
              Ask how to use the RepairCoin shop dashboard.
            </p>
          </div>
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

        <HelpAssistantPanel />
      </SheetContent>
    </Sheet>
  );
};
