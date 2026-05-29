// frontend/src/components/voice/InlineVoiceMic.tsx
//
// Voice AI Dispatcher Phase 5.5 — per-panel inline mic with D3 hybrid.
//
// Small mic button rendered alongside each panel's existing Send
// button (InsightsPanel / MarketingAIPanel / HelpAssistantPanel). Lets
// the shop owner dictate follow-up turns by voice without leaving the
// panel.
//
// The "D3 hybrid" is the routing optimization documented in scope.md
// §4.4: the vast majority of follow-up turns stay in the current
// panel ("make it more urgent", "do the same for last week"), so we
// don't want to pay for a router (Haiku) call on every dictation.
//
// Flow:
//   1. Tap mic → start recording.
//   2. Auto-stop on silence → /api/ai/voice/transcribe.
//   3. Run voiceDomainHints client-side classifier on the transcript:
//        - null OR matches currentPanel → EDIT_CONFIRM, no router call.
//        - DIFFERS from currentPanel → call /api/ai/dispatch with
//          source='inline_mic' to confirm. Only THIS turn pays for the
//          router call, and only when the keyword hints suggested a
//          mismatch.
//   4. If router confirms cross-domain → CROSS_DOMAIN_CHOICE card:
//      "This looks like an Insights question. [Send to Marketing]
//       [Open Insights instead]"
//      - Send to current → onTranscriptReady() (panel submits as
//        normal — Haiku already paid for, no second router call).
//      - Open other → voiceDispatchStore.dispatch(otherDomain,
//        transcript), the other launcher opens + its panel auto-
//        submits. The current panel stays underneath.
//
// Implementation notes:
//   - Reuses useVoiceRecorder (same MediaRecorder + silence
//     detection + state machine as the global mic surfaces).
//   - Uses shadcn Popover anchored to the mic button, opens
//     UPWARD (side='top') so it doesn't get clipped by the panel
//     textarea below.
//   - sessionId is passed in by the panel so STT audit ties to the
//     panel's existing audit trail (ai_voice_transcriptions and
//     ai_<panel>_messages share session_id).

"use client";

