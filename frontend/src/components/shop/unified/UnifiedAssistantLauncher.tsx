"use client";

import React, { useState } from "react";
import { Sparkles, Maximize2, Minimize2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { UnifiedAssistantPanel } from "./UnifiedAssistantPanel";

/**
 * UnifiedAssistantLauncher (v2 — "the one door")
 *
 * Persistent launcher in the shop dashboard's right-side action cluster.
 * Opens a right-side slide-over (shadcn `Sheet`) housing the cross-domain
 * Unified Assistant — answer + recommend + draft, all in one conversation.
 *
 * Cloned from InsightsLauncher minus the voice-open effect — repointing voice
 * entry points at the orchestrator is Phase 3 (voice/TTS). Shop-only;
 * DashboardLayout gates on userRole === 'shop'. The per-domain Insights /
 * Marketing / Help launchers stay (D1) as deep-dive surfaces underneath.
 */
export const UnifiedAssistantLauncher: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Open your business assistant"
          className="relative p-2.5 rounded-full bg-[#FFCC00] text-[#1e1f22] hover:bg-[#e6b800] transition-all duration-300 lg:shadow-[0_2px_8px_4px_#101010]"
        >
          <Sparkles className="w-6 h-6" />
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
            <SheetTitle className="text-white">Assistant</SheetTitle>
            <p className="text-xs text-gray-400 mt-1">
              Ask about your business or tell me what to do — revenue,
              customers, inventory, campaigns. I&apos;ll handle the rest.
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

        <UnifiedAssistantPanel />
      </SheetContent>
    </Sheet>
  );
};
