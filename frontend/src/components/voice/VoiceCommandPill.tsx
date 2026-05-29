// frontend/src/components/voice/VoiceCommandPill.tsx
//
// Voice AI Dispatcher — the headline mic affordance.
//
// Matches the design in c:/dev/voice.jpeg: a rounded yellow pill
// centered on the shop dashboard home, with a mic icon and a rotating
// example placeholder. Tap → records → shows transcript → user taps
// Send → backend router (Haiku) classifies → matching panel opens
// with the transcript pre-filled and the conversation already in
// flight.
//
// State rendering:
//   idle                  → Pill with "Ask AI Anything" + mic icon
//   requesting_permission → "Allow mic to continue…"
//   listening             → Pulsing red dot + "Listening… Tap to stop"
//   transcribing          → Spinner + "Transcribing…"
//   transcribed           → Editable transcript + Send button
//   dispatching           → Spinner + "Routing your question…"
//   out_of_scope          → Templated decline + Dismiss button
//   error                 → Error message + Try Again button

"use client";

import React, { useMemo, useState } from "react";
import { Mic, Square, Loader2, Send, X } from "lucide-react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { dispatchTranscript } from "@/services/api/voice";
import { useVoiceDispatchStore } from "@/stores/voiceDispatchStore";

const DOMAIN_LABEL: Record<string, string> = {
  insights: "Insights",
  marketing: "Marketing",
  help: "Help",
};

const OUT_OF_SCOPE_COPY =
  "I can't help with that yet — try opening the Insights, Marketing, or Help panel directly.";

const EXAMPLE_PROMPTS = [
  "Create a campaign for slow days",
  "Who are my top customers this month?",
  "How do I export my customer list?",
  "What's running low in inventory?",
  "Show me revenue this week",
];

