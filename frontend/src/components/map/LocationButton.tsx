"use client";

import { Navigation, Loader2 } from "lucide-react";

interface LocationButtonProps {
  hasLocation: boolean;
  requesting: boolean;
  glowActive: boolean;
  onClick: () => void;
}

export function LocationButton({ hasLocation, requesting, glowActive, onClick }: LocationButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={requesting}
      className={`flex items-center gap-2 bg-[#FFCC00] text-black font-semibold px-5 py-2.5 rounded-xl
        hover:bg-[#FFD700] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
        ${glowActive ? "glow-button" : ""}`}
    >
      {requesting ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Locating...
        </>
      ) : (
        <>
          <Navigation className="w-4 h-4" />
          Use My Location
        </>
      )}
    </button>
  );
}
