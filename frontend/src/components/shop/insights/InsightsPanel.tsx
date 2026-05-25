"use client";

import React, {
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Loader2, Send, AlertCircle, MessageSquare, Pin, X } from "lucide-react";
import ReactMarkdown, { Components } from "react-markdown";
import {
  askInsights,
  InsightsMessage,
  InsightsToolCall,
  INSIGHTS_LIMITS,
  PinnedQuery,
  listPinnedQueries,
  pinQuery,
  unpinQuery,
  recordPinnedRun,
  Anomaly,
  listAnomalies,
  dismissAnomaly,
} from "@/services/api/aiInsights";
import { InsightsToolCallCard } from "./InsightsToolCallCard";
import { InsightsAnomalyBanner } from "./InsightsAnomalyBanner";

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
type TabKey = "chat" | "pinned";

/**
 * When the user taps a pinned row, we set this to the pin's id so we
 * can call recordPinnedRun() after the assistant reply lands. Cleared
 * on every fresh user-typed submit (only counts taps from the Pinned
 * tab as "pinned runs").
 */
type PendingRun = { pinnedId: string } | null;

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

  // Phase 7.3 — saved-queries state.
  const [activeTab, setActiveTab] = useState<TabKey>("chat");
  const [pinned, setPinned] = useState<PinnedQuery[]>([]);
  const [pinnedLoading, setPinnedLoading] = useState(false);
  const [pinnedError, setPinnedError] = useState<string | null>(null);

  // Phase 7.2.16 — anomaly banner state. Failure to load is silent —
  // we just don't show the banner. Same pattern is reused on dismiss.
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  // Tracks a pin tap pending its reply, so the Pinned tab can refresh
  // last_run_at after the chat round-trip completes.
  const pendingRunRef = useRef<PendingRun>(null);

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

      // Phase 7.3 — if this submit originated from a pinned-tap,
      // refresh the pin's last_run_at + excerpt server-side AND
      // optimistically in local state so the Pinned tab reflects
      // the recency immediately without a refetch.
      const pending = pendingRunRef.current;
      pendingRunRef.current = null;
      if (pending) {
        const excerpt = res.reply.slice(0, 500);
        recordPinnedRun(pending.pinnedId, excerpt).catch(() => {
          // Non-fatal — the reply already shipped to the user.
        });
        setPinned((cur) =>
          cur.map((p) =>
            p.id === pending.pinnedId
              ? {
                  ...p,
                  lastRunAt: new Date().toISOString(),
                  lastResponseExcerpt: excerpt,
                }
              : p
          )
        );
      }
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

  // ---------- Phase 7.3 — pinned-query handlers ----------

  // Load pins on mount. Failure is non-fatal — the Pinned tab just
  // shows an inline error; chat keeps working.
  useEffect(() => {
    let cancelled = false;
    setPinnedLoading(true);
    listPinnedQueries()
      .then((rows) => {
        if (!cancelled) setPinned(rows);
      })
      .catch(() => {
        if (!cancelled) setPinnedError("Couldn't load pinned queries.");
      })
      .finally(() => {
        if (!cancelled) setPinnedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Card-level Pin button calls this. Network call + optimistic state
   * update (so the Pinned tab counter ticks without a refetch).
   * Re-thrown errors bubble to PinButton's local error state.
   */
  const handlePin = async (questionText: string) => {
    const created = await pinQuery(questionText);
    setPinned((cur) => {
      // Idempotent — server may have returned an existing row.
      if (cur.some((p) => p.id === created.id)) return cur;
      return [created, ...cur];
    });
  };

  /** Unpin from the Pinned tab's list. Optimistic remove. */
  const handleUnpin = async (id: string) => {
    const prev = pinned;
    setPinned((cur) => cur.filter((p) => p.id !== id));
    try {
      await unpinQuery(id);
    } catch {
      // Restore on failure so the user knows it didn't stick.
      setPinned(prev);
    }
  };

  /**
   * User tapped a pinned row → flip back to Chat tab + submit the
   * question. Stash the pin id so the post-reply path can refresh
   * last_run_at.
   */
  const handlePinnedTap = (p: PinnedQuery) => {
    pendingRunRef.current = { pinnedId: p.id };
    setActiveTab("chat");
    submitText(p.questionText);
  };

  // ---------- Phase 7.2.16 — anomaly banner handlers ----------

  // Load anomalies on mount (and therefore on every panel reopen, since
  // the shadcn Sheet remounts InsightsPanel each open — same lifecycle
  // already relied on by the sessionId-per-mount and pinned-fetch
  // patterns above). Silent on failure: no banner is preferable to a
  // second error chrome on top of chat + pinned errors.
  useEffect(() => {
    let cancelled = false;
    listAnomalies()
      .then((rows) => {
        if (!cancelled) setAnomalies(rows);
      })
      .catch(() => {
        /* swallow — banner is non-critical */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Dismiss button → optimistic remove + network call. Restore on
   * failure so the user knows it didn't stick. Server returns 404 for
   * already-dismissed rows (existence-leak prevention); treat that as
   * success — the optimistic remove was correct.
   */
  const handleDismissAnomaly = async (id: string) => {
    const prev = anomalies;
    setAnomalies((cur) => cur.filter((a) => a.id !== id));
    try {
      await dismissAnomaly(id);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response
        ?.status;
      if (status === 404) return; // already dismissed server-side — keep our optimistic remove
      setAnomalies(prev);
    }
  };

  /**
   * "Tell me more" → submit the anomaly's followUpQuestion through the
   * regular chat pipeline (reuses Phase 6.3 chip path) and auto-dismiss
   * the banner row. The user has engaged with the anomaly — keeping it
   * around would just be visual noise on the next reopen.
   */
  const handleAskAnomalyFollowup = (anomaly: Anomaly) => {
    if (!anomaly.followUpQuestion) return;
    setActiveTab("chat");
    // Fire-and-forget the dismiss; we don't block the submit on it.
    handleDismissAnomaly(anomaly.id);
    submitText(anomaly.followUpQuestion);
  };

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
    <div className="flex-1 flex flex-col min-h-0 mt-4">
      {/* Phase 7.3 — tab switcher. Sits ABOVE the messages list so the
          chat content + pinned list share the same scroll viewport
          slot below. Chat is default; Pinned shows a count badge. */}
      <TabSwitcher
        active={activeTab}
        onChange={setActiveTab}
        pinnedCount={pinned.length}
      />

      {activeTab === "chat" ? (
        <div
          className="flex-1 overflow-y-auto pr-1 space-y-3 mt-3"
          aria-live="polite"
        >
          {/* Phase 7.2.16 — anomaly banner. Sits ABOVE the messages
              list so it's the first thing the shop owner sees on
              panel open. Renders nothing when there are no active
              anomalies, so an empty fresh-shop state is unchanged. */}
          <InsightsAnomalyBanner
            anomalies={anomalies}
            onAskFollowup={handleAskAnomalyFollowup}
            onDismiss={handleDismissAnomaly}
          />

          {turns.length === 0 && !loading && !error && (
            <EmptyState onPick={handleStarterClick} disabled={loading} />
          )}

          {turns.map((t, i) => (
            <TurnBubble
              key={i}
              turn={t}
              markdownComponents={markdownComponents}
              // Phase 6.3 — chip taps re-enter the same submit pipeline
              // as the input box. Disable while loading to avoid double-
              // submits from a fast-tapping user.
              onFollowupClick={loading ? undefined : submitText}
              // Phase 7.3 — pass the user's prior turn's question to
              // each assistant TurnBubble so its tool cards can show
              // a Pin button targeting that question.
              originatingQuestion={priorUserQuestion(turns, i)}
              onPin={handlePin}
            />
          ))}

          {loading && <TypingBubble />}

          <div ref={messagesEndRef} />
        </div>
      ) : (
        <PinnedTab
          pinned={pinned}
          loading={pinnedLoading}
          error={pinnedError}
          onTap={handlePinnedTap}
          onUnpin={handleUnpin}
        />
      )}

      {/* Inline error — sits ABOVE the input so the user sees it before
          re-typing. Only shown on the Chat tab; Pinned tab has its
          own inline error state. */}
      {activeTab === "chat" && error && (
        <div className="mt-3 bg-red-900/30 border border-red-700/60 rounded-lg px-3 py-2 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-300 leading-relaxed">{error}</p>
        </div>
      )}

      {/* Active range chip — only renders when the most recent assistant
          turn invoked a tool with a `range` arg. Tells the shop owner
          what time window their next follow-up will reuse by default.
          Hidden on the Pinned tab. */}
      {activeTab === "chat" && activeRange && (
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

      {/* Input row — hidden on Pinned tab. Tapping a pinned row
          flips back to Chat tab automatically (handlePinnedTap) so
          the input reappears with the submitted question already
          flowing through the pipeline. */}
      {activeTab === "chat" && (
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
      )}

      {activeTab === "chat" && (
        <p className="mt-2 text-[10px] text-gray-600 text-center">
          Answers are based on your shop&apos;s live data. The assistant
          can only see your own shop.
        </p>
      )}
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
  /**
   * Phase 6.3 — chip tap handler. Threaded through to
   * InsightsToolCallCard so `follow_ups`-kind cards can submit chips
   * as new user messages. Undefined while a request is in flight to
   * avoid double-submits.
   */
  onFollowupClick?: (question: string) => void;
  /**
   * Phase 7.3 — the user question that triggered this assistant
   * turn. Used by the card-level Pin button. Undefined for user
   * turns (no card on them) or when this is somehow the first turn.
   */
  originatingQuestion?: string;
  /** Phase 7.3 — Pin button click handler. Undefined skips the button. */
  onPin?: (questionText: string) => Promise<void>;
}> = ({
  turn,
  markdownComponents,
  onFollowupClick,
  originatingQuestion,
  onPin,
}) => {
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
  // underneath. follow_ups cards render as inline chip rows rather
  // than bordered data cards (see InsightsToolCallCard).
  //
  // Belt + suspenders: when a follow_ups toolCall is present in this
  // turn, strip a trailing in-prose chip list before rendering.
  // Primary defense is the prompt rule under InsightsPromptBuilder
  // rule #11; this guard catches the occasional leak where Claude
  // re-lists the chips in the bubble (would render the same questions
  // twice — once as flat text, once as the tappable chip row below).
  const hasFollowupsCard = turn.toolCalls.some(
    (tc) => tc.display?.kind === "follow_ups"
  );
  const renderedContent = hasFollowupsCard
    ? stripTrailingFollowupList(turn.content)
    : turn.content;

  return (
    <div className="flex justify-start flex-col items-start gap-2">
      <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm break-words bg-[#1A1A1A] border border-gray-800 text-gray-200">
        <ReactMarkdown components={markdownComponents}>
          {renderedContent}
        </ReactMarkdown>
      </div>
      {turn.toolCalls.length > 0 && (
        <div className="w-full max-w-[85%] space-y-2">
          {turn.toolCalls.map((tc, i) => (
            <InsightsToolCallCard
              key={i}
              toolCall={tc}
              onFollowupClick={onFollowupClick}
              originatingQuestion={originatingQuestion}
              onPin={onPin}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Strip a trailing bullet/numbered list from an assistant reply when
 * a `follow_ups` card is going to render the same questions as chips
 * below. The prompt explicitly forbids in-prose listing, so this only
 * fires on the rare leak. Conservative on multiple axes:
 *
 *  - Only operates on the TAIL of the content; lists in the middle
 *    are left alone.
 *  - Only strips when the trailing list *looks like* follow-up
 *    questions (majority of items end with `?`) — preventing
 *    accidental removal of legitimate label:value data lists like
 *    `- Completed: 5\n- Cancelled: 1` from bookings_breakdown.
 *  - Optional preamble line is only dropped when it ends with `:`
 *    AND contains a follow-up keyword (follow-up / next / more / …).
 *
 * Exported for ad-hoc testing in browser devtools if needed.
 */
export function stripTrailingFollowupList(content: string): string {
  if (!content) return content;

  const lines = content.split("\n");
  let end = lines.length - 1;

  // Skip trailing blank lines.
  while (end >= 0 && lines[end].trim() === "") end--;
  if (end < 0) return content;

  // Walk backwards while lines are list items.
  let listStart = end;
  while (listStart > 0 && isMarkdownListItem(lines[listStart - 1])) {
    listStart--;
  }
  // If the line at listStart isn't itself a list item, no trailing list.
  if (!isMarkdownListItem(lines[listStart])) return content;

  // Bail out if the trailing list doesn't look like follow-up
  // questions. Real chip questions end with `?`; data lists are
  // label:value pairs that don't.
  const items = lines.slice(listStart, end + 1);
  if (!looksLikeFollowupQuestions(items)) return content;

  // Optional preamble line above the list.
  let cutPoint = listStart;
  while (cutPoint > 0 && lines[cutPoint - 1].trim() === "") cutPoint--;
  if (cutPoint > 0 && isFollowupPreamble(lines[cutPoint - 1])) {
    cutPoint--;
  }

  return lines.slice(0, cutPoint).join("\n").replace(/\s+$/, "");
}

function isMarkdownListItem(line: string): boolean {
  return /^[ \t]*(?:[-*•+]|\d+\.)\s+\S/.test(line);
}

function looksLikeFollowupQuestions(items: string[]): boolean {
  if (items.length === 0) return false;
  let questionCount = 0;
  for (const item of items) {
    const text = item.replace(/^[ \t]*(?:[-*•+]|\d+\.)\s+/, "").trim();
    if (text.endsWith("?")) questionCount++;
  }
  // Majority-ends-in-? heuristic. With Claude's typical 2-3 follow-up
  // chips, this is 2/2, 2/3, or 3/3 — never a tie with label:value
  // rows which have 0 question marks.
  return questionCount / items.length >= 0.5;
}

function isFollowupPreamble(line: string): boolean {
  if (!/:\s*$/.test(line)) return false;
  return /\b(follow.?up|next|more|consider|might|could|also|here are|you can ask|questions?)\b/i.test(
    line
  );
}

/**
 * Find the most recent user-turn content BEFORE `assistantIndex`.
 * Returns undefined if no preceding user turn (shouldn't happen in
 * practice — the alternation contract guarantees it). Used by
 * Pin button plumbing.
 */
function priorUserQuestion(turns: Turn[], assistantIndex: number): string | undefined {
  for (let i = assistantIndex - 1; i >= 0; i--) {
    if (turns[i].role === "user") return turns[i].content;
  }
  return undefined;
}

// ---------- Phase 7.3 — tab switcher + pinned tab body ----------

const TabSwitcher: React.FC<{
  active: TabKey;
  onChange: (next: TabKey) => void;
  pinnedCount: number;
}> = ({ active, onChange, pinnedCount }) => (
  <div
    role="tablist"
    aria-label="Insights panel sections"
    className="flex border-b border-gray-800"
  >
    <TabButton
      isActive={active === "chat"}
      onClick={() => onChange("chat")}
      icon={<MessageSquare className="w-3.5 h-3.5" />}
      label="Chat"
    />
    <TabButton
      isActive={active === "pinned"}
      onClick={() => onChange("pinned")}
      icon={<Pin className="w-3.5 h-3.5" />}
      label="Pinned"
      badge={pinnedCount > 0 ? pinnedCount : undefined}
    />
  </div>
);

const TabButton: React.FC<{
  isActive: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}> = ({ isActive, onClick, icon, label, badge }) => (
  <button
    type="button"
    role="tab"
    aria-selected={isActive}
    onClick={onClick}
    className={`flex items-center gap-1.5 text-xs px-3 py-2 border-b-2 -mb-px transition-colors ${
      isActive
        ? "border-[#FFCC00] text-white"
        : "border-transparent text-gray-400 hover:text-gray-200"
    }`}
  >
    {icon}
    <span>{label}</span>
    {badge !== undefined && (
      <span className="ml-1 rounded-full bg-[#FFCC00]/20 text-[#FFCC00] text-[10px] px-1.5 py-0.5 tabular-nums">
        {badge}
      </span>
    )}
  </button>
);

const PinnedTab: React.FC<{
  pinned: PinnedQuery[];
  loading: boolean;
  error: string | null;
  onTap: (p: PinnedQuery) => void;
  onUnpin: (id: string) => void;
}> = ({ pinned, loading, error, onTap, onUnpin }) => {
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 text-sm mt-3">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        Loading pinned questions…
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex-1 mt-3 bg-red-900/30 border border-red-700/60 rounded-lg px-3 py-2 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-red-300 leading-relaxed">{error}</p>
      </div>
    );
  }
  if (pinned.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-500 mt-6 px-4">
        <Pin className="w-8 h-8 text-gray-700 mb-2" />
        <p className="text-sm text-gray-300 mb-1">No pinned questions yet.</p>
        <p className="text-xs text-gray-500">
          Ask a question in the Chat tab, then tap{" "}
          <span className="text-gray-300">Pin</span> on the answer to save it
          here.
        </p>
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-y-auto pr-1 mt-3 space-y-2" role="tabpanel">
      {pinned.map((p) => (
        <PinnedRow key={p.id} pinned={p} onTap={onTap} onUnpin={onUnpin} />
      ))}
    </div>
  );
};

const PinnedRow: React.FC<{
  pinned: PinnedQuery;
  onTap: (p: PinnedQuery) => void;
  onUnpin: (id: string) => void;
}> = ({ pinned, onTap, onUnpin }) => (
  <div className="group relative rounded-lg bg-[#1A1A1A] border border-gray-800 hover:border-gray-700 transition-colors">
    <button
      type="button"
      onClick={() => onTap(pinned)}
      className="w-full text-left px-3 py-2.5 pr-9"
      aria-label={`Re-run: ${pinned.questionText}`}
    >
      <p className="text-sm text-gray-100 break-words">{pinned.questionText}</p>
      {pinned.lastRunAt && (
        <p className="text-[10px] text-gray-500 mt-1">
          Last run {formatRelative(pinned.lastRunAt)}
          {pinned.lastResponseExcerpt && (
            <span className="ml-1 text-gray-400">
              — {truncate(pinned.lastResponseExcerpt, 80)}
            </span>
          )}
        </p>
      )}
    </button>
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onUnpin(pinned.id);
      }}
      title="Unpin"
      aria-label="Unpin this question"
      className="absolute top-2 right-2 p-1 rounded-md text-gray-500 hover:text-red-400 hover:bg-gray-800 transition-colors"
    >
      <X className="w-3.5 h-3.5" />
    </button>
  </div>
);

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "just now";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

const TypingBubble: React.FC = () => (
  <div className="flex justify-start">
    <div className="bg-[#1A1A1A] border border-gray-800 text-gray-400 rounded-lg px-3 py-2 text-sm flex items-center gap-2">
      <Loader2 className="w-4 h-4 animate-spin" />
      <span>Thinking…</span>
    </div>
  </div>
);
