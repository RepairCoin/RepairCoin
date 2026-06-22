"use client";

import React, { useState } from "react";
import { Boxes, Sparkles, Maximize2, Minimize2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { InsightsPanel } from "../insights/InsightsPanel";

/**
 * InventoryAILauncher
 *
 * Conversational inventory assistant for the shop inventory tab. Opens a
 * right-side slide-over hosting the same multi-turn AI chat used by Business
 * Insights — the backend insights agent already exposes the inventory tools
 * (inventory_summary, low_stock_items, inventory_turnover, inventory_value_trend),
 * so this surface just greets the owner with inventory-focused starter questions
 * and inventory framing. Replaces the old one-shot static analytics panel with a
 * real "ask anything about my stock" experience.
 */
const INVENTORY_STARTERS: readonly string[] = [
  "What's running low and needs reordering?",
  "Which items are my slowest movers?",
  "What are my fastest-selling items this month?",
  "How is my inventory value trending?",
] as const;

export const InventoryAILauncher: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Open Inventory Assistant"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FFCC00] text-[#1e1f22] text-sm font-semibold hover:bg-[#e6b800] transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          Ask Inventory AI
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
            <SheetTitle className="text-white flex items-center gap-2">
              <Boxes className="w-5 h-5 text-[#FFCC00]" />
              Inventory Assistant
            </SheetTitle>
            <p className="text-xs text-gray-400 mt-1">
              Ask about stock levels, reorders, turnover, and inventory value —
              answered live from your shop&apos;s data.
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

        <InsightsPanel
          starterQuestions={INVENTORY_STARTERS}
          emptyStateTitle="Ask about your inventory."
          inputPlaceholder="Ask about stock, reorders, turnover…"
        />
      </SheetContent>
    </Sheet>
  );
};