export const VoiceCommandPill: React.FC = () => {
  // One session id per pill-mount — survives multiple multi-turn recordings.
  const sessionId = useMemo(
    () =>
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `voice-${Date.now()}-${Math.random().toString(36).slice(2)}`),
    []
  );

  const recorder = useVoiceRecorder({ sessionId, language: "en" });
  const dispatch = useVoiceDispatchStore((s) => s.dispatch);

  // Dispatch sub-state (after Send, before the router responds).
  // Lives alongside recorder.state — the pill renders these separately
  // so a long Haiku call doesn't get visually conflated with STT.
  const [dispatching, setDispatching] = useState(false);
  const [outOfScope, setOutOfScope] = useState(false);

  // Rotate the placeholder text every 4s while idle so the user sees
  // multiple example prompts. Frozen during any active state.
  const [exampleIndex, setExampleIndex] = useState(0);
  React.useEffect(() => {
    if (recorder.state !== "idle") return;
    const id = setInterval(
      () => setExampleIndex((i) => (i + 1) % EXAMPLE_PROMPTS.length),
      4000
    );
    return () => clearInterval(id);
  }, [recorder.state]);

  const handlePrimary = () => {
    if (recorder.state === "idle" || recorder.state === "error") {
      void recorder.start();
    } else if (recorder.state === "listening") {
      recorder.stop();
    } else if (recorder.state === "transcribed") {
      void handleSend();
    }
  };

  const handleSend = async () => {
    const text = recorder.transcript.trim();
    if (text.length === 0) return;
    setDispatching(true);
    try {
      const result = await dispatchTranscript(text, sessionId, "voice");
      if (result.domain === "out_of_scope") {
        setOutOfScope(true);
        return;
      }
      // Hand off to the matching panel via the Zustand store. The
      // launcher subscribed to the store opens its Sheet; the panel
      // seeds its input + triggers send.
      dispatch(result.domain, text);
      toast.success(`Asked ${DOMAIN_LABEL[result.domain]}`, {
        duration: 2500,
      });
      recorder.reset();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Voice routing temporarily unavailable.";
      toast.error(msg, { duration: 4000 });
    } finally {
      setDispatching(false);
    }
  };

  const handleDismissOutOfScope = () => {
    setOutOfScope(false);
    recorder.reset();
  };

  // ----- OUT_OF_SCOPE — router rejected the question -----
  if (outOfScope) {
    return (
      <div className="w-full max-w-2xl mx-auto bg-[#1e1f22] rounded-3xl p-5 shadow-lg border border-gray-800">
        <p className="text-sm text-gray-300 mb-3">{OUT_OF_SCOPE_COPY}</p>
        <div className="flex justify-end">
          <Button
            onClick={handleDismissOutOfScope}
            className="bg-[#FFCC00] text-[#1e1f22] hover:bg-[#e6b800] font-semibold"
          >
            Got it
          </Button>
        </div>
      </div>
    );
  }

  // ----- DISPATCHING — Haiku router is classifying -----
  if (dispatching) {
    return (
      <div className="w-full max-w-2xl mx-auto px-6 py-5 rounded-full bg-[#1e1f22] text-white text-center shadow-lg">
        <span className="inline-flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-[#FFCC00]" />
          <span className="text-sm">Routing your question…</span>
        </span>
      </div>
    );
  }

  // ----- IDLE — the headline pill -----
  if (recorder.state === "idle") {
    return (
      <button
        type="button"
        onClick={handlePrimary}
        className="group w-full max-w-2xl mx-auto flex items-center gap-4 px-6 py-5 rounded-full bg-gradient-to-r from-[#FFCC00] to-[#FFD633] hover:brightness-105 text-[#1e1f22] shadow-[0_4px_24px_rgba(255,204,0,0.25)] transition-all duration-300"
        aria-label="Ask AI by voice"
      >
        <span className="flex-shrink-0 w-12 h-12 rounded-full bg-[#1e1f22] text-[#FFCC00] flex items-center justify-center group-hover:scale-105 transition-transform">
          <Mic className="w-6 h-6" />
        </span>
        <span className="flex-1 text-left min-w-0">
          <span className="block text-base font-semibold">Ask AI Anything</span>
          <span className="block text-sm text-[#1e1f22]/70 truncate">
            “{EXAMPLE_PROMPTS[exampleIndex]}”
          </span>
        </span>
        <span className="hidden sm:inline text-xs uppercase tracking-wider text-[#1e1f22]/60 font-semibold">
          Tap to talk
        </span>
      </button>
    );
  }

  // ----- REQUESTING PERMISSION -----
  if (recorder.state === "requesting_permission") {
    return (
      <div className="w-full max-w-2xl mx-auto px-6 py-5 rounded-full bg-[#1e1f22] text-white text-center shadow-lg">
        <span className="inline-flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-[#FFCC00]" />
          <span className="text-sm">
            Allow microphone access in the browser prompt…
          </span>
        </span>
      </div>
    );
  }

  // ----- LISTENING — pulsing red dot, tap to stop -----
  if (recorder.state === "listening") {
    return (
      <button
        type="button"
        onClick={handlePrimary}
        className="w-full max-w-2xl mx-auto flex items-center gap-4 px-6 py-5 rounded-full bg-[#1e1f22] text-white shadow-[0_4px_24px_rgba(255,80,80,0.35)] border border-red-500/40 transition-all"
        aria-label="Stop recording"
      >
        <span className="flex-shrink-0 w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center">
          <Square className="w-5 h-5 fill-current" />
        </span>
        <span className="flex-1 text-left">
          <span className="block text-base font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Listening…
          </span>
          <span className="block text-xs text-gray-400">
            Auto-stops when you stop talking. Tap to stop now.
          </span>
        </span>
      </button>
    );
  }

  // ----- TRANSCRIBING -----
  if (recorder.state === "transcribing") {
    return (
      <div className="w-full max-w-2xl mx-auto px-6 py-5 rounded-full bg-[#1e1f22] text-white text-center shadow-lg">
        <span className="inline-flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-[#FFCC00]" />
          <span className="text-sm">Transcribing…</span>
        </span>
      </div>
    );
  }

  // ----- TRANSCRIBED — edit + send -----
  if (recorder.state === "transcribed") {
    return (
      <div className="w-full max-w-2xl mx-auto bg-[#1e1f22] rounded-3xl p-5 shadow-lg border border-gray-800">
        <div className="flex items-start justify-between gap-3 mb-3">
          <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
            Review and send
          </p>
          <button
            type="button"
            onClick={recorder.reset}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <Textarea
          value={recorder.transcript}
          onChange={(e) => recorder.setTranscript(e.target.value)}
          className="w-full bg-[#101010] border-gray-800 text-white text-base focus-visible:ring-[#FFCC00] resize-none"
          rows={3}
          autoFocus
        />
        <div className="flex justify-end gap-2 mt-3">
          <Button
            variant="ghost"
            onClick={() => void recorder.start()}
            className="text-gray-300 hover:text-white hover:bg-gray-800"
          >
            <Mic className="w-4 h-4 mr-2" />
            Re-record
          </Button>
          <Button
            onClick={handleSend}
            disabled={recorder.transcript.trim().length === 0}
            className="bg-[#FFCC00] text-[#1e1f22] hover:bg-[#e6b800] font-semibold"
          >
            <Send className="w-4 h-4 mr-2" />
            Send
          </Button>
        </div>
      </div>
    );
  }

  // ----- ERROR -----
  return (
    <div className="w-full max-w-2xl mx-auto bg-[#1e1f22] rounded-3xl p-5 shadow-lg border border-red-500/30">
      <p className="text-sm text-red-300 mb-3">
        {recorder.error || "Something went wrong."}
      </p>
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          onClick={recorder.reset}
          className="text-gray-300 hover:text-white hover:bg-gray-800"
        >
          Dismiss
        </Button>
        <Button
          onClick={() => void recorder.start()}
          className="bg-[#FFCC00] text-[#1e1f22] hover:bg-[#e6b800] font-semibold"
        >
          <Mic className="w-4 h-4 mr-2" />
          Try again
        </Button>
      </div>
    </div>
  );
};
