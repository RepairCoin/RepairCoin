"use client";

import React, {
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Loader2, Send, AlertCircle, Mic, Volume2, VolumeX } from "lucide-react";
import ReactMarkdown, { Components } from "react-markdown";
import {
  askOrchestrate,
  OrchestrateMessage,
  OrchestrateToolCall,
  ORCHESTRATE_LIMITS,
} from "@/services/api/aiOrchestrate";
import { OrchestrateToolCallCard } from "./OrchestrateToolCallCard";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { speakText } from "@/services/api/voice";

/**
 * UnifiedAssistantPanel (v2)
 *
 * The "one door" — a single conversation that answers business questions AND
 * takes marketing actions, no panel switching. Structurally a copy of
 * MarketingAIPanel (the tab-free chat skeleton), with three changes:
 *   - calls askOrchestrate (full cross-domain registry) instead of askMarketing
 *   - renders OrchestrateToolCallCard (delegates to both domains' card renderers)
 *   - cross-domain starter prompts + copy
 *
 * Voice-in is intentionally NOT wired here yet — the voice/TTS layer +
 * repointing the entry points is Phase 3. Text-only for Phase 2. State lives in
 * component memory only (sessionId minted per mount); server-side persistence
 * is Phase 2/D2 follow-up.
 */
const STARTER_PROMPTS: readonly string[] = [
  "How did we do this month?",
  "Why does it feel slower lately?",
  "Win back the customers who've gone quiet",
  "What's running low in inventory?",
] as const;

type Turn =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls: OrchestrateToolCall[] };

