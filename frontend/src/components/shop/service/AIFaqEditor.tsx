"use client";

import React from "react";
import { HelpCircle, Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";

/**
 * AIFaqEditor
 *
 * Q&A list editor for the AI Sales Assistant section. Shop owners answer
 * the questions their customers ask most often; the AI agent quotes from
 * these entries when responding to customers in chat (alongside the
 * service description). Lives inline in the service create/edit form.
 *
 * UX design choices (per the AI Knowledge Base strategy doc):
 *  - Ship with **starter questions** pre-populated so shop owners never
 *    face a blank textarea. They fill in the ones that apply, delete the
 *    rest, add custom ones via "+ Add another question".
 *  - Empty answers are stripped at submit time so starter placeholders
 *    that the shop owner left blank don't persist as half-filled rows.
 *  - Reorder via up/down arrows (drag-and-drop deferred to a future
 *    iteration). Order maps directly to the AI prompt's render order.
 *  - Question + answer fields are plain text inputs/textareas with char
 *    counters near the cap so shop owners aren't surprised by validation
 *    errors at submit time.
 *
 * Controlled component: parent owns the array, this component just renders
 * + emits changes via `onChange`. Caller is responsible for sanitization
 * at submit (the backend's sanitizeFaqEntries is the source of truth).
 */

export interface FaqEntry {
  question: string;
  answer: string;
}

export interface AIFaqEditorProps {
  /** Current list of Q&A entries. */
  value: FaqEntry[];
  /** Called on every entry edit, add, delete, or reorder. */
  onChange: (next: FaqEntry[]) => void;
  /** Disable the editor (e.g., when the AI toggle is off). */
  disabled?: boolean;
}

/**
 * Six starter questions covering the topics customers most commonly ask
 * a shop owner. Used to seed the editor when the service has no
 * existing FAQ entries (new service create, or existing service that
 * hasn't been populated yet). Shop owner fills in the ones that
 * apply, deletes the rest. Answers start empty.
 */
const STARTER_QUESTIONS: string[] = [
  "What's included in this service?",
  "What's NOT included?",
  "How long does a typical appointment take?",
  "What should I bring or prepare?",
  "Is this suitable for kids, beginners, or specific situations?",
  "What's your cancellation or reschedule policy?",
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
}) => {
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

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <HelpCircle className="w-4 h-4 text-violet-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
        <div>
          <h4 className="text-sm font-semibold text-white">
            Customer questions the AI should answer
          </h4>
          <p className="text-xs text-gray-400 mt-0.5">
            Answer the questions your customers ask most often. The AI will
            quote from these directly. Leave any blank and the AI falls
            back to your service description.
          </p>
        </div>
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

      <button
        type="button"
        onClick={add}
        disabled={disabled}
        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm text-violet-300 bg-violet-500/10 border border-dashed border-violet-400/40 hover:border-violet-300 hover:bg-violet-500/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Plus className="w-4 h-4" aria-hidden="true" />
        Add another question
      </button>
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

  return (
    <div className="bg-[#0F0F0F] border border-gray-800 rounded-lg p-3 space-y-2">
      <div className="flex items-start gap-2">
        <span className="text-xs text-gray-500 font-medium mt-2 flex-shrink-0 w-4 text-right">
          {index + 1}.
        </span>
        <input
          type="text"
          value={entry.question}
          maxLength={MAX_QUESTION}
          placeholder="What question do customers ask?"
          disabled={disabled}
          onChange={(e) => onChange({ question: e.target.value })}
          className="flex-1 bg-[#1A1A1A] border border-gray-700 focus:border-violet-400 focus:outline-none rounded-md px-3 py-2 text-sm text-white placeholder-gray-500 disabled:opacity-50"
        />
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={disabled || isFirst}
            aria-label="Move up"
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronUp className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={disabled || isLast}
            aria-label="Move down"
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded disabled:opacity-30 disabled:cursor-not-allowed"
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
          placeholder="Type the answer here. Plain text — bullet lists are fine."
          disabled={disabled}
          rows={3}
          onChange={(e) => onChange({ answer: e.target.value })}
          className="w-full bg-[#1A1A1A] border border-gray-700 focus:border-violet-400 focus:outline-none rounded-md px-3 py-2 text-sm text-white placeholder-gray-500 resize-y disabled:opacity-50"
        />
        {(answerNearCap || answerOverCap) && (
          <div
            className={`text-[11px] mt-1 ${
              answerOverCap ? "text-red-400" : "text-yellow-400"
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
