"use client";

import React, {
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Loader2, Send, AlertCircle, ArrowLeft, BookOpen } from "lucide-react";
import ReactMarkdown, { Components } from "react-markdown";
import {
  askHelp,
  getHelpArticle,
  getHelpArticleIndex,
  HelpArticleFull,
  HelpArticleIndexEntry,
  HelpMessage,
  HELP_LIMITS,
} from "@/services/api/aiHelp";

/**
 * Suggested first-time-user questions. Each maps to an article in
 * docs/help/, chosen to cover the most common shop-onboarding paths.
 * Clicking a chip submits the question directly (Option B in v1 — no
 * intermediate "edit before sending" step).
 */
const STARTER_QUESTIONS: readonly string[] = [
  "How do I create a service?",
  "How do I set my appointment hours?",
  "How do I issue a reward to a customer?",
  "How does the subscription work?",
] as const;

/**
 * HelpAssistantPanel
 *
 * Multi-turn chat body for the shop-side How-To Assistant. Held entirely
 * in component state — no persistence between panel opens, intentional
 * per scope-doc decision 4 (no DB session in v1).
 *
 * Lifecycle:
 *   - `sessionId` minted once with `crypto.randomUUID()` per panel
 *     mount; reused across every call so backend audit rows group
 *     under one session.
 *   - `messages` is the source of truth. Each user submit appends a
 *     user turn, calls askHelp, and on success appends the assistant
 *     reply. Failures keep the user turn visible and surface an
 *     inline error banner — the user can retry without retyping.
 *
 * Phase 3.3 ships this baseline. Phase 3.4 will inject suggested
 * starter questions into the empty state.
 */
