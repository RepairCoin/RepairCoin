"use client";

import React, { KeyboardEvent, useRef, useState, useEffect } from "react";
import { Loader2, Send, AlertCircle, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import {
  askPlatformCopilot,
  PLATFORM_COPILOT_LIMITS,
} from "@/services/api/platformCopilot";
import type { InsightsMessage, InsightsToolCall } from "@/services/api/aiInsights";
import { InsightsToolCallCard } from "@/components/shop/insights/InsightsToolCallCard";

/**
 * Platform Health Copilot — admin "ask the platform" chat (Admin AI #2).
 * Platform-wide analog of the shop Insights panel; reuses the same tool-call
 * card rendering. Chat-only (no pinned/anomaly — those are shop-scoped).
 */
const STARTERS: readonly string[] = [
  "Give me a platform overview",
  "RCN issued vs redeemed this month",
  "How healthy are shop subscriptions?",
  "Show the RCG tier distribution",
] as const;

type Turn =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls: InsightsToolCall[] };

export const PlatformCopilotPanel: React.FC = () => {
  const [sessionId] = useState(() =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `copilot_${Math.random().toString(36).slice(2)}_${Date.now()}`
  );
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns.length, loading]);

  const toWire = (ts: Turn[]): InsightsMessage[] =>
    ts.map((t) => ({ role: t.role, content: t.content.trim() || " " }));

  const submit = async (raw: string) => {
    const text = raw.trim();
    if (!text || loading) return;
    if (turns.length >= PLATFORM_COPILOT_LIMITS.maxMessages) {
      setError("Conversation limit reached — reload to start fresh.");
      return;
    }
    const next: Turn[] = [...turns, { role: "user", content: text }];
    setTurns(next);
    setInput("");
    setLoading(true);
    setError(null);
    try {
      const res = await askPlatformCopilot(sessionId, toWire(next));
      setTurns([
        ...next,
        { role: "assistant", content: res.reply, toolCalls: res.toolCalls ?? [] },
      ]);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(
        status === 429
          ? "AI budget exhausted. Try again later."
          : status === 503
            ? "AI service temporarily unavailable."
            : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(input);
    }
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-220px)] min-h-[420px]">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-5 h-5 text-[#FFCC00]" />
        <h2 className="text-xl font-bold text-white">Platform Copilot</h2>
        <span className="text-xs text-gray-500">Ask about the whole platform</span>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 space-y-3" aria-live="polite">
        {turns.length === 0 && !loading && (
          <div className="py-8">
            <p className="text-sm text-gray-300 mb-1 text-center">Ask about the platform.</p>
            <p className="text-xs text-gray-500 mb-4 text-center">Or tap a starter:</p>
            <div className="max-w-md mx-auto space-y-2">
              {STARTERS.map((q) => (
                <button
                  key={q}
                  onClick={() => submit(q)}
                  className="w-full text-left text-xs text-gray-300 bg-[#1A1A1A] border border-gray-700 hover:border-[#FFCC00] hover:text-white rounded-lg px-3 py-2 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((t, i) =>
          t.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words bg-[#FFCC00] text-black">
                {t.content}
              </div>
            </div>
          ) : (
            <div key={i} className="flex flex-col items-start gap-2">
              {/[a-zA-Z0-9]/.test(t.content) && (
                <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm break-words bg-[#1A1A1A] border border-gray-800 text-gray-200 prose-sm">
                  <ReactMarkdown>{t.content}</ReactMarkdown>
                </div>
              )}
              {t.toolCalls.length > 0 && (
                <div className="w-full max-w-[85%] space-y-2">
                  {t.toolCalls.map((tc, j) => (
                    <InsightsToolCallCard key={j} toolCall={tc} />
                  ))}
                </div>
              )}
            </div>
          )
        )}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-[#1A1A1A] border border-gray-800 text-gray-400 rounded-lg px-3 py-2 text-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Thinking…
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <div className="mt-3 bg-red-900/30 border border-red-700/60 rounded-lg px-3 py-2 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      <div className="mt-3 flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          rows={2}
          maxLength={PLATFORM_COPILOT_LIMITS.maxContentChars}
          disabled={loading}
          placeholder="Ask about shops, customers, the token economy…"
          className="flex-1 bg-[#1A1A1A] border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#FFCC00] resize-none disabled:opacity-50"
        />
        <button
          onClick={() => submit(input)}
          disabled={!input.trim() || loading}
          className={`flex-shrink-0 p-2.5 rounded-lg transition-colors ${
            input.trim() && !loading
              ? "bg-[#FFCC00] text-black hover:bg-[#FFD700]"
              : "bg-[#1A1A1A] border border-gray-800 text-gray-600 cursor-not-allowed"
          }`}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};

export default PlatformCopilotPanel;
