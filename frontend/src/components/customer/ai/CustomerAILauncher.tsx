"use client";

import React, { useState } from "react";
import { Bot, Maximize2, Minimize2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { CustomerAIPanel } from "./CustomerAIPanel";

/**
 * CustomerAILauncher
 *
 * Floating launcher button for the AI Repair Assistant.
 * Opens a right-side slide-over (shadcn Sheet) housing the diagnostic chat.
 *
 * Matches the shop AI UI pattern but customer-focused:
 * - Helps diagnose device issues
 * - Analyzes damage photos
 * - Provides cost estimates
 * - Recommends services
 */
export const CustomerAILauncher: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating launcher button - bottom-right */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label="Open AI repair assistant"
            className={`fixed bottom-6 right-6 z-[9998] p-3.5 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl group ${
              open ? "opacity-0 pointer-events-none" : "opacity-100"
            }`}
          >
            <Bot className="w-6 h-6" />
            {/* Pulse animation */}
            <span className="absolute inset-0 rounded-full bg-blue-400 opacity-75 animate-ping group-hover:animate-none" />
          </button>
        </SheetTrigger>

        <SheetContent
          side="right"
          className={`bg-[#101010] border-l border-gray-800 text-white transition-[max-width] duration-200 ease-out ${
            isExpanded ? "sm:max-w-5xl" : "sm:max-w-2xl"
          }`}
        >
          <div className="h-full flex flex-col p-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 flex-shrink-0">
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-white">AI Repair Assistant</SheetTitle>
                <p className="text-xs text-gray-400 mt-1">
                  Describe your device issue, upload photos, and get instant cost estimates
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

            {/* Chat Panel - takes remaining space */}
            <div className="flex-1 min-h-0">
              <CustomerAIPanel />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