export const HelpAssistantPanel: React.FC = () => {
  const [sessionId] = useState(() =>
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `help_${Math.random().toString(36).slice(2)}_${Date.now()}`
  );
  const [messages, setMessages] = useState<HelpMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Article-expansion state. `articleIndex` is the title→filename map
  // fetched once on mount; `viewedArticle` switches the panel into
  // article-reading mode when set, restoring chat when cleared.
  const [articleIndex, setArticleIndex] = useState<HelpArticleIndexEntry[]>([]);
  const [viewedArticle, setViewedArticle] = useState<HelpArticleFull | null>(null);
  const [articleLoading, setArticleLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const articleScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message / typing indicator.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, loading]);

  // Focus the input on first render so the user can just start typing.
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // When an article opens (or the user clicks an inline cross-reference
  // and a NEW article replaces the current one), reset the article-view
  // scroll position to the top — otherwise React reuses the existing
  // scrollable div and the title is below the fold.
  useEffect(() => {
    if (viewedArticle && articleScrollRef.current) {
      articleScrollRef.current.scrollTop = 0;
    }
  }, [viewedArticle]);

  // Fetch the article index once on mount. Failure is non-fatal —
  // chat still works; "Related:" titles just stay non-clickable.
  useEffect(() => {
    let cancelled = false;
    getHelpArticleIndex()
      .then((idx) => {
        if (!cancelled) setArticleIndex(idx);
      })
      .catch((err) => {
        console.error("HelpAssistantPanel: failed to load article index", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleArticleClick = async (filename: string) => {
    if (articleLoading) return;
    setArticleLoading(true);
    setError(null);
    try {
      const article = await getHelpArticle(filename);
      setViewedArticle(article);
    } catch (err) {
      setError("Couldn't load that article. Please try again.");
      console.error("HelpAssistantPanel: failed to fetch article", err);
    } finally {
      setArticleLoading(false);
    }
  };

  const closeArticle = () => setViewedArticle(null);

  const atMessageLimit = messages.length >= HELP_LIMITS.maxMessages;

  /**
   * Core submit path used by both the manual send and the starter
   * question chips. Trims, validates, posts to the API, and updates
   * state — kept generic so click-to-submit on chips doesn't have to
   * deal with the input textarea's async state.
   */
  const submitText = async (rawText: string) => {
    if (loading) return;
    const text = rawText.trim();
    if (!text) return;

    if (atMessageLimit) {
      setError(
        `This conversation has reached the ${HELP_LIMITS.maxMessages}-message limit. Close and reopen the panel to start fresh.`
      );
      return;
    }
    if (text.length > HELP_LIMITS.maxContentChars) {
      setError(
        `Message is too long (max ${HELP_LIMITS.maxContentChars} characters).`
      );
      return;
    }

    const nextMessages: HelpMessage[] = [
      ...messages,
      { role: "user", content: text },
    ];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await askHelp(sessionId, nextMessages);
      setMessages([
        ...nextMessages,
        { role: "assistant", content: res.reply },
      ]);
    } catch (err) {
      // Keep the user's turn visible so they can retry without retyping.
      const ax = err as { response?: { status?: number; data?: { error?: string } }; message?: string };
      const status = ax?.response?.status;
      const detail = ax?.response?.data?.error;
      let msg: string;
      switch (status) {
        case 401:
          msg = "Your session has expired. Please log in again.";
          break;
        case 400:
          msg = detail || "We couldn't process that question. Try rephrasing it.";
          break;
        case 429:
          msg = detail || "AI budget exhausted for this month. Try again next month or contact RepairCoin support.";
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

  const handleSend = () => submitText(input);
  const handleStarterClick = (question: string) => submitText(question);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend =
    input.trim().length > 0 && !loading && !atMessageLimit;

  // Build markdown components once per render (cheap — closure over
  // articleIndex + handler refs that don't change often).
  const markdownComponents = useMemo(
    () =>
      buildMarkdownComponents(
        articleIndex,
        handleArticleClick,
        articleLoading
      ),
    // handleArticleClick is recreated each render but that's fine —
    // the closure captures the latest value via the inline lambda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [articleIndex, articleLoading]
  );

  // ----- Article-view mode -----
  if (viewedArticle) {
    return (
      <div className="flex-1 flex flex-col min-h-0 mt-6">
        <button
          type="button"
          onClick={closeArticle}
          className="self-start flex items-center gap-1.5 text-xs text-gray-400 hover:text-white mb-3 transition-colors"
          aria-label="Back to chat"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to chat
        </button>
        <div
          ref={articleScrollRef}
          className="flex-1 overflow-y-auto pr-1 text-sm text-gray-200 break-words"
        >
          <ReactMarkdown components={markdownComponents}>
            {viewedArticle.body}
          </ReactMarkdown>
        </div>
      </div>
    );
  }

  // ----- Chat mode -----
  return (
    <div className="flex-1 flex flex-col min-h-0 mt-6">
      {/* Messages list — scrolls within its own bounds so the input
          stays anchored at the bottom. */}
      <div
        className="flex-1 overflow-y-auto pr-1 space-y-3"
        aria-live="polite"
      >
        {messages.length === 0 && !loading && !error && (
          <EmptyState onPick={handleStarterClick} disabled={loading} />
        )}

        {messages.map((m, i) => (
          <MessageBubble
            key={i}
            message={m}
            articleIndex={articleIndex}
            onArticleClick={handleArticleClick}
            articleClickDisabled={articleLoading}
            markdownComponents={markdownComponents}
          />
        ))}

        {loading && <TypingBubble />}

        <div ref={messagesEndRef} />
      </div>

      {/* Inline error — sits ABOVE the input so the user sees it
          before re-typing. */}
      {error && (
        <div className="mt-3 bg-red-900/30 border border-red-700/60 rounded-lg px-3 py-2 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-300 leading-relaxed">{error}</p>
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
          maxLength={HELP_LIMITS.maxContentChars}
          disabled={loading || atMessageLimit}
          placeholder={
            atMessageLimit
              ? "Conversation full — close to start fresh"
              : "Ask a question…"
          }
          className="flex-1 bg-[#1A1A1A] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] transition-colors resize-none disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Ask the How-To Assistant"
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
        Answers come from the help articles only. The AI doesn't access your shop data.
      </p>
    </div>
  );
};

// ----- internals -----

const EmptyState: React.FC<{
  onPick: (question: string) => void;
  disabled: boolean;
}> = ({ onPick, disabled }) => (
  <div className="flex flex-col px-1 py-6">
    <p className="text-sm text-gray-300 mb-1 text-center">
      Ask how to use the dashboard.
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
 * Build the react-markdown component overrides. Closures over the
 * article index + click handler let inline `[…](filename.md)` links
 * become clickable buttons that open the matching corpus article.
 *
 * The visible text on those buttons is the ARTICLE TITLE (looked up
 * from the index), NOT whatever the corpus author wrote — articles
 * sometimes use raw filenames as link text and showing "purchase-rcn.md"
 * to a shop owner is ugly.
 */
function buildMarkdownComponents(
  articleIndex: HelpArticleIndexEntry[],
  onArticleClick: (filename: string) => void,
  articleClickDisabled: boolean
): Components {
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
    h1: ({ children }) => (
      <h1 className="text-base font-semibold text-white mt-2 mb-2">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-sm font-semibold text-white mt-3 mb-1">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-xs font-semibold text-white uppercase tracking-wide mt-2 mb-1">
        {children}
      </h3>
    ),
    p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
    ul: ({ children }) => (
      <ul className="list-disc list-outside ml-5 my-2 space-y-1">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-outside ml-5 my-2 space-y-1">{children}</ol>
    ),
    li: ({ children }) => <li className="text-sm leading-relaxed">{children}</li>,
    a: ({ href, children }) => {
      // .md links are corpus-internal cross references — render as
      // buttons that open the target article inside the panel.
      if (href && /\.md(#.*)?$/.test(href)) {
        const filename = href.replace(/^\.\//, "").split("#")[0];
        const found = articleIndex.find((e) => e.filename === filename);
        if (found) {
          return (
            <button
              type="button"
              onClick={() => onArticleClick(filename)}
              disabled={articleClickDisabled}
              className="inline-flex items-center gap-1 text-[#FFCC00] hover:text-[#FFD700] hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <BookOpen className="w-3 h-3" />
              {found.title}
            </button>
          );
        }
      }
      // External / unrecognized link — open in new tab.
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#FFCC00] hover:text-[#FFD700] underline"
        >
          {children}
        </a>
      );
    },
  };
}

/**
 * Pulls the `*Related: <title>, <title>*` footer off the assistant's
 * message (must be on its own line) and returns the body without it
 * + the parsed titles. Returns `{ body: <message>, titles: [] }` when
 * no footer is present.
 */
const RELATED_FOOTER_PATTERN = /\n+\*Related:\s*([^*\n]+?)\s*\*\s*$/;

function splitRelatedFooter(text: string): { body: string; titles: string[] } {
  const match = text.match(RELATED_FOOTER_PATTERN);
  if (!match) return { body: text, titles: [] };
  const titles = match[1]
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  return { body: text.slice(0, match.index).trimEnd(), titles };
}

/** Normalize a title for title→filename lookup (case- + punctuation- insensitive). */
function normalizeTitle(t: string): string {
  return t.trim().toLowerCase().replace(/[?.!,]+$/g, "").replace(/\s+/g, " ");
}

function findFilenameForTitle(
  index: HelpArticleIndexEntry[],
  title: string
): string | null {
  const target = normalizeTitle(title);
  return index.find((e) => normalizeTitle(e.title) === target)?.filename ?? null;
}

const MessageBubble: React.FC<{
  message: HelpMessage;
  articleIndex: HelpArticleIndexEntry[];
  onArticleClick: (filename: string) => void;
  articleClickDisabled: boolean;
  markdownComponents: Components;
}> = ({
  message,
  articleIndex,
  onArticleClick,
  articleClickDisabled,
  markdownComponents,
}) => {
  const isUser = message.role === "user";

  // User messages are plain text — they typed it, no markdown rendering.
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words bg-[#FFCC00] text-black">
          {message.content}
        </div>
      </div>
    );
  }

  const { body, titles } = splitRelatedFooter(message.content);

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm break-words bg-[#1A1A1A] border border-gray-800 text-gray-200">
        <ReactMarkdown components={markdownComponents}>{body}</ReactMarkdown>
        {titles.length > 0 && (
          <div className="mt-3 pt-2 border-t border-gray-800 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] uppercase tracking-wide text-gray-500 mr-1">
              Related:
            </span>
            {titles.map((title) => {
              const filename = findFilenameForTitle(articleIndex, title);
              if (!filename) {
                return (
                  <em key={title} className="text-[11px] text-gray-400">
                    {title}
                  </em>
                );
              }
              return (
                <button
                  key={title}
                  type="button"
                  onClick={() => onArticleClick(filename)}
                  disabled={articleClickDisabled}
                  className="inline-flex items-center gap-1 text-[11px] text-[#FFCC00] hover:text-[#FFD700] hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <BookOpen className="w-3 h-3" />
                  {title}
                </button>
              );
            })}
          </div>
        )}
      </div>
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
