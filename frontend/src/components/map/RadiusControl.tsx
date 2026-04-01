"use client";

import { Minus, Plus } from "lucide-react";
import { RADIUS_STEPS } from "@/utils/distance";

interface RadiusControlProps {
  radiusMiles: number;
  shopCount: number;
  onIncrease: () => void;
  onDecrease: () => void;
}

export function RadiusControl({ radiusMiles, shopCount, onIncrease, onDecrease }: RadiusControlProps) {
  return (
    <div className="absolute top-4 left-4 z-[1000] flex items-center gap-2 bg-[#1a1a1a]/95 backdrop-blur-sm rounded-xl px-3 py-2 border border-gray-700 shadow-lg">
      <div className="flex items-center gap-1.5 bg-[#2a2a2a] rounded-lg px-2.5 py-1">
        <span className="text-[#FFCC00] text-sm">🏪</span>
        <span className="text-white text-sm font-semibold">{shopCount}</span>
        <span className="text-gray-400 text-xs">within {radiusMiles} mi</span>
      </div>
      <button
        onClick={onDecrease}
        disabled={radiusMiles <= RADIUS_STEPS[0]}
        className="w-7 h-7 rounded-lg bg-[#2a2a2a] text-[#FFCC00] font-bold flex items-center justify-center
          hover:bg-[#333] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <span className="text-white text-sm font-semibold min-w-[36px] text-center">
        {radiusMiles} mi
      </span>
      <button
        onClick={onIncrease}
        disabled={radiusMiles >= RADIUS_STEPS[RADIUS_STEPS.length - 1]}
        className="w-7 h-7 rounded-lg bg-[#2a2a2a] text-[#FFCC00] font-bold flex items-center justify-center
          hover:bg-[#333] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
