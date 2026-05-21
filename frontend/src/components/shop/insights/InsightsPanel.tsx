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
  askInsights,
  InsightsMessage,
  InsightsToolCall,
  INSIGHTS_LIMITS,
} from "@/services/api/aiInsights";
import { InsightsToolCallCard } from "./InsightsToolCallCard";

/**
 * Suggested first-time-user questions per impl-doc Phase 4.3. Each maps
 * cleanly to a single v1 tool: revenue_summary, top_customers,
 * top_services, bookings_breakdown. Clicking submits directly — no
 * "edit before sending" step.
 */
const STARTER_QUESTIONS: readonly string[] = [
  "How much did I earn last week?",
  "Who are my top 5 customers?",
  "Which services are most popular?",
  "What's the breakdown of my bookings this month?",
] as const;

/**
 * Local turn type that bundles each assistant reply's `toolCalls`
 * alongside its content. Stripped back down to `InsightsMessage[]`
 * when calling the API — the wire contract is content+role only;
 * `toolCalls` is a UI-side annotation.
 *
 * Using a wrapping type (vs a parallel array keyed by index) means
 * the card-rendering loop in MessageBubble can just read
 * `turn.toolCalls` directly without indexing into a sibling structure.
 */
type Turn =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls: InsightsToolCall[] };

/**
 * InsightsPanel
 *
 * Multi-turn chat body for the shop-side Business-Data Insights
 * assistant — the "Ask about your business" half of Square AI. State
 * lives entirely in component memory per scope-doc: no persistence
 * across panel opens, sessionId minted fresh each mount, conversation
 * lost when the Sheet closes.
 *
 * Lifecycle:
 *   - `sessionId` minted once via `crypto.randomUUID()` per mount;
 *     backend audit rows group under it.
 *   - `turns` is the source of truth. Each user submit appends a user
 *     turn, calls askInsights, then appends an assistant turn carrying
 *     Claude's reply text + the `toolCalls` array. Failures keep the
 *     user turn visible + show an inline error so the user can retry
 *     without retyping.
 *   - Tool-result cards render under each assistant bubble via
 *     `InsightsToolCallCard` (Phase 4.4 — currently a placeholder).
 */
export const InsightsPanel: React.FC = () => {
  const [sessionId] = useState(() =>
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `insights_${Math.random().toString(36).slice(2)}_${Date.now()}`
  );
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to latest message / typing indicator.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns.length, loading]);

  // Focus the input on first render so the user can just start typing.
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const atMessageLimit = turns.length >= INSIGHTS_LIMITS.maxMessages;

  /**
   * Convert local Turn[] → the wire-shape InsightsMessage[] for the
   * API call. Drops `toolCalls` since the backend ignores it on input
   * (the model gets the same info via tool_result blocks the backend
   * threads in itself).
   */
  const toWireMessages = (ts: Turn[]): InsightsMessage[] =>
    ts.map((t) => ({ role: t.role, content: t.content }));

  /**
   * Core submit path used by both manual send + starter chips. Trims,
   * validates, posts to the API, and updates state — kept generic so
   * click-to-submit on chips doesn't have to deal with textarea state.
   */
  const submitText = async (rawText: string) => {
    if (loading) return;
    const text = rawText.trim();
    if (!text) return;

    if (atMessageLimit) {
      setError(
        `This conversation has reached the ${INSIGHTS_LIMITS.maxMessages}-message limit. Close and reopen the panel to start fresh.`
      );
      return;
    }
    if (text.length > INSIGHTS_LIMITS.maxContentChars) {
      setError(
        `Message is too long (max ${INSIGHTS_LIMITS.maxContentChars} characters).`
      );
      return;
    }

    const nextTurns: Turn[] = [...turns, { role: "user", content: text }];
    setTurns(nextTurns);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await askInsights(sessionId, toWireMessages(nextTurns));
      setTurns([
        ...nextTurns,
        {
          role: "assistant",
          content: res.reply,
          toolCalls: res.toolCalls ?? [],
        },
      ]);
    } catch (err) {
      // Keep the user's turn visible so they can retry without retyping.
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
            "We couldn't process that question. Try rephrasing it.";
          break;
        case 429:
          msg =
            detail ||
            "AI budget exhausted for this month. Try again next month or contact RepairCoin support.";
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
  const handleStarterClick = (question: string) => submitText(question);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = input.trim().length > 0 && !loading && !atMessageLimit;

  // Markdown overrides — same dark-theme styling as the Help panel but
  // no .md-link rewiring (insights has no article corpus to cross-link).
  const markdownComponents = useMemo(() => buildMarkdownComponents(), []);

  // Active range — extracted from the most recent assistant turn that
  // invoked a tool with a `range` arg. Surfaces as a chip above the
  // input so the shop owner knows what "this" refers to when asking a
  // follow-up. Backed by the prompt rule that says Claude should
  // reuse the previous range unless the user explicitly switches.
  const activeRange = useMemo(() => extractActiveRange(turns), [turns]);

  return (
    <div className="flex-1 flex flex-col min-h-0 mt-6">
      {/* Messages list — scrolls within its own bounds so the input
          stays anchored at the bottom. */}
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
          />
        ))}

        {loading && <TypingBubble />}

        <div ref={messagesEndRef} />
      </div>

      {/* Inline error — sits ABOVE the input so the user sees it before
          re-typing. */}
      {error && (
        <div className="mt-3 bg-red-900/30 border border-red-700/60 rounded-lg px-3 py-2 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-300 leading-relaxed">{error}</p>
        </div>
      )}

      {/* Active range chip — only renders when the most recent assistant
          turn invoked a tool with a `range` arg. Tells the shop owner
          what time window their next follow-up will reuse by default. */}
      {activeRange && (
        <div className="mt-3 flex justify-end">
          <span
            className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-gray-400 bg-[#1A1A1A] border border-gray-700 rounded-full px-2.5 py-0.5"
            title="Follow-up questions will reuse this range unless you specify a different one."
          >
            <span className="text-gray-500">Range:</span>
            <span className="text-[#FFCC00]">{RANGE_LABELS[activeRange]}</span>
          </span>
        </div>
      )}

      {/* Input row */}
      <div className="mt-3 flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          maxLength={INSIGHTS_LIMITS.maxContentChars}
          disabled={loading || atMessageLimit}
          placeholder={
            atMessageLimit
              ? "Conversation full — close to start fresh"
              : "Ask about your shop's data…"
          }
          className="flex-1 bg-[#1A1A1A] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] transition-colors resize-none disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Ask the Insights Assistant"
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
        Answers are based on your shop&apos;s live data. The assistant
        can only see your own shop.
      </p>
    </div>
  );
};

