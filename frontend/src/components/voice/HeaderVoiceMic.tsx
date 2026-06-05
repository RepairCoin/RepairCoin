// frontend/src/components/voice/HeaderVoiceMic.tsx
//
// Header mic — quick voice entry into the Unified Assistant.
//
// Styled as a purple neon-glow button so the "talk to your assistant" entry
// stands out from the yellow utility icons in the header cluster. Tapping it
// opens the Unified Assistant Sheet and starts tap-to-talk recording (the
// recording/transcription/reply all live in the unified panel — this is just
// the trigger). A first-visit coach-mark explains it for owners who don't know
// they can speak.

"use client";

import React, { useEffect, useState } from "react";
import { Mic, X } from "lucide-react";
import { useUnifiedAssistantStore } from "@/stores/unifiedAssistantStore";
import { unlockAudioPlayback } from "@/lib/audioUnlock";

// Once seen/used, never show the header-mic coach-mark again.
const MIC_COACH_KEY = "rc_header_mic_coach_seen";

export const HeaderVoiceMic: React.FC = () => {
  const openWithMic = useUnifiedAssistantStore((s) => s.openWithMic);
  const [showCoach, setShowCoach] = useState(false);

  // First-visit coach-mark. Set in an effect (not initial state) to avoid an
  // SSR/client hydration mismatch; storage access guarded for private mode.
  useEffect(() => {
    try {
      if (
        typeof window !== "undefined" &&
        !window.localStorage.getItem(MIC_COACH_KEY)
      ) {
        setShowCoach(true);
      }
    } catch {
      /* localStorage blocked — just skip the coach-mark */
    }
  }, []);

  const dismissCoach = () => {
    setShowCoach(false);
    try {
      window.localStorage.setItem(MIC_COACH_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="relative">
      {/* Pulsing neon halo behind the button. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-full bg-purple-500/50 blur-md animate-pulse"
      />
      <button
        type="button"
        onClick={() => {
          dismissCoach();
          // Unlock audio in the gesture so the deferred spoken greeting plays.
          unlockAudioPlayback();
          openWithMic();
        }}
        aria-label="Talk to your assistant"
        title="Talk to your assistant"
        className="relative z-10 p-2.5 rounded-full bg-gradient-to-br from-purple-500 to-violet-700 text-white ring-1 ring-purple-300/40 transition-all duration-300 shadow-[0_0_12px_2px_rgba(168,85,247,0.7),0_0_26px_8px_rgba(168,85,247,0.35)] hover:from-purple-400 hover:to-violet-600 hover:shadow-[0_0_18px_4px_rgba(168,85,247,0.95),0_0_38px_12px_rgba(168,85,247,0.5)]"
      >
        <Mic className="w-6 h-6" />
      </button>

      {/* First-visit coach-mark — appears below the mic, pointing up at it. */}
      {showCoach && (
        <div className="absolute top-full right-0 mt-3 z-50 w-max max-w-[230px]">
          <div className="relative rounded-lg bg-gradient-to-br from-purple-600 to-violet-700 px-3 py-2 text-xs font-medium leading-snug text-white shadow-[0_4px_20px_rgba(168,85,247,0.5)]">
            <button
              type="button"
              onClick={dismissCoach}
              aria-label="Dismiss tip"
              className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white ring-2 ring-[#101010] hover:bg-red-600"
            >
              <X className="h-3 w-3" />
            </button>
            🎤 Talk to your assistant — tap and just speak to ask anything.
            {/* upward pointer toward the mic */}
            <span className="absolute bottom-full right-5 h-0 w-0 border-l-[7px] border-r-[7px] border-b-[7px] border-l-transparent border-r-transparent border-b-purple-600" />
          </div>
        </div>
      )}
    </div>
  );
};
