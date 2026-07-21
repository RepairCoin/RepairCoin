"use client";

import React, { useState } from "react";
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Loader2,
  Lightbulb,
} from "lucide-react";
import {
  getServiceFaqSuggestions,
  type FaqSuggestion,
} from "@/services/api/aiFaqSuggestions";

/**
 * AIFaqEditor
 *
 * Q&A list editor for the AI Sales Assistant section. Shop owners answer
 * the questions their customers ask most often; the AI agent quotes from
 * these entries when responding to customers in chat (alongside the
 * service description). Lives inline in the service create/edit form.
 *
 * Styled for the DARK card it sits in (the "Auto Sales & Booking" panel) —
 * green heading to match "See How the AI Replies", dark inputs.
 *
 * Controlled component: parent owns the array, this component just renders
 * + emits changes via `onChange`. Caller is responsible for sanitization
 * at submit (the backend's sanitizeFaqEntries is the source of truth).
 */

export interface FaqEntry {
  question: string;
  answer: string;
  /**
   * Transient "what to write here" guide carried in from an AI suggestion.
   * Used only as the answer textarea's placeholder while the answer is
   * blank — it is NOT persisted (the service-form save sends only
   * question + answer).
   */
  answerHint?: string;
}

export interface AIFaqEditorProps {
  /** Current list of Q&A entries. */
  value: FaqEntry[];
  /** Called on every entry edit, add, delete, or reorder. */
  onChange: (next: FaqEntry[]) => void;
  /** Disable the editor (e.g., when the AI toggle is off). */
  disabled?: boolean;
  /**
   * The service being edited. Required for "Suggest with AI" — the
   * suggestion endpoint is per-service. Absent on the new-service create
   * flow (service not saved yet), where the suggest button shows a hint
   * instead.
   */
  serviceId?: string;
  /**
   * The LIVE description from the service edit form (possibly unsaved).
   * Passed to the suggest call so "add detail to your description" takes
   * effect immediately, without the shop having to save first.
   */
  description?: string;
}

/**
 * A single starter question to seed the editor when a service has no FAQ
 * entries yet — just enough that the shop owner sees the Q&A shape and
 * isn't staring at an empty panel. Was six starters originally; trimmed to
 * one once "Suggest questions with AI" shipped — the AI now does the
 * heavy lifting of proposing service-specific questions, so a long static
 * starter list is redundant clutter.
 */
const STARTER_QUESTIONS: string[] = [
  "What's included in this service?",
];

const MAX_QUESTION = 300;
const MAX_ANSWER = 2000;

export function buildStarterEntries(): FaqEntry[] {
  return STARTER_QUESTIONS.map((q) => ({ question: q, answer: "" }));
}