// ----- internals -----

type RangeKey = "7d" | "30d" | "90d" | "all";

const RANGE_LABELS: Record<RangeKey, string> = {
  "7d": "last 7 days",
  "30d": "last 30 days",
  "90d": "last 90 days",
  all: "all time",
};

/**
 * Pull the active range out of the most recent assistant turn's
 * toolCalls. Walks turns from newest to oldest so a multi-tool
 * response (e.g. revenue + bookings) yields the LAST tool's range —
 * that's the one Claude phrased its summary around and the one the
 * user is most likely talking about in a follow-up.
 *
 * Returns null when no assistant turn has run a range-bearing tool
 * yet (e.g. fresh conversation, or only the decline path so far).
 */
function extractActiveRange(turns: Turn[]): RangeKey | null {
  for (let i = turns.length - 1; i >= 0; i--) {
    const t = turns[i];
    if (t.role !== "assistant") continue;
    // Walk the assistant's tool calls in reverse so the last one wins.
    for (let j = t.toolCalls.length - 1; j >= 0; j--) {
      const range = t.toolCalls[j].args?.range;
      if (typeof range === "string" && range in RANGE_LABELS) {
        return range as RangeKey;
      }
    }
  }
  return null;
}

const EmptyState: React.FC<{
  onPick: (question: string) => void;
  disabled: boolean;
}> = ({ onPick, disabled }) => (
  <div className="flex flex-col px-1 py-6">
    <p className="text-sm text-gray-300 mb-1 text-center">
      Ask about your business.
    </p>
    <p className="text-xs text-gray-500 mb-5 text-center">
      Or tap a starter question:
    </p>
    <div className="w-full space-y-2">
      {STARTER_QUESTIONS.map((q) => (
        <button
          key={q}
          type="button"
          onClick={() => onPick(q)}
          disabled={disabled}
          className="w-full text-left text-xs text-gray-300 bg-[#1A1A1A] border border-gray-700 hover:border-[#FFCC00] hover:text-white rounded-lg px-3 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {q}
        </button>
      ))}
    </div>
  </div>
);

/**
 * Markdown component overrides for assistant replies. Same dark-theme
 * styling as the Help panel's components. No .md-link rewiring needed
 * — insights replies don't cite a corpus.
 */
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
}> = ({ turn, markdownComponents }) => {
  const isUser = turn.role === "user";

  // User messages: plain text, right-aligned, yellow bubble.
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words bg-[#FFCC00] text-black">
          {turn.content}
        </div>
      </div>
    );
  }

  // Assistant: markdown prose bubble + a card per tool call directly
  // underneath. Card renderer (Phase 4.4) replaces ToolCallCardStub.
  return (
    <div className="flex justify-start flex-col items-start gap-2">
      <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm break-words bg-[#1A1A1A] border border-gray-800 text-gray-200">
        <ReactMarkdown components={markdownComponents}>
          {turn.content}
        </ReactMarkdown>
      </div>
      {turn.toolCalls.length > 0 && (
        <div className="w-full max-w-[85%] space-y-2">
          {turn.toolCalls.map((tc, i) => (
            <InsightsToolCallCard key={i} toolCall={tc} />
          ))}
        </div>
      )}
    </div>
  );
};

const TypingBubble: React.FC = () => (
  <div className="flex justify-start">
    <div className="bg-[#1A1A1A] border border-gray-800 text-gray-400 rounded-lg px-3 py-2 text-sm flex items-center gap-2">
      <Loader2 className="w-4 h-4 animate-spin" />
      <span>Thinking…</span>
    </div>
  </div>
);
