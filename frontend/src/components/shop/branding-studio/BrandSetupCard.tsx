"use client";

// A soft, dismissible dashboard nudge for shops that skipped (or haven't done)
// the Branding Studio. Onboarding stays OPTIONAL — this just makes it easy to
// come back. Shown on the overview for operational shops whose brand kit has no
// colors yet; dismissal persists per-shop in localStorage so it never nags.

import React from "react";
import { Sparkles, Wand2, X } from "lucide-react";

export interface BrandSetupCardProps {
  onStart: () => void;
  onDismiss: () => void;
}

export const BrandSetupCard: React.FC<BrandSetupCardProps> = ({ onStart, onDismiss }) => (
  <div className="relative mb-6 rounded-xl border border-[#FFCC00]/30 bg-gradient-to-r from-[#FFCC00]/10 to-transparent p-5">
    <button
      type="button"
      onClick={onDismiss}
      aria-label="Dismiss"
      className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors"
    >
      <X className="w-4 h-4" />
    </button>
    <div className="flex items-start gap-4 pr-6">
      <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-[#FFCC00]/20 shrink-0">
        <Sparkles className="w-6 h-6 text-[#FFCC00]" />
      </span>
      <div className="flex-1 min-w-0">
        <h3 className="text-base font-semibold text-white">Set up your brand with AI</h3>
        <p className="text-sm text-gray-300 mt-1 leading-relaxed">
          Add your logo and let AI capture your colors, voice, and style — about a
          minute, and every image and campaign comes out on-brand.
        </p>
        <button
          type="button"
          onClick={onStart}
          className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-[#FFCC00] text-black rounded-lg text-sm font-medium hover:bg-[#E6B800] transition-colors"
        >
          <Wand2 className="w-4 h-4" /> Set up now
        </button>
      </div>
    </div>
  </div>
);

export default BrandSetupCard;
