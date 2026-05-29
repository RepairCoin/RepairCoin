// frontend/src/components/voice/MobileBottomNavMic.tsx
//
// Voice AI Dispatcher Phase 4 — mobile bottom-nav voice entry.
//
// The yellow `+` button from c:/dev/voice.jpeg's mobile design. Fixed
// to the bottom-center of the viewport on shop pages. Tap → opens a
// vaul-backed bottom Drawer with the recording UI. Reuses
// `useVoiceRecorder` (Phase 2) + the dispatch flow (Phase 3) — only
// the trigger position + container changes vs HeaderVoiceMic.
//
// Mounted only on mobile/tablet (lg:hidden). On desktop, HeaderVoiceMic
// in the action cluster already covers the same flow.
//
// Single-tap UX: tapping the `+` button BOTH opens the drawer AND
// starts recording from the same user gesture. iOS Safari requires
// MediaRecorder.start() to be on a user gesture — chaining them on the
// onClick keeps that constraint clean.

"use client";

import React, { useMemo, useState } from "react";
import {
  Mic,
  Square,
  Loader2,
  Send,
  X,
  Plus,
} from "lucide-react";
import { toast } from "react-hot-toast";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
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

export const MobileBottomNavMic: React.FC = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [outOfScope, setOutOfScope] = useState(false);
  const dispatch = useVoiceDispatchStore((s) => s.dispatch);

  // Fresh session id per drawer-open. Mirrors HeaderVoiceMic's pattern.
  const sessionId = useMemo(
    () =>
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `voice-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drawerOpen]
  );

  const recorder = useVoiceRecorder({ sessionId, language: "en" });

  // Closing the drawer must release the mic so the browser indicator
  // clears and any in-flight upload is abandoned cleanly.
  const handleDrawerOpenChange = (next: boolean) => {
    if (!next) {
      recorder.reset();
      setDispatching(false);
      setOutOfScope(false);
    }
    setDrawerOpen(next);
  };

  // Single-gesture handler: open drawer + start recording. iOS Safari
  // requires MediaRecorder.start() to fire from a user gesture, so we
  // can't open-then-defer-start.
  const handleButtonTap = () => {
    setDrawerOpen(true);
    void recorder.start();
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
      dispatch(result.domain, text);
      toast.success(`Asked ${DOMAIN_LABEL[result.domain]}`, {
        duration: 2500,
      });
      handleDrawerOpenChange(false);
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
    handleDrawerOpenChange(false);
  };

  return (
    <>
      {/* Floating + button — fixed bottom-center, lg:hidden so desktop
          uses the HeaderVoiceMic in the action cluster instead. z-40
          stays above page content but below modal overlays (z-50). */}
      <button
        type="button"
        onClick={handleButtonTap}
        aria-label="Voice command"
        className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-[#FFCC00] text-[#1e1f22] shadow-[0_8px_24px_rgba(255,204,0,0.4)] active:scale-95 transition-transform"
      >
        <Plus className="w-7 h-7" strokeWidth={2.5} />
      </button>

      <Drawer open={drawerOpen} onOpenChange={handleDrawerOpenChange}>
        <DrawerContent className="bg-[#1e1f22] border-t border-gray-800 text-white max-h-[85vh]">
          <DrawerHeader className="flex items-start justify-between gap-3 pb-2">
            <DrawerTitle className="text-white text-base">
              Ask AI by voice
            </DrawerTitle>
            <button
              type="button"
              onClick={() => handleDrawerOpenChange(false)}
              aria-label="Close"
              className="text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </DrawerHeader>
          <div className="px-4 pb-6">{renderBody()}</div>
        </DrawerContent>
      </Drawer>
    </>
  );

  function renderBody() {
    if (outOfScope) {
      return (
        <div className="space-y-4 py-2">
          <p className="text-sm text-gray-300">{OUT_OF_SCOPE_COPY}</p>
          <Button
            onClick={handleDismissOutOfScope}
            className="w-full bg-[#FFCC00] text-[#1e1f22] hover:bg-[#e6b800] font-semibold"
          >
            Got it
          </Button>
        </div>
      );
    }

    if (dispatching) {
      return (
        <div className="flex items-center gap-3 py-6 justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-[#FFCC00]" />
          <p className="text-sm text-gray-300">Routing your question…</p>
        </div>
      );
    }

    if (recorder.state === "requesting_permission") {
      return (
        <div className="flex items-center gap-3 py-6 justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-[#FFCC00]" />
          <p className="text-sm text-gray-300">
            Allow microphone access…
          </p>
        </div>
      );
    }

    if (recorder.state === "listening") {
      return (
        <div className="space-y-4 py-4">
          <div className="flex flex-col items-center gap-3">
            <div className="relative w-24 h-24 rounded-full bg-red-500/20 border-2 border-red-500/60 flex items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-red-500/40 animate-ping" />
              <Mic className="w-10 h-10 text-red-400" />
            </div>
            <p className="text-base font-semibold">Listening…</p>
            <p className="text-xs text-gray-400 text-center">
              Auto-stops when you stop talking. Tap below to stop now.
            </p>
          </div>
          <Button
            onClick={recorder.stop}
            variant="outline"
            className="w-full bg-transparent border-gray-700 text-white hover:bg-gray-800"
          >
            <Square className="w-4 h-4 mr-2 fill-current" />
            Stop
          </Button>
        </div>
      );
    }

    if (recorder.state === "transcribing") {
      return (
        <div className="flex items-center gap-3 py-6 justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-[#FFCC00]" />
          <p className="text-sm text-gray-300">Transcribing…</p>
        </div>
      );
    }

    if (recorder.state === "transcribed") {
      return (
        <div className="space-y-3 py-2">
          <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
            Review and send
          </p>
          <Textarea
            value={recorder.transcript}
            onChange={(e) => recorder.setTranscript(e.target.value)}
            className="w-full bg-[#101010] border-gray-800 text-white text-base focus-visible:ring-[#FFCC00] resize-none"
            rows={4}
            autoFocus
          />
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => void recorder.start()}
              className="flex-1 text-gray-300 hover:text-white hover:bg-gray-800"
            >
              <Mic className="w-4 h-4 mr-2" />
              Re-record
            </Button>
            <Button
              onClick={handleSend}
              disabled={recorder.transcript.trim().length === 0}
              className="flex-1 bg-[#FFCC00] text-[#1e1f22] hover:bg-[#e6b800] font-semibold"
            >
              <Send className="w-4 h-4 mr-2" />
              Send
            </Button>
          </div>
        </div>
      );
    }

    if (recorder.state === "error") {
      return (
        <div className="space-y-3 py-2">
          <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
            {recorder.error || "Something went wrong."}
          </p>
          <Button
            onClick={() => void recorder.start()}
            className="w-full bg-[#FFCC00] text-[#1e1f22] hover:bg-[#e6b800] font-semibold"
          >
            <Mic className="w-4 h-4 mr-2" />
            Try again
          </Button>
        </div>
      );
    }

    // idle — should rarely render since handleButtonTap auto-starts.
    // Shows up briefly if start() failed silently or after a reset.
    return (
      <div className="space-y-3 py-2">
        <p className="text-sm text-gray-400 text-center">
          Tap the mic to start recording.
        </p>
        <Button
          onClick={() => void recorder.start()}
          className="w-full bg-[#FFCC00] text-[#1e1f22] hover:bg-[#e6b800] font-semibold"
        >
          <Mic className="w-4 h-4 mr-2" />
          Start recording
        </Button>
      </div>
    );
  }
};