export const UnifiedAssistantPanel: React.FC = () => {
  const [sessionId] = useState(() =>
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `orchestrate_${Math.random().toString(36).slice(2)}_${Date.now()}`
  );
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [voiceOut, setVoiceOut] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns.length, loading]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const atMessageLimit = turns.length >= ORCHESTRATE_LIMITS.maxMessages;

  // Turn[] → wire shape; substitute a single space for empty content so the
  // backend's non-empty-content validator passes (same as the other panels).
  const toWireMessages = (ts: Turn[]): OrchestrateMessage[] =>
    ts.map((t) => ({
      role: t.role,
      content: t.content.trim().length > 0 ? t.content : " ",
    }));

  const submitText = async (rawText: string, opts?: { speak?: boolean }) => {
    if (loading) return;
    const text = rawText.trim();
    if (!text) return;

    if (atMessageLimit) {
      setError(
        `This conversation has reached the ${ORCHESTRATE_LIMITS.maxMessages}-message limit. Close and reopen to start fresh.`
      );
      return;
    }
    if (text.length > ORCHESTRATE_LIMITS.maxContentChars) {
      setError(
        `Message is too long (max ${ORCHESTRATE_LIMITS.maxContentChars} characters).`
      );
      return;
    }

    const nextTurns: Turn[] = [...turns, { role: "user", content: text }];
    setTurns(nextTurns);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await askOrchestrate(sessionId, toWireMessages(nextTurns));
      setTurns([
        ...nextTurns,
        {
          role: "assistant",
          content: res.reply,
          toolCalls: res.toolCalls ?? [],
        },
      ]);
      if ((opts?.speak ?? voiceOut) && res.reply && res.reply.trim()) {
        void playSpeech(res.reply);
      }
    } catch (err) {
      const ax = err as {
        response?: { status?: number; data?: { error?: string } };
        message?: string;
      };
      const status = ax?.response?.status;
      const detail = ax?.response?.data?.error;
      let msg: string;
      switch (status) {
        case 401:
          msg = "Your session has expired. Please log in again.";
          break;
        case 400:
          msg = detail || "We couldn't process that request. Try rephrasing it.";
          break;
        case 429:
          msg =
            detail ||
            "AI budget exhausted for this month. Try again later or contact RepairCoin support.";
          break;
        case 503:
          msg = "AI service is temporarily unavailable. Try again in a moment.";
          break;
        default:
          msg = ax?.message || "Something went wrong. Please try again.";
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Voice-out: speak an assistant reply (best-effort; falls back to text).
  const playSpeech = async (text: string) => {
    try {
      const blob = await speakText(text);
      const url = URL.createObjectURL(blob);
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch {
      // TTS is an enhancement — silently keep the on-screen text reply.
    }
  };

  // Voice-in: reuse the shared mic→STT recorder. Speaking auto-speaks the
  // reply back (spoke-to-it → speaks-back, Siri-style), regardless of toggle.
  const recorder = useVoiceRecorder({
    sessionId,
    // Pin STT to English — the shop dashboard is English; without a hint
    // Whisper can mis-detect the language on accented/unclear audio and
    // return a non-English transcript (which then flips the whole reply).
    language: "en",
    onTranscribed: (r) => {
      if (r.transcript && r.transcript.trim()) {
        void submitText(r.transcript, { speak: true });
      }
    },
  });

  const handleSend = () => submitText(input);
  const handleStarterClick = (prompt: string) => submitText(prompt);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = input.trim().length > 0 && !loading && !atMessageLimit;
  const listening = recorder.state === "listening";
  const transcribing = recorder.state === "transcribing";
  const displayError =
    error ?? (recorder.state === "error" ? recorder.error : null);
  const markdownComponents = useMemo(() => buildMarkdownComponents(), []);

  return (
    <div className="flex-1 flex flex-col min-h-0 mt-4">
      <div className="flex-1 overflow-y-auto pr-1 space-y-3" aria-live="polite">
        {turns.length === 0 && !loading && !error && (
          <EmptyState onPick={handleStarterClick} disabled={loading} />
        )}

        {turns.map((t, i) => (
          <TurnBubble
            key={i}
            turn={t}
            markdownComponents={markdownComponents}
            onChipClick={loading ? undefined : submitText}
          />
        ))}

        {loading && <TypingBubble />}

        <div ref={messagesEndRef} />
      </div>

      {displayError && (
        <div className="mt-3 bg-red-900/30 border border-red-700/60 rounded-lg px-3 py-2 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-300 leading-relaxed">{displayError}</p>
        </div>
      )}

      <div className="mt-3 flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          maxLength={ORCHESTRATE_LIMITS.maxContentChars}
          disabled={loading || atMessageLimit}
          placeholder={
            atMessageLimit
              ? "Conversation full — close to start fresh"
              : "Ask about your business, or tell me what to do…"
          }
          className="flex-1 bg-[#1A1A1A] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] transition-colors resize-none disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Ask your business assistant anything"
        />
        {/* Voice-in: tap to talk; auto-stops on silence → transcribes → sends. */}
        <button
          type="button"
          onClick={() => {
            if (listening) recorder.stop();
            else void recorder.start();
          }}
          disabled={loading || atMessageLimit || transcribing}
          aria-label={listening ? "Stop recording" : "Speak to the assistant"}
          title={listening ? "Listening — tap to stop" : "Tap to talk"}
          className={`flex-shrink-0 p-2.5 rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            listening
              ? "bg-red-600 border-red-600 text-white animate-pulse"
              : "bg-[#1A1A1A] border-gray-700 text-gray-300 hover:border-[#FFCC00] hover:text-white"
          }`}
        >
          {transcribing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Mic className="w-4 h-4" />
          )}
        </button>
        {/* Voice-out toggle: when on, replies are spoken (typed or voiced). */}
        <button
          type="button"
          onClick={() => setVoiceOut((v) => !v)}
          aria-label={voiceOut ? "Turn off spoken replies" : "Turn on spoken replies"}
          aria-pressed={voiceOut}
          title={voiceOut ? "Spoken replies: on" : "Spoken replies: off"}
          className={`flex-shrink-0 p-2.5 rounded-lg border transition-colors ${
            voiceOut
              ? "bg-[#FFCC00]/15 border-[#FFCC00] text-[#FFCC00]"
              : "bg-[#1A1A1A] border-gray-700 text-gray-400 hover:text-white"
          }`}
        >
          {voiceOut ? (
            <Volume2 className="w-4 h-4" />
          ) : (
            <VolumeX className="w-4 h-4" />
          )}
        </button>
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Send"
          className={`flex-shrink-0 p-2.5 rounded-lg transition-colors ${
            canSend
              ? "bg-[#FFCC00] text-black hover:bg-[#FFD700]"
              : "bg-[#1A1A1A] border border-gray-800 text-gray-600 cursor-not-allowed"
          }`}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>

      <p className="mt-2 text-[10px] text-gray-600 text-center">
        I answer and draft — I never send, order, or charge anything without your
        tap.
      </p>
    </div>
  );
};

// ----- internals -----

const EmptyState: React.FC<{
  onPick: (prompt: string) => void;
  disabled: boolean;
}> = ({ onPick, disabled }) => (
  <div className="flex flex-col px-1 py-6">
    <p className="text-sm text-gray-300 mb-1 text-center">
      Just talk to your business.
    </p>
    <p className="text-xs text-gray-500 mb-5 text-center">
      Ask a question, or tell me to do something — try:
    </p>
    <div className="w-full space-y-2">
      {STARTER_PROMPTS.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onPick(p)}
          disabled={disabled}
          className="w-full text-left text-xs text-gray-300 bg-[#1A1A1A] border border-gray-700 hover:border-[#FFCC00] hover:text-white rounded-lg px-3 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {p}
        </button>
      ))}
    </div>
  </div>
);

