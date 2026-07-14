// frontend/src/components/voice/VoiceCommandPill.tsx
//
// The "Ask AI Anything" pill — a voice entry into the Unified Assistant.
//
// Styled as a dark pill with a purple neon glowing border + a purple mic orb,
// matching the "voice = purple" language used across the assistant. Tapping it
// opens the Unified Assistant Sheet and starts tap-to-talk recording (recorder
// + TTS live in the unified panel; this is just the entry point).
//
// Two layouts via `floating`:
//   - inline (default) — full-width within the page flow (dashboard overview)
//   - floating — fixed at the bottom-center of the viewport (desktop), e.g. on
//     the profile page. Hidden on mobile, where the bottom-nav mic covers it.

"use client";

import React, { useEffect, useState } from "react";
import { Mic, Sparkles } from "lucide-react";
import { useUnifiedAssistantStore } from "@/stores/unifiedAssistantStore";
import { unlockAudioPlayback } from "@/lib/audioUnlock";
import { useVoiceEnabled } from "@/hooks/useVoiceEnabled";

const EXAMPLE_PROMPTS = [
  "How did we do this month?",
  "Win back the customers who've gone quiet",
  "What's running low in inventory?",
  "How do I export my customer list?",
  "Show me revenue this week",
];

// WS2: on Starter the assistant is help + chat only, so show examples it can
// actually answer (the data/marketing ones above would just get declined).
const HELP_EXAMPLE_PROMPTS = [
  "How do I create a service?",
  "Where do I set my appointment hours?",
  "How do I issue a reward?",
  "How do I export my customer list?",
];

interface VoiceCommandPillProps {
  /** Float fixed at the bottom-center of the viewport (desktop). Default is
   *  inline, full-width within the page flow. */
  floating?: boolean;
  /** When floating: the dashboard sidebar's collapsed state, so the pill can
   *  center within the CONTENT area (right of the sidebar) rather than the
   *  whole viewport. Sidebar is 256px expanded / 80px collapsed → shift the
   *  center by half of that. */
  sidebarCollapsed?: boolean;
}

export const VoiceCommandPill: React.FC<VoiceCommandPillProps> = ({
  floating = false,
  sidebarCollapsed = false,
}) => {
  const openWithMic = useUnifiedAssistantStore((s) => s.openWithMic);
  const openAssistant = useUnifiedAssistantStore((s) => s.open);
  // WS2: voice is Growth+. On Starter the pill stays (it's the "Ask AI Anything"
  // CTA) but becomes a SPARKLE that opens the text assistant — no mic, no "talk".
  const voiceEnabled = useVoiceEnabled();
  const examples = voiceEnabled ? EXAMPLE_PROMPTS : HELP_EXAMPLE_PROMPTS;

  // Rotate the example prompt every 4s so the owner sees the breadth of what
  // they can ask. Purely cosmetic.
  const [exampleIndex, setExampleIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(
      () => setExampleIndex((i) => (i + 1) % examples.length),
      4000
    );
    return () => clearInterval(id);
  }, [examples.length]);

  const handleClick = () => {
    if (voiceEnabled) {
      // Unlock audio in the gesture so the deferred spoken greeting can play.
      unlockAudioPlayback();
      openWithMic();
    } else {
      openAssistant(); // text-only assistant
    }
  };

  return (
    <div
      // `fixed` (floating) and `relative` (inline) BOTH establish a positioning
      // context for the absolute pulse — but never apply both at once, or they
      // conflict and the floating pill falls back into normal flow at the top.
      className={`group ${
        floating
          ? `hidden lg:block fixed bottom-6 -translate-x-1/2 z-40 w-[640px] max-w-[calc(100vw-3rem)] ${
              sidebarCollapsed
                ? "left-[calc(50%+40px)]"
                : "left-[calc(50%+128px)]"
            }`
          : "relative w-full max-w-2xl mx-auto"
      }`}
    >
      {/* Radiating pulse behind the whole pill (the "oval") — same gradient as
          the orb, scales out + fades via .animate-mic-pulse. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 animate-pill-pulse"
      />
      <button
        type="button"
        onClick={handleClick}
        aria-label={
          voiceEnabled
            ? "Talk to your business assistant"
            : "Ask your business assistant"
        }
        // Blue→purple GRADIENT border (matches the orb) via the double-background
        // trick: dark fill on padding-box, gradient on border-box.
        className="relative flex w-full items-center gap-4 rounded-full px-5 py-3.5 text-left backdrop-blur border-2 border-transparent shadow-[0_10px_32px_rgba(0,0,0,0.55)] transition-shadow duration-300 hover:shadow-[0_0_28px_rgba(139,92,246,0.55),0_10px_32px_rgba(0,0,0,0.55)] [background:linear-gradient(#15121f,#15121f)_padding-box,linear-gradient(to_bottom_right,#3b82f6,#9333ea)_border-box]"
      >
        {/* Solid blue→purple orb — mic for voice tiers, ✨ for the text-only
            (Starter) assistant. */}
        <span className="relative flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
          {voiceEnabled ? (
            <Mic className="w-6 h-6" />
          ) : (
            <Sparkles className="w-6 h-6" />
          )}
        </span>

        <span className="flex-1 min-w-0">
          <span className="block text-base font-semibold text-white">
            Ask AI Anything
          </span>
          <span className="block text-sm text-purple-200/70 truncate">
            “{examples[exampleIndex]}”
          </span>
        </span>

        <span className="hidden sm:inline text-[10px] uppercase tracking-wider text-purple-300/70 font-semibold whitespace-nowrap">
          {voiceEnabled ? "Tap to talk" : "Tap to ask"}
        </span>
      </button>
    </div>
  );
};
