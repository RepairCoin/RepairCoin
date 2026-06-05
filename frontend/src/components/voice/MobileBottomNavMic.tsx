// frontend/src/components/voice/MobileBottomNavMic.tsx
//
// Mobile floating mic — quick voice entry into the Unified Assistant.
//
// The yellow circle fixed to the bottom-center of the viewport on shop pages
// (mobile/tablet only; lg:hidden, since the header mic covers desktop).
//
// Originally (voice v1) this opened a bottom Drawer with its own recorder +
// the 4-way dispatcher. That's retired: tapping it now opens the ONE Unified
// Assistant Sheet and signals its panel to start tap-to-talk recording. The
// recorder + TTS live in the unified panel — this is just the trigger.
//
// NOTE on iOS: the panel auto-starts the recorder in a mount effect (not
// synchronously in this tap), so the very first use on iOS Safari — before mic
// permission is granted — may need a second tap on the in-panel mic. Once
// permission is granted, auto-start works.

"use client";

import React from "react";
import { Mic } from "lucide-react";
import { useUnifiedAssistantStore } from "@/stores/unifiedAssistantStore";
import { unlockAudioPlayback } from "@/lib/audioUnlock";

export const MobileBottomNavMic: React.FC = () => {
  const openWithMic = useUnifiedAssistantStore((s) => s.openWithMic);

  return (
    <button
      type="button"
      onClick={() => {
        // Unlock audio in the gesture so the deferred spoken greeting can play.
        unlockAudioPlayback();
        openWithMic();
      }}
      aria-label="Talk to your assistant"
      className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-violet-700 text-white ring-1 ring-purple-300/40 shadow-[0_0_16px_4px_rgba(168,85,247,0.55),0_8px_24px_rgba(168,85,247,0.4)] active:scale-95 transition-transform"
    >
      <Mic className="w-7 h-7" />
    </button>
  );
};
