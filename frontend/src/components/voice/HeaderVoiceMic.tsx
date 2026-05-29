// frontend/src/components/voice/HeaderVoiceMic.tsx
//
// Voice AI Dispatcher Phase 2 — header mic icon.
//
// Small mic button mounted in DashboardLayout's action cluster
// alongside Help / Insights / Marketing launchers. Lets the shop
// owner trigger voice from any page (not just the dashboard home,
// which is the only place VoiceCommandPill renders).
//
// On tap: opens a Popover that runs the same state machine as
// VoiceCommandPill, but in a compact card rather than a hero pill.

"use client";

import React, { useMemo, useState } from "react";
import { Mic, Square, Loader2, Send, X } from "lucide-react";
import { toast } from "react-hot-toast";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

export const HeaderVoiceMic: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [outOfScope, setOutOfScope] = useState(false);
  const dispatch = useVoiceDispatchStore((s) => s.dispatch);

  // One session id per popover-open. Resets when popover closes so a
  // new open is a fresh conversation in audit terms.
  const sessionId = useMemo(
    () =>
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `voice-${Date.now()}-${Math.random().toString(36).slice(2)}`),
    // Re-mint when popover toggles open → fresh session per open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open]
  );

  const recorder = useVoiceRecorder({ sessionId, language: "en" });

  // Closing the popover should also stop any in-flight recording so the
  // mic indicator doesn't stay on after dismissal.
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      recorder.reset();
      setDispatching(false);
      setOutOfScope(false);
    }
    setOpen(next);
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
      recorder.reset();
      setOpen(false);
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
    setOpen(false);
  };

  const triggerBusy = recorder.state === "listening";

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Voice command"
          className={`relative p-2.5 rounded-full transition-all duration-300 lg:shadow-[0_2px_8px_4px_#101010] ${
            triggerBusy
              ? "bg-red-500 text-white"
              : "bg-[#FFCC00] text-[#1e1f22] hover:bg-[#e6b800]"
          }`}
        >
          <Mic className="w-6 h-6" />
          {triggerBusy && (
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 animate-ping" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={12}
        className="w-[360px] bg-[#1e1f22] border-gray-800 text-white p-4 shadow-2xl"
      >
        {renderBody()}
      </PopoverContent>
    </Popover>
  );

  function renderBody() {
    if (outOfScope) {
      return (
        <div className="space-y-3">
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
        <div className="flex items-center gap-3 py-2">
          <Loader2 className="w-5 h-5 animate-spin text-[#FFCC00]" />
          <p className="text-sm text-gray-300">Routing your question…</p>
        </div>
      );
    }
    if (recorder.state === "idle" || recorder.state === "error") {
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Ask AI by voice</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-white"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {recorder.state === "error" && recorder.error && (
            <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
              {recorder.error}
            </p>
          )}
          <p className="text-xs text-gray-400">
            Insights, marketing, or help — AI routes your question to the
            right place.
          </p>
          <Button
            onClick={() => void recorder.start()}
            className="w-full bg-[#FFCC00] text-[#1e1f22] hover:bg-[#e6b800] font-semibold"
          >
            <Mic className="w-4 h-4 mr-2" />
            {recorder.state === "error" ? "Try again" : "Start recording"}
          </Button>
        </div>
      );
    }

    if (recorder.state === "requesting_permission") {
      return (
        <div className="flex items-center gap-3 py-2">
          <Loader2 className="w-5 h-5 animate-spin text-[#FFCC00]" />
          <p className="text-sm text-gray-300">
            Allow microphone access…
          </p>
        </div>
      );
    }

    if (recorder.state === "listening") {
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Listening…
          </div>
          <p className="text-xs text-gray-400">
            Auto-stops when you stop talking, or tap below to stop now.
          </p>
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
        <div className="flex items-center gap-3 py-2">
          <Loader2 className="w-5 h-5 animate-spin text-[#FFCC00]" />
          <p className="text-sm text-gray-300">Transcribing…</p>
        </div>
      );
    }

    // transcribed
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
            Review and send
          </p>
          <button
            type="button"
            onClick={recorder.reset}
            className="text-gray-400 hover:text-white"
            aria-label="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <Textarea
          value={recorder.transcript}
          onChange={(e) => recorder.setTranscript(e.target.value)}
          className="w-full bg-[#101010] border-gray-800 text-white text-sm focus-visible:ring-[#FFCC00] resize-none"
          rows={3}
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
};
