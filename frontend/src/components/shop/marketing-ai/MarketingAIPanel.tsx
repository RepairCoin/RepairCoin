"use client";

import React, {
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Loader2, Send, AlertCircle } from "lucide-react";
import ReactMarkdown, { Components } from "react-markdown";
import {
  askMarketing,
  MarketingMessage,
  MarketingToolCall,
  MARKETING_LIMITS,
} from "@/services/api/aiMarketing";
import { MarketingToolCallCard } from "./MarketingToolCallCard";
import { useVoiceDispatchStore } from "@/stores/voiceDispatchStore";
import { InlineVoiceMic } from "@/components/voice/InlineVoiceMic";
import { AiLimitNotice } from "@/components/shop/AiLimitNotice";

/**
 * Static starter prompts for the empty-panel state. Each covers a
 * different propose-then-tap path:
 *  - Black Friday → recognized category, all-customers segment
 *  - Lapsed     → custom segment (minDaysSinceLastVisit filter)
 *  - Top N      → top_spenders with explicit limit
 *  - Weekend    → recognized category, all-customers segment
 *
 * Equivalent to calling `suggest_campaign_strategies` on panel mount,
 * but static so the empty state renders instantly without burning a
 * Claude call.
 */
const STARTER_PROMPTS: readonly string[] = [
  "Send a Black Friday campaign — 20% off all services this weekend",
  "Bring back customers who haven't booked in 90 days",
  "Tell my top 50 customers about our latest service",
  "Draft a weekend special — book Saturday or Sunday for 15% off",
] as const;

/**
 * Local turn type bundles each assistant reply's `toolCalls` alongside
 * its content. Stripped back down to `MarketingMessage[]` when calling
 * the API — `toolCalls` is UI-side annotation.
 */
type Turn =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls: MarketingToolCall[] };

/**
 * MarketingAIPanel
 *
 * Multi-turn chat body for the shop-side AI Marketing Assistant. State
 * lives in component memory only — no persistence across panel opens,
 * sessionId minted fresh each mount. Mirror of InsightsPanel without
 * the pinned/anomalies/range tabs (marketing has no analytics surface).
 */
export const MarketingAIPanel: React.FC = () => {
  const [sessionId] = useState(() =>
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `marketing_${Math.random().toString(36).slice(2)}_${Date.now()}`
  );
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // WS3 soft-landing — set once a reply reports the monthly AI allowance is spent.
  const [aiLimit, setAiLimit] = useState<{ budgetUsd?: number; spentUsd?: number } | null>(null);
  const voicePendingDispatchId = useVoiceDispatchStore(
    (s) => s.pending?.dispatchId
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to latest message / typing indicator.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns.length, loading]);

  // Focus the input on first render.
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Voice AI Dispatcher Phase 3 — see InsightsPanel for the pattern
  // rationale. When voice routed to MARKETING, seed input + auto-submit
  // + consume the dispatch entry.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const pending = useVoiceDispatchStore.getState().pending;
    if (pending && pending.domain === "marketing") {
      const transcript = pending.transcript;
      useVoiceDispatchStore.getState().consume();
      const timer = setTimeout(() => {
        void submitText(transcript);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [voicePendingDispatchId]);

  const atMessageLimit = turns.length >= MARKETING_LIMITS.maxMessages;

  /**
   * Convert local Turn[] → wire-shape MarketingMessage[]. Same empty-
   * content defensive substitution as InsightsPanel — backend rejects
   * empty messages, single-space placeholder is invisible as a style
   * cue Claude might mimic.
   */
  const toWireMessages = (ts: Turn[]): MarketingMessage[] =>
    ts.map((t) => ({
      role: t.role,
      content: t.content.trim().length > 0 ? t.content : " ",
    }));

  const submitText = async (rawText: string) => {
    if (loading) return;
    const text = rawText.trim();
    if (!text) return;

    if (atMessageLimit) {
      setError(
        `This conversation has reached the ${MARKETING_LIMITS.maxMessages}-message limit. Close and reopen the panel to start fresh.`
      );
      return;
    }
    if (text.length > MARKETING_LIMITS.maxContentChars) {
      setError(
        `Message is too long (max ${MARKETING_LIMITS.maxContentChars} characters).`
      );
      return;
    }

    const nextTurns: Turn[] = [...turns, { role: "user", content: text }];
    setTurns(nextTurns);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await askMarketing(sessionId, toWireMessages(nextTurns));
      setTurns([
        ...nextTurns,
        {
          role: "assistant",
          content: res.reply,
          toolCalls: res.toolCalls ?? [],
        },
      ]);
      setAiLimit(
        res.limitReached ? { budgetUsd: res.budgetUsd, spentUsd: res.spentUsd } : null
      );
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
          msg =
            detail ||
            "We couldn't process that request. Try rephrasing it.";
          break;
        case 429:
          msg =
            detail ||
            "AI budget exhausted for this month, or daily draft limit reached. Try again later or contact RepairCoin support.";
          break;
        case 503:
          msg =
            "AI service is temporarily unavailable. Try again in a moment.";
          break;
        default:
          msg = ax?.message || "Something went wrong. Please try again.";
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = () => submitText(input);
  const handleStarterClick = (prompt: string) => submitText(prompt);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = input.trim().length > 0 && !loading && !atMessageLimit;

  const markdownComponents = useMemo(() => buildMarkdownComponents(), []);

  return (
    <div className="flex-1 flex flex-col min-h-0 mt-4">
      <div
        className="flex-1 overflow-y-auto pr-1 space-y-3"
        aria-live="polite"
      >
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

      {error && (
        <div className="mt-3 bg-red-900/30 border border-red-700/60 rounded-lg px-3 py-2 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-300 leading-relaxed">{error}</p>
        </div>
      )}

      {/* WS3 soft-landing — non-blocking upgrade/overage nudge once the AI
          allowance is spent (the reply still came through on a lighter model). */}
      {aiLimit && (
        <AiLimitNotice
          className="mt-3"
          budgetUsd={aiLimit.budgetUsd}
          spentUsd={aiLimit.spentUsd}
        />
      )}

      <div className="mt-3 flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          maxLength={MARKETING_LIMITS.maxContentChars}
          disabled={loading || atMessageLimit}
          placeholder={
            atMessageLimit
              ? "Conversation full — close to start fresh"
              : "Tell me what campaign to send…"
          }
          className="flex-1 bg-[#1A1A1A] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] transition-colors resize-none disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Tell the Marketing Assistant what campaign to send"
        />
        {/* Voice AI Dispatcher Phase 5.5 — per-panel inline mic. */}
        <InlineVoiceMic
          currentPanel="marketing"
          sessionId={sessionId}
          onTranscriptReady={(text) => void submitText(text)}
          disabled={loading || atMessageLimit}
        />
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
        I never send anything without your tap. Every campaign goes through a
        review modal before delivery.
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
      Tell me what campaign to send.
    </p>
    <p className="text-xs text-gray-500 mb-5 text-center">
      Or tap a starter idea:
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
      <ul className="list-disc list-outside ml-5 my-2 space-y-1">
        {children}
      </ul>
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

  // Same hollow-bubble guard as Insights — skip prose bubble when the
  // reply is empty / punctuation-only. Tool cards still render.
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
            <MarketingToolCallCard
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
