"use client";

import React, { useState } from "react";
import { Bot, ChevronDown, ChevronUp, Check, Sparkles } from "lucide-react";
import { AI_PREVIEW_MOCKS, AITone } from "@/utils/aiPreviewMocks";

/**
 * AISalesAssistantSection
 *
 * Phase 1 visual-only AI Sales Assistant section for the service create/edit
 * page. Matches `sc1.jpeg` shape (master toggle, tone segmented control,
 * "See How the AI Replies" expandable preview, plus upsell + booking-
 * assistance checkboxes).
 *
 * Visual treatment: light/white card with a green-tinted shadow + "NEW"
 * badge so it stands out from the rest of the dark form sections. The
 * section is a deliberate "this is a new feature, look at me" surface
 * rather than blending into the form.
 *
 * State is fully controlled by the parent — no internal persistence, no
 * backend calls. Sample replies come from `aiPreviewMocks.ts` (hardcoded
 * per tone) until Phase 3 wires up live Anthropic API previews.
 *
 * The bottom-of-section disclosure note ("AI features ship soon...") makes
 * it explicit to shop owners that toggle state is configured now but not
 * yet wired to live AI behavior. Remove that line once Phase 3 ships.
 */

export interface AISalesAssistantSectionProps {
  enabled: boolean;
  tone: AITone;
  suggestUpsells: boolean;
  enableBookingAssistance: boolean;
  onChange: (changes: Partial<Omit<AISalesAssistantSectionProps, "onChange">>) => void;
}

const TONE_OPTIONS: { value: AITone; label: string }[] = [
  { value: "friendly", label: "Friendly" },
  { value: "professional", label: "Professional" },
  { value: "urgent", label: "Urgent" },
];

export const AISalesAssistantSection: React.FC<AISalesAssistantSectionProps> = ({
  enabled,
  tone,
  suggestUpsells,
  enableBookingAssistance,
  onChange,
}) => {
  const [previewOpen, setPreviewOpen] = useState(true);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-lg shadow-green-500/10">
      {/* Header — light treatment with NEW badge */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Bot className="w-5 h-5 text-green-600" />
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">
            AI Sales Assistant
          </h3>
          <span className="inline-flex items-center gap-1 bg-green-500 text-white text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full">
            <Sparkles className="w-3 h-3" />
            New
          </span>
        </div>

        {/* Master toggle */}
        <button
          type="button"
          onClick={() => onChange({ enabled: !enabled })}
          aria-label={enabled ? "Disable AI Sales Assistant" : "Enable AI Sales Assistant"}
          className={`relative inline-flex h-6 w-11 sm:h-7 sm:w-12 items-center rounded-full transition-colors flex-shrink-0 ${
            enabled ? "bg-green-500" : "bg-gray-300"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 sm:h-5 sm:w-5 transform rounded-full bg-white shadow-sm transition-transform ${
              enabled ? "translate-x-5 sm:translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 mb-4">
        Automatically replies, answers questions, and books customers for this service.
      </p>

      {/* Disabled hint */}
      {!enabled && (
        <p className="text-xs text-gray-500 italic mb-2">
          Turn the switch on to configure tone, upsell, and booking-assistance behavior.
        </p>
      )}

      {/* Configurable area — dimmed when disabled */}
      <div className={enabled ? "" : "opacity-40 pointer-events-none select-none"}>
        {/* Tone segmented control */}
        <div className="grid grid-cols-3 gap-1 bg-gray-100 border border-gray-200 rounded-lg p-1 mb-4">
          {TONE_OPTIONS.map((option) => {
            const isSelected = tone === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange({ tone: option.value })}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  isSelected
                    ? "bg-green-500 text-white shadow-sm"
                    : "text-gray-700 hover:bg-gray-200"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {/* "See How the AI Replies" expandable preview */}
        <button
          type="button"
          onClick={() => setPreviewOpen((open) => !open)}
          className="flex items-center gap-1 text-sm font-semibold text-green-700 hover:text-green-800 transition-colors mb-2"
          aria-expanded={previewOpen}
        >
          See How the AI Replies
          {previewOpen ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>

        {previewOpen && (
          <div className="space-y-2 mb-4">
            {AI_PREVIEW_MOCKS[tone].map((reply, idx) => (
              <div
                key={idx}
                className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-700"
              >
                {reply}
              </div>
            ))}
          </div>
        )}

        {/* Behavior checkboxes */}
        <div className="space-y-2">
          <CheckboxRow
            checked={suggestUpsells}
            label="Suggest upsells"
            onChange={(v) => onChange({ suggestUpsells: v })}
          />
          <CheckboxRow
            checked={enableBookingAssistance}
            label="Enable booking assistance"
            onChange={(v) => onChange({ enableBookingAssistance: v })}
          />
        </div>
      </div>

      {/* Disclosure — Phase 1 visual-only honesty marker. Remove in Phase 3. */}
      <div className="mt-4 pt-3 border-t border-gray-200">
        <p className="text-xs text-gray-500 italic">
          AI features ship in a future update. Configure now to be ready.
        </p>
      </div>
    </div>
  );
};

/**
 * Checkbox row used twice (Suggest upsells / Enable booking assistance).
 * Custom-styled to match the green checkmark look in sc1.jpeg, light mode.
 */
const CheckboxRow: React.FC<{
  checked: boolean;
  label: string;
  onChange: (next: boolean) => void;
}> = ({ checked, label, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className="flex items-center gap-2 text-sm text-gray-800 hover:text-gray-900 transition-colors"
  >
    <span
      className={`flex items-center justify-center w-5 h-5 rounded border transition-colors ${
        checked
          ? "bg-green-500 border-green-500"
          : "bg-white border-gray-300"
      }`}
    >
      {checked && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
    </span>
    <span>{label}</span>
  </button>
);
