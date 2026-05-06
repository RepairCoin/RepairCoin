"use client";

import React, { useState, useEffect, useRef } from "react";
import { Bot, ChevronDown, ChevronUp, Check, Sparkles } from "lucide-react";
import { AI_PREVIEW_MOCKS, AITone } from "@/utils/aiPreviewMocks";
import { getAiPreview, AIPreviewResponse } from "@/services/api/services";

/**
 * AISalesAssistantSection
 *
 * AI Sales Assistant section for the service create/edit page. Master
 * toggle, tone segmented control, "See How the AI Replies" expandable
 * preview, plus upsell + booking-assistance checkboxes.
 *
 * Visual treatment: light/white card with a green-tinted shadow + "NEW"
 * badge so it stands out from the rest of the dark form sections.
 *
 * Live preview (Phase 3): when `serviceId` is provided, the preview area
 * fetches a real Claude reply via POST /api/ai/preview. The "new" page
 * (where the service hasn't been created yet) omits `serviceId`, so the
 * preview falls back to the static `AI_PREVIEW_MOCKS` arc. The same
 * fallback also catches API failures, keeping the UI responsive even when
 * the AI backend is degraded.
 */

export interface AISalesAssistantSectionProps {
  enabled: boolean;
  tone: AITone;
  suggestUpsells: boolean;
  enableBookingAssistance: boolean;
  onChange: (changes: Partial<Omit<AISalesAssistantSectionProps, "onChange">>) => void;
  /** Optional — when present, the preview fetches a real Claude reply for this service. */
  serviceId?: string;
}

interface LivePreviewState {
  loading: boolean;
  reply: AIPreviewResponse | null;
  error: boolean;
}

const initialLiveState: LivePreviewState = { loading: false, reply: null, error: false };

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
  serviceId,
}) => {
  const [previewOpen, setPreviewOpen] = useState(true);

  // Live preview state. Keyed (serviceId, tone) cache lives in a ref so
  // tone-toggle does not refire requests if we already have the reply.
  const liveCacheRef = useRef<Map<string, AIPreviewResponse>>(new Map());
  const [liveState, setLiveState] = useState<LivePreviewState>(initialLiveState);

  useEffect(() => {
    // Only fetch when the preview is open, AI is enabled, and we have a
    // serviceId. The new-service page omits serviceId, which is fine —
    // we fall back to mocks below.
    if (!previewOpen || !enabled || !serviceId) {
      setLiveState(initialLiveState);
      return;
    }

    const cacheKey = `${serviceId}:${tone}`;
    const cached = liveCacheRef.current.get(cacheKey);
    if (cached) {
      setLiveState({ loading: false, reply: cached, error: false });
      return;
    }

    let cancelled = false;
    setLiveState({ loading: true, reply: null, error: false });

    getAiPreview(serviceId, tone)
      .then((reply) => {
        if (cancelled || !reply) return;
        liveCacheRef.current.set(cacheKey, reply);
        setLiveState({ loading: false, reply, error: false });
      })
      .catch(() => {
        if (cancelled) return;
        // Graceful degradation: fall back to AI_PREVIEW_MOCKS rendered below.
        setLiveState({ loading: false, reply: null, error: true });
      });

    return () => {
      cancelled = true;
    };
  }, [previewOpen, enabled, serviceId, tone]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-lg shadow-green-500/10">
      {/* Header — light treatment with NEW badge */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Bot className="w-5 h-5 text-green-600" />
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">
            Auto Sales & Booking
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
          aria-label={enabled ? "Disable Auto Sales & Booking" : "Enable Auto Sales & Booking"}
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
      <p className="text-sm text-gray-600 mb-2">
        Automatically replies, answers questions, books and increases sales.
      </p>

      {/* Micro-proof — Option B (honest reword): same emotional hook as exec's
          ask without promising runtime behavior that ships in Phase 3. */}
      <p className="text-xs text-gray-600 font-medium mb-4">
        Configure once · Saved automatically · Activates next release
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
            {liveState.loading ? (
              // Loading skeleton — mimics one bubble height
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 animate-pulse">
                <div className="h-3 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-2/3" />
              </div>
            ) : liveState.reply ? (
              // Live Claude reply — show the sample question + the AI reply
              <>
                <div className="text-xs text-gray-500 italic px-1">
                  Sample customer asks: &ldquo;Hi! How much does this cost and when can I book?&rdquo;
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-gray-800 whitespace-pre-wrap">
                  {liveState.reply.reply}
                </div>
                <div className="text-[11px] text-gray-400 px-1 flex items-center gap-2">
                  <span>{liveState.reply.model.includes("haiku") ? "Haiku" : "Sonnet"}</span>
                  <span>·</span>
                  <span>{liveState.reply.cached ? "cached" : `${liveState.reply.latencyMs}ms`}</span>
                </div>
              </>
            ) : (
              // Fallback: no serviceId yet (new service flow) OR API failed.
              // Render the static mock arc as a stand-in.
              AI_PREVIEW_MOCKS[tone].map((reply, idx) => (
                <div
                  key={idx}
                  className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-700"
                >
                  {reply}
                </div>
              ))
            )}
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

      {/* Disclosure — Phase 3: live preview wired. The customer-facing AI
          auto-reply itself (Task 8) still ships in a follow-up — but the
          preview shows the actual reply Claude will give once activated. */}
      <div className="mt-4 pt-3 border-t border-gray-200">
        <p className="text-xs text-gray-500 italic">
          {serviceId
            ? "Live preview — this is the actual reply Claude generates for your service."
            : "Save the service first to see a live AI reply preview."}
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
