"use client";

import React from "react";
import { HelpCircle } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { HelpAssistantPanel } from "./HelpAssistantPanel";

/**
 * HelpAssistantLauncher
 *
 * Persistent "?" launcher in the shop dashboard's right-side action
 * cluster. Clicking opens a right-side slide-over (shadcn `Sheet`)
 * housing the multi-turn How-To Assistant chat.
 *
 * Phase 3.2 ships this skeleton:
 *   - Round yellow button matching `MessageIcon` / `CartIcon` styling.
 *   - shadcn Sheet wired with open/close state.
 *   - Empty body — Phase 3.3 replaces the placeholder with the chat UI;
 *     Phase 3.4 seeds suggested starter questions.
 *
 * Shop-only — `DashboardLayout` gates this on `userRole === 'shop'`
 * because the help corpus is shop-facing. Customers and admins don't
 * see the button.
 */
export const HelpAssistantLauncher: React.FC = () => {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Open How-To Assistant"
          className="relative p-2.5 rounded-full bg-[#FFCC00] text-[#1e1f22] hover:bg-[#e6b800] transition-all duration-300 lg:shadow-[0_2px_8px_4px_#101010]"
        >
          <HelpCircle className="w-6 h-6" />
        </button>
      </SheetTrigger>

      {/* Override shadcn defaults: dark background to match the
          dashboard, wider on desktop than the default sm:max-w-sm so
          chat bubbles have room to breathe. */}
      <SheetContent
        side="right"
        className="bg-[#101010] border-l border-gray-800 text-white sm:max-w-md p-6 flex flex-col"
      >
        <SheetTitle className="text-white">How-To Assistant</SheetTitle>
        <p className="text-xs text-gray-400 mt-1">
          Ask how to use the RepairCoin shop dashboard.
        </p>

        <HelpAssistantPanel />
      </SheetContent>
    </Sheet>
  );
};