export const AIFaqEditor: React.FC<AIFaqEditorProps> = ({
  value,
  onChange,
  disabled,
  serviceId,
  description,
}) => {
  // AI suggestion state.
  const [suggestions, setSuggestions] = useState<FaqSuggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState("");
  // Soft "mostly blank" nudge, shown alongside results.
  const [suggestNotice, setSuggestNotice] = useState("");
  // Optional pasted source material + its collapse state.
  const [sourceText, setSourceText] = useState("");
  const [sourceOpen, setSourceOpen] = useState(false);

  const update = (idx: number, patch: Partial<FaqEntry>) => {
    const next = value.slice();
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  const remove = (idx: number) => {
    const next = value.filter((_, i) => i !== idx);
    onChange(next);
  };

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= value.length) return;
    const next = value.slice();
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const add = () => {
    onChange([...value, { question: "", answer: "" }]);
  };

  const handleSuggest = async () => {
    if (!serviceId || suggestLoading) return;
    setSuggestLoading(true);
    setSuggestError("");
    setSuggestNotice("");
    try {
      const result = await getServiceFaqSuggestions(
        serviceId,
        sourceText,
        description
      );
      if (result.overBudget) {
        setSuggestions([]);
        setSuggestError(
          "Your shop's monthly AI budget is used up — suggestions are paused until it resets."
        );
        return;
      }
      // Drop anything the editor already has (covers entries added in this
      // form session that the server hasn't seen yet).
      const have = new Set(
        value.map((e) => e.question.trim().toLowerCase()).filter(Boolean)
      );
      const fresh = result.suggestions.filter(
        (s) => s.question.trim() && !have.has(s.question.trim().toLowerCase())
      );
      setSuggestions(fresh);
      if (fresh.length === 0) {
        setSuggestError(
          "No new questions to suggest — your FAQ already covers the common ones."
        );
        return;
      }
      // Soft nudge when the AI couldn't draft most of the answers — more
      // source material would let it draft more.
      const blank = fresh.filter((s) => !s.answer.trim()).length;
      if (blank / fresh.length >= 0.6) {
        setSuggestNotice(
          sourceText.trim()
            ? "Most answers still came back blank — add more detail to your service description for richer drafts."
            : 'Most answers came back blank. Add a service description, or paste notes via "Add source material" below, and the AI can draft the answers too.'
        );
      }
    } catch (err) {
      setSuggestError(
        err instanceof Error
          ? err.message
          : "Couldn't generate suggestions. Please try again."
      );
    } finally {
      setSuggestLoading(false);
    }
  };

  const acceptSuggestion = (idx: number) => {
    const s = suggestions[idx];
    if (!s) return;
    onChange([
      ...value,
      { question: s.question, answer: s.answer, answerHint: s.answerHint },
    ]);
    setSuggestions(suggestions.filter((_, i) => i !== idx));
  };

  const dismissSuggestion = (idx: number) => {
    setSuggestions(suggestions.filter((_, i) => i !== idx));
  };

  const acceptAllSuggestions = () => {
    onChange([
      ...value,
      ...suggestions.map((s) => ({
        question: s.question,
        answer: s.answer,
        answerHint: s.answerHint,
      })),
    ]);
    setSuggestions([]);
  };

  return (
    <div className="space-y-3">
      {/* Heading — matches the "See How the AI Replies" heading style. */}
      <div>
        <h4 className="text-sm font-semibold text-green-400">
          Customer questions the AI should answer
        </h4>
        <p className="text-sm text-gray-400 mt-1">
          Answer the questions your customers ask most often — the AI quotes
          from these directly when chatting with customers. Leave an answer
          blank and the AI falls back to your service description.
        </p>
      </div>

      {/* Tip — boxed, with an icon, so it reads as guidance not body text. */}
      <div className="flex items-start gap-2 border border-amber-500/30 bg-amber-500/10 rounded-lg px-3 py-2">
        <Lightbulb
          className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <p className="text-xs text-amber-300">
          Price and duration already have their own fields — you don&apos;t
          need FAQ entries for those. Keeping them out avoids a stale answer
          if you change the price later.
        </p>
      </div>

      <div className="space-y-3">
        {value.map((entry, idx) => (
          <FaqEntryRow
            key={idx}
            index={idx}
            total={value.length}
            entry={entry}
            disabled={disabled}
            onChange={(patch) => update(idx, patch)}
            onRemove={() => remove(idx)}
            onMoveUp={() => move(idx, -1)}
            onMoveDown={() => move(idx, 1)}
          />
        ))}
      </div>

      {/* AI suggestion review list — drafts only, nothing saved until the
          shop adds an entry and saves the service form. */}
      {suggestions.length > 0 && (
        <div className="border border-green-500/30 bg-green-500/10 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-green-300">
              AI suggestions — review before adding
            </span>
            <button
              type="button"
              onClick={acceptAllSuggestions}
              disabled={disabled}
              className="text-xs font-medium text-green-400 hover:text-green-300 disabled:opacity-50"
            >
              Add all
            </button>
          </div>
          {suggestions.map((s, idx) => (
            <div
              key={idx}
              className="bg-[#1A1A1A] border border-gray-700 rounded-md p-2.5"
            >
              <p className="text-sm text-white font-medium">{s.question}</p>
              {s.answer ? (
                <p className="text-xs text-gray-400 mt-1">{s.answer}</p>
              ) : s.answerHint ? (
                <p className="text-xs text-amber-400 mt-1">
                  <span className="italic">You&apos;ll write this — </span>
                  {s.answerHint}
                </p>
              ) : (
                <p className="text-xs text-amber-400 mt-1 italic">
                  Answer left blank — you&apos;ll write this one in.
                </p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => acceptSuggestion(idx)}
                  disabled={disabled}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-green-300 bg-green-500/15 hover:bg-green-500/25 rounded disabled:opacity-50"
                >
                  <Plus className="w-3 h-3" aria-hidden="true" />
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => dismissSuggestion(idx)}
                  className="px-2.5 py-1 text-xs text-gray-400 hover:text-gray-200"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {suggestNotice && (
        <div className="flex items-start gap-2 border border-amber-500/30 bg-amber-500/10 rounded-lg px-3 py-2">
          <Lightbulb
            className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <p className="text-xs text-amber-300">{suggestNotice}</p>
        </div>
      )}

      {suggestError && <p className="text-sm text-gray-400">{suggestError}</p>}

      {/* Optional pasted source material — feeds the AI extra facts to draft
          answers from. Collapsed by default; transient (never stored). */}
      {serviceId && (
        <div>
          <button
            type="button"
            onClick={() => setSourceOpen((o) => !o)}
            className="inline-flex items-center gap-1 text-xs font-medium text-green-400 hover:text-green-300"
          >
            {sourceOpen ? (
              <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            Add source material (optional)
          </button>
          {sourceOpen && (
            <div className="mt-2">
              <textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                disabled={disabled}
                rows={4}
                maxLength={4000}
                placeholder="Paste anything about this service — notes, your website copy, a flyer. The AI will draft FAQ answers from it."
                className="w-full bg-[#1A1A1A] border border-gray-700 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none rounded-md px-3 py-2 text-sm text-white placeholder-gray-500 resize-y disabled:opacity-60 disabled:bg-[#0D0D0D]"
              />
              <p className="mt-1 text-[11px] text-gray-500">
                Used only to improve the suggestions below — it isn&apos;t
                saved. {sourceText.length}/4000
              </p>
            </div>
          )}
        </div>
      )}

      {/* Action buttons — high-contrast so they read clearly on the dark
          card. "Suggest" is the primary (solid green); "Add" is secondary. */}
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={handleSuggest}
          disabled={disabled || suggestLoading || !serviceId}
          title={
            !serviceId
              ? "Save the service first to get AI suggestions"
              : undefined
          }
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {suggestLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="w-4 h-4" aria-hidden="true" />
          )}
          {suggestLoading ? "Generating…" : "Suggest questions with AI"}
        </button>

        <button
          type="button"
          onClick={add}
          disabled={disabled}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium text-gray-300 bg-[#1A1A1A] border border-gray-700 hover:bg-[#262626] hover:border-gray-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Add another question
        </button>
      </div>
      {!serviceId && (
        <p className="text-xs text-gray-500 -mt-1">
          Save the service to unlock AI-suggested questions.
        </p>
      )}
    </div>
  );
};

interface FaqEntryRowProps {
  index: number;
  total: number;
  entry: FaqEntry;
  disabled?: boolean;
  onChange: (patch: Partial<FaqEntry>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const FaqEntryRow: React.FC<FaqEntryRowProps> = ({
  index,
  total,
  entry,
  disabled,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}) => {
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const answerLen = entry.answer.length;
  const answerNearCap = answerLen > MAX_ANSWER * 0.9;
  const answerOverCap = answerLen > MAX_ANSWER;
  // When this row came from an AI suggestion with a blank answer, the
  // hint guides the shop owner on what to write here.
  const answerPlaceholder = entry.answerHint
    ? `Suggested — ${entry.answerHint}`
    : "Type the answer here. Plain text — bullet lists are fine.";

  return (
    <div className="bg-[#0D0D0D] border border-gray-700 rounded-lg p-3 space-y-2">
      <div className="flex items-start gap-2">
        <span className="text-xs text-gray-400 font-medium mt-2.5 flex-shrink-0 w-4 text-right">
          {index + 1}.
        </span>
        <input
          type="text"
          value={entry.question}
          maxLength={MAX_QUESTION}
          placeholder="What question do customers ask?"
          disabled={disabled}
          onChange={(e) => onChange({ question: e.target.value })}
          className="flex-1 bg-[#1A1A1A] border border-gray-700 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none rounded-md px-3 py-2 text-sm text-white placeholder-gray-500 disabled:opacity-60 disabled:bg-[#0D0D0D]"
        />
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={disabled || isFirst}
            aria-label="Move up"
            className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#262626] rounded disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronUp className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={disabled || isLast}
            aria-label="Move down"
            className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#262626] rounded disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronDown className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            aria-label="Remove question"
            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="pl-6">
        <textarea
          value={entry.answer}
          placeholder={answerPlaceholder}
          disabled={disabled}
          rows={3}
          onChange={(e) => onChange({ answer: e.target.value })}
          className="w-full bg-[#1A1A1A] border border-gray-700 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none rounded-md px-3 py-2 text-sm text-white placeholder-gray-500 resize-y disabled:opacity-60 disabled:bg-[#0D0D0D]"
        />
        {(answerNearCap || answerOverCap) && (
          <div
            className={`text-[11px] mt-1 ${
              answerOverCap ? "text-red-400" : "text-amber-400"
            }`}
          >
            {answerLen} / {MAX_ANSWER} characters
            {answerOverCap && " — over the limit, will be rejected on save"}
          </div>
        )}
      </div>
    </div>
  );
};