const TypingBubble: React.FC = () => (
  <div className="flex justify-start">
    <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm bg-[#1A1A1A] border border-gray-800 text-gray-400 flex items-center gap-2">
      <Loader2 className="w-3.5 h-3.5 animate-spin" />
      <span>Thinking…</span>
    </div>
  </div>
);

function buildMarkdownComponents(): Components {
  return {
    strong: ({ children }) => (
      <strong className="font-semibold text-white">{children}</strong>
    ),
    em: ({ children }) => <em className="italic text-gray-300">{children}</em>,
    code: ({ children }) => (
      <code className="bg-black/40 border border-gray-700 rounded px-1 py-0.5 text-[12px] font-mono">
        {children}
      </code>
    ),
    p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
    ul: ({ children }) => (
      <ul className="list-disc list-outside ml-5 my-2 space-y-1">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-outside ml-5 my-2 space-y-1">
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className="text-sm leading-relaxed">{children}</li>
    ),
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#FFCC00] hover:text-[#FFD700] underline"
      >
        {children}
      </a>
    ),
  };
}

const TurnBubble: React.FC<{
  turn: Turn;
  markdownComponents: Components;
  onChipClick?: (prompt: string) => void;
}> = ({ turn, markdownComponents, onChipClick }) => {
  if (turn.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words bg-[#FFCC00] text-black">
          {turn.content}
        </div>
      </div>
    );
  }

  // Skip the prose bubble when the reply is empty / punctuation-only; tool
  // cards still render (same hollow-bubble guard as the other panels).
  const hasProse = /[a-zA-Z0-9]/.test(turn.content);

  return (
    <div className="flex justify-start flex-col items-start gap-2">
      {hasProse && (
        <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm break-words bg-[#1A1A1A] border border-gray-800 text-gray-200">
          <ReactMarkdown components={markdownComponents}>
            {turn.content}
          </ReactMarkdown>
        </div>
      )}
      {turn.toolCalls.length > 0 && (
        <div className="w-full max-w-[85%] space-y-2">
          {turn.toolCalls.map((tc, i) => (
            <OrchestrateToolCallCard
              key={i}
              toolCall={tc}
              onChipClick={onChipClick}
            />
          ))}
        </div>
      )}
    </div>
  );
};