import React, { useMemo, useState } from "react";
import {
  Mic,
  Square,
  Loader2,
  Send,
  X,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
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
import {
  classifyTranscriptClientSide,
  VoiceHintDomain,
} from "@/utils/voiceDomainHints";

export type InlineVoiceMicPanel = "insights" | "marketing" | "help";

interface InlineVoiceMicProps {
  /** Which panel hosts this mic — drives the D3 hybrid handoff logic. */
  currentPanel: InlineVoiceMicPanel;
  /** Reused from the panel so audit rows share session_id. */
  sessionId: string;
  /**
   * Called when the user confirms an in-domain message. The panel
   * should treat this as `submitText(transcript)`.
   */
  onTranscriptReady: (transcript: string) => void;
  /** Optional — disables the mic button while the panel is busy. */
  disabled?: boolean;
}

const DOMAIN_LABEL: Record<VoiceHintDomain, string> = {
  insights: "Insights",
  marketing: "Marketing",
  help: "Help",
};

export const InlineVoiceMic: React.FC<InlineVoiceMicProps> = ({
  currentPanel,
  sessionId,
  onTranscriptReady,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  // After dispatch confirms a cross-domain mismatch, we hold the other
  // domain here and render the CROSS_DOMAIN_CHOICE card.
  const [crossDomainTarget, setCrossDomainTarget] =
    useState<VoiceHintDomain | null>(null);
  // True while the router (Haiku) is confirming a suspected mismatch.
  const [confirming, setConfirming] = useState(false);
  const dispatch = useVoiceDispatchStore((s) => s.dispatch);

  // The per-recording session id is the panel's session id. STT + any
  // dispatch audit row group under the same id, joinable to the
  // panel's own ai_<panel>_messages rows.
  const recorder = useVoiceRecorder({ sessionId, language: "en" });

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      recorder.reset();
      setCrossDomainTarget(null);
      setConfirming(false);
    }
    setOpen(next);
  };

  // Single-gesture: opening the popover via the mic button kicks off
  // recording immediately. Same iOS-Safari constraint as the other
  // surfaces.
  const handleMicTap = () => {
    if (disabled) return;
    setOpen(true);
    void recorder.start();
  };

  /**
   * Called when the user taps Send on the EDIT_CONFIRM card. The
   * client-side hint already classified; if the hint pointed at a
   * different domain than currentPanel, we call the router to confirm.
   * Otherwise we treat it as in-domain and hand off directly to the
   * panel.
   */
  const handleSend = async () => {
    const text = recorder.transcript.trim();
    if (text.length === 0) return;

    const hint = classifyTranscriptClientSide(text);

    // No signals OR signals match the current panel → in-domain.
    // No router call. No cost.
    if (hint === null || hint === currentPanel) {
      onTranscriptReady(text);
      handleOpenChange(false);
      return;
    }

    // Hint suggests cross-domain. Confirm with the router (Haiku) so
    // we don't act on a false-positive keyword match. Pass
    // source='inline_mic' so the audit row records where it came from.
    setConfirming(true);
    try {
      const result = await dispatchTranscript(
        text,
        sessionId,
        "inline_mic",
        recorder.originalTranscript
      );
      if (
        result.domain === currentPanel ||
        result.domain === "out_of_scope"
      ) {
        // Router disagreed with the hint — treat as in-domain. The
        // OUT_OF_SCOPE case is rare here (the user is already in a
        // domain panel by virtue of being able to tap this mic) and
        // we prefer to let them attempt the question rather than
        // bounce them with a decline.
        onTranscriptReady(text);
        handleOpenChange(false);
        return;
      }
      // Router confirms the mismatch. Show the choice card.
      setCrossDomainTarget(result.domain as VoiceHintDomain);
    } catch {
      // Router unreachable. Fall through to in-domain rather than
      // blocking the user — let them ask the question here, and the
      // current panel can decline (Insights/Marketing/Help each have
      // their own scope-decline copy).
      onTranscriptReady(text);
      handleOpenChange(false);
    } finally {
      setConfirming(false);
    }
  };

  /** User picked "Send to current panel" on the choice card. */
  const handleSendHere = () => {
    onTranscriptReady(recorder.transcript.trim());
    handleOpenChange(false);
  };

  /** User picked "Open other panel instead" on the choice card. */
  const handleOpenOther = (otherDomain: VoiceHintDomain) => {
    dispatch(otherDomain, recorder.transcript.trim());
    handleOpenChange(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={handleMicTap}
          disabled={disabled}
          aria-label="Voice input"
          className="flex items-center justify-center w-10 h-10 rounded-full bg-[#FFCC00] text-[#1e1f22] hover:bg-[#e6b800] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Mic className="w-4 h-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        sideOffset={8}
        className="w-[340px] bg-[#1e1f22] border-gray-800 text-white p-4 shadow-2xl"
      >
        {renderBody()}
      </PopoverContent>
    </Popover>
  );

  function renderBody() {
    if (crossDomainTarget) {
      return (
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-gray-200">
              This looks like a{" "}
              <strong>{DOMAIN_LABEL[crossDomainTarget]}</strong> question.
              Where should it go?
            </p>
          </div>
          <div className="space-y-2">
            <Button
              onClick={() => handleOpenOther(crossDomainTarget)}
              className="w-full bg-[#FFCC00] text-[#1e1f22] hover:bg-[#e6b800] font-semibold"
            >
              Open {DOMAIN_LABEL[crossDomainTarget]} instead
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              onClick={handleSendHere}
              variant="outline"
              className="w-full bg-transparent border-gray-700 text-white hover:bg-gray-800"
            >
              Send to {DOMAIN_LABEL[currentPanel]} anyway
            </Button>
          </div>
        </div>
      );
    }

    if (confirming) {
      return (
        <div className="flex items-center gap-3 py-2">
          <Loader2 className="w-5 h-5 animate-spin text-[#FFCC00]" />
          <p className="text-sm text-gray-300">Checking where this fits…</p>
        </div>
      );
    }

    if (recorder.state === "requesting_permission") {
      return (
        <div className="flex items-center gap-3 py-2">
          <Loader2 className="w-5 h-5 animate-spin text-[#FFCC00]" />
          <p className="text-sm text-gray-300">Allow microphone access…</p>
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
            Auto-stops when you stop talking, or tap below.
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

    if (recorder.state === "transcribed") {
      return (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">
              Review and send
            </p>
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
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

    if (recorder.state === "error") {
      return (
        <div className="space-y-3">
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

    // idle — would only render briefly between mounting and start()
    return (
      <div className="flex items-center gap-3 py-2">
        <Loader2 className="w-5 h-5 animate-spin text-[#FFCC00]" />
        <p className="text-sm text-gray-300">Starting…</p>
      </div>
    );
  }
};
