"use client";

import React from "react";
import { Sparkles, Mic } from "lucide-react";

interface AskAICustomerCardProps {
  onAsk?: () => void;
}

export const AskAICustomerCard: React.FC<AskAICustomerCardProps> = ({ onAsk }) => {
  return (
    <div className="rounded-2xl border border-[#1f1f1f] bg-[#0a0a0a] p-5">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-[#FFCC00]" />
        <h3 className="text-sm font-semibold text-white">Ask AI Anything</h3>
      </div>
      <button
        onClick={onAsk}
        className="w-full flex items-center gap-3 rounded-xl bg-[#FFCC00] px-3 py-3 text-left transition-opacity hover:opacity-90"
      >
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-black">
          <Mic className="w-5 h-5 text-white" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-[#101010]">Need Help? Ask AI</span>
          <span className="block text-xs text-[#101010]/70 truncate">
            Get answers, recommendations, and booking support.
          </span>
        </span>
        <span className="text-[11px] font-bold tracking-wide text-[#101010]">TAP TO TALK</span>
      </button>
    </div>
  );
};

export default AskAICustomerCard;
