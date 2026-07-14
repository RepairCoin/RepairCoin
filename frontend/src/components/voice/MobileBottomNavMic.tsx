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
import { useVoiceEnabled } from "@/hooks/useVoiceEnabled";

export const MobileBottomNavMic: React.FC = () => {
  const openWithMic = useUnifiedAssistantStore((s) => s.openWithMic);
  // WS2: voice is Growth+ — hide the mobile mic below tier.
  const voiceEnabled = useVoiceEnabled();

  if (!voiceEnabled) return null;

  return (
    <button
      type="button"
      onClick={() => {
        // Unlock audio in the gesture so the deferred spoken greeting can play.
        unlockAudioPlayback();
        openWithMic();
      }}
      aria-label="Talk to your assistant"
      className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg hover:shadow-xl active:scale-95 transition-all duration-300"
    >
      {/* Solid blue→purple gradient ring that pulses via OPACITY (not blurred). */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 animate-mic-pulse"
      />
      <Mic className="w-7 h-7 relative z-10" />
    </button>
  );
};
