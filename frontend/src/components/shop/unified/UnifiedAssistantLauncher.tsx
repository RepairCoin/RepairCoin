"use client";

import React, { useEffect, useState } from "react";
import { Sparkles, Maximize2, Minimize2, Pencil, Check, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { UnifiedAssistantPanel } from "./UnifiedAssistantPanel";
import {
  getShopAiSettings,
  updateAssistantName,
} from "@/services/api/aiSettings";
import { useUnifiedAssistantStore } from "@/stores/unifiedAssistantStore";

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
  // Open state lives in the shared store so the global voice triggers
  // (HeaderVoiceMic / MobileBottomNavMic) can open this same panel.
  const open = useUnifiedAssistantStore((s) => s.isOpen);
  const setOpen = useUnifiedAssistantStore((s) => s.setOpen);
  // `undefined` = not loaded yet (show a skeleton, NOT the "Assistant" default,
  // to avoid the name flashing "Assistant" → saved name on first open/refresh).
  // `null` = loaded, no name set. string = the name.
  const [assistantName, setAssistantName] = useState<string | null | undefined>(
    undefined
  );
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  // Branding (Phase 6): PREFETCH the name on mount (dashboard load), NOT on
  // open — so it's already resolved by the time the owner opens the panel.
  // This removes the blank/skeleton → name transition in the common case (open
  // happens seconds after mount). The skeleton below is only a fallback for the
  // rare case of opening within the sub-second before this resolves.
  useEffect(() => {
    let active = true;
    getShopAiSettings()
      .then((s) => {
        if (active) setAssistantName(s.assistantName ?? null);
      })
      .catch(() => {
        if (active) setAssistantName(null); // error → fall back to "Assistant"
      });
    return () => {
      active = false;
    };
  }, []);

  const loadingName = assistantName === undefined;
  const displayName = assistantName?.trim() || "Assistant";

  const saveName = async () => {
    const next = draft.trim();
    try {
      const s = await updateAssistantName(next.length ? next : null);
      setAssistantName(s.assistantName ?? null);
    } catch {
      /* keep the previous name on failure */
    }
    setEditing(false);
  };

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
            {/* SheetTitle is always rendered (Radix a11y requirement); the
                rename input appears below it when editing. */}
            <div className="flex items-center gap-2">
              {loadingName ? (
                // Skeleton while the name loads — avoids the "Assistant" → name
                // flash. SheetTitle stays present (Radix a11y) via sr-only text.
                <SheetTitle className="text-white">
                  <span
                    className="inline-block h-4 w-24 rounded bg-gray-700/60 animate-pulse align-middle"
                    aria-hidden="true"
                  />
                  <span className="sr-only">Assistant</span>
                </SheetTitle>
              ) : (
                <SheetTitle className="text-white">{displayName}</SheetTitle>
              )}
              {!loadingName && !editing && (
                <button
                  type="button"
                  onClick={() => {
                    setDraft(assistantName ?? "");
                    setEditing(true);
                  }}
                  aria-label="Rename assistant"
                  title="Rename your assistant"
                  className="p-1 text-gray-500 hover:text-[#FFCC00] transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {editing && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void saveName();
                    if (e.key === "Escape") setEditing(false);
                  }}
                  maxLength={40}
                  placeholder="Name your assistant (e.g. Adam)…"
                  className="bg-[#1A1A1A] border border-gray-700 rounded px-2 py-1 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00]"
                />
                <button
                  type="button"
                  onClick={() => void saveName()}
                  aria-label="Save name"
                  className="p-1 text-emerald-400 hover:text-emerald-300"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  aria-label="Cancel rename"
                  className="p-1 text-gray-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
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

        <UnifiedAssistantPanel assistantName={assistantName ?? null} />
      </SheetContent>
    </Sheet>
  );
};
