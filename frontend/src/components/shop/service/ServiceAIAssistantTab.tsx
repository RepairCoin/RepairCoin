"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, Save } from "lucide-react";
import { toast } from "react-hot-toast";
import {
  getServiceById,
  updateService,
  ShopService,
  UpdateServiceData,
} from "@/services/api/services";
import { AISalesAssistantSection } from "@/components/shop/service/AISalesAssistantSection";
import {
  buildStarterEntries,
  type FaqEntry,
} from "@/components/shop/service/AIFaqEditor";
import type { AITone } from "@/utils/aiPreviewMocks";

/**
 * ServiceAIAssistantTab
 *
 * Tab content for the "AI Assistant" tab on the service detail page.
 * Owns the AI state for one service and renders the shared
 * `AISalesAssistantSection` in controlled mode. The Save button +
 * unsaved-changes guard land in Phase 1.3 / 1.4 — this Phase 1.2
 * scaffolding establishes the load/state/render foundation those
 * phases hook into.
 *
 * Mirrors the seeding pattern used by the Edit Service page
 * (`app/(authenticated)/shop/services/[serviceId]/edit/page.tsx`) so
 * both navigation paths produce the same initial state.
 */

export interface ServiceAIAssistantTabProps {
  serviceId: string;
  /**
   * Notifies the parent when the tab's unsaved-changes state flips.
   * The parent uses this to intercept in-app tab switches with a confirm
   * dialog. Cleanup explicitly emits `false` on unmount so a stale truthy
   * value doesn't linger in the parent's state.
   */
  onUnsavedChangesChange?: (hasUnsavedChanges: boolean) => void;
  /**
   * Fires after a successful save with the freshly-saved service row.
   * The parent uses this to refresh its `service` state so derived UI
   * (e.g. the green "AI enabled" dot on the tab label) updates without
   * a page reload.
   */
  onServiceUpdated?: (service: ShopService) => void;
}

/**
 * Snapshot of the editable AI fields. Phase 1.4 will compare the live
 * `currentState` against `initialState` to detect dirty edits for the
 * unsaved-changes guard; Phase 1.3 will reset `initialState` to the
 * just-saved values after a successful PUT.
 */
export interface AIEditorState {
  enabled: boolean;
  tone: AITone;
  suggestUpsells: boolean;
  enableBookingAssistance: boolean;
  faqEntries: FaqEntry[];
}

/**
 * Strip empty FAQ rows before persistence. Starter questions that the
 * shop owner didn't fill in shouldn't be saved as half-filled entries.
 * Same shape the Edit Service page submits.
 */
const normalizeFaqForPersist = (
  entries: FaqEntry[]
): { question: string; answer: string }[] =>
  entries
    .map((e) => ({ question: e.question.trim(), answer: e.answer.trim() }))
    .filter((e) => e.question.length > 0 && e.answer.length > 0);

/**
 * True when the user has unsaved edits. FAQ comparison normalizes both
 * sides first so empty starter rows don't count as a change.
 */
const hasUnsavedChanges = (
  initial: AIEditorState,
  current: AIEditorState
): boolean => {
  if (initial.enabled !== current.enabled) return true;
  if (initial.tone !== current.tone) return true;
  if (initial.suggestUpsells !== current.suggestUpsells) return true;
  if (initial.enableBookingAssistance !== current.enableBookingAssistance) return true;

  const normInitial = normalizeFaqForPersist(initial.faqEntries);
  const normCurrent = normalizeFaqForPersist(current.faqEntries);
  if (normInitial.length !== normCurrent.length) return true;
  for (let i = 0; i < normInitial.length; i++) {
    if (normInitial[i].question !== normCurrent[i].question) return true;
    if (normInitial[i].answer !== normCurrent[i].answer) return true;
  }
  return false;
};

const seedFromService = (service: ShopService): AIEditorState => {
  // Empty/missing FAQ array → fall back to starter questions so the shop
  // owner sees something useful to fill in rather than an empty editor.
  // Same fallback as the Edit Service page (Phase 2 of the FAQ rollout).
  const persistedFaq = (service as any).faqEntries as FaqEntry[] | undefined;
  return {
    enabled: service.aiSalesEnabled ?? false,
    tone: service.aiTone ?? "professional",
    suggestUpsells: service.aiSuggestUpsells ?? false,
    enableBookingAssistance: service.aiBookingAssistance ?? false,
    faqEntries:
      persistedFaq && persistedFaq.length > 0
        ? persistedFaq
        : buildStarterEntries(),
  };
};

export const ServiceAIAssistantTab: React.FC<ServiceAIAssistantTabProps> = ({
  serviceId,
  onUnsavedChangesChange,
  onServiceUpdated,
}) => {
  const [service, setService] = useState<ShopService | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");

  // Snapshot pattern — initialState is set on load and after each save;
  // currentState reflects live edits.
  const [initialState, setInitialState] = useState<AIEditorState | null>(null);
  const [currentState, setCurrentState] = useState<AIEditorState | null>(null);

  // `hasChanges` drives the Save button's disabled state. Memo so the
  // FAQ-normalize comparison only re-runs when state references change.
  const hasChanges = useMemo(() => {
    if (!initialState || !currentState) return false;
    return hasUnsavedChanges(initialState, currentState);
  }, [initialState, currentState]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getServiceById(serviceId);
      if (!data) {
        setError("Service not found");
        return;
      }
      const seeded = seedFromService(data);
      setService(data);
      setInitialState(seeded);
      setCurrentState(seeded);
    } catch (err) {
      console.error("Failed to load service for AI tab:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load AI settings"
      );
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  useEffect(() => {
    load();
  }, [load]);

  // Propagate the unsaved-changes state to the parent for in-app
  // tab-switch interception. Explicit `false` on cleanup so a stale
  // truthy value doesn't survive the AI tab unmounting.
  useEffect(() => {
    onUnsavedChangesChange?.(hasChanges);
    return () => {
      onUnsavedChangesChange?.(false);
    };
  }, [hasChanges, onUnsavedChangesChange]);

  // Browser-level guard for close/refresh/external nav. Modern browsers
  // ignore the custom message and show their own generic "leave site?"
  // prompt — that's the intended UX, not a bug.
  useEffect(() => {
    if (!hasChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Some legacy browsers need a truthy returnValue to fire the prompt.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasChanges]);

  const handleChange = useCallback(
    (changes: Partial<AIEditorState>) => {
      setCurrentState((prev) => (prev ? { ...prev, ...changes } : prev));
    },
    []
  );

  const handleSave = useCallback(async () => {
    if (!currentState || saving) return;
    try {
      setSaving(true);
      // AI-fields-only payload. Standard service fields (name, price,
      // description, etc.) are NOT included — the backend's partial-update
      // honors that, leaving them untouched.
      const payload: UpdateServiceData = {
        aiSalesEnabled: currentState.enabled,
        aiTone: currentState.tone,
        aiSuggestUpsells: currentState.suggestUpsells,
        aiBookingAssistance: currentState.enableBookingAssistance,
        faqEntries: normalizeFaqForPersist(currentState.faqEntries),
      };
      const updated = await updateService(serviceId, payload);
      if (!updated) {
        toast.error("AI settings could not be saved. Please try again.");
        return;
      }
      // Snapshot the just-saved state so `hasChanges` flips back to
      // false and the Save button disables until the user edits again.
      setInitialState(currentState);
      // Refresh local + parent service state so derived UI (e.g. the
      // AI-enabled tab dot) updates without a page reload.
      setService(updated);
      onServiceUpdated?.(updated);
      toast.success("AI settings saved");
    } catch (err) {
      console.error("Failed to save AI settings:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to save AI settings"
      );
    } finally {
      setSaving(false);
    }
  }, [currentState, saving, serviceId, onServiceUpdated]);

  if (loading) {
    return (
      <div className="bg-[#1A1A1A] border border-gray-800 rounded-2xl p-8 flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-6 h-6 text-[#FFCC00] animate-spin" />
        <span className="ml-2 text-gray-400">Loading AI settings…</span>
      </div>
    );
  }

  if (error || !service || !currentState) {
    return (
      <div className="bg-red-900/20 border border-red-700 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-red-400">
            Couldn&apos;t load AI settings
          </p>
          <p className="text-sm text-red-300 mt-1">
            {error || "Please try again."}
          </p>
        </div>
        <button
          onClick={load}
          className="flex-shrink-0 px-3 py-1 text-sm font-medium text-red-300 bg-red-900/40 hover:bg-red-900/60 rounded border border-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const saveDisabled = saving || !hasChanges;

  return (
    <div>
      <AISalesAssistantSection
        enabled={currentState.enabled}
        tone={currentState.tone}
        suggestUpsells={currentState.suggestUpsells}
        enableBookingAssistance={currentState.enableBookingAssistance}
        faqEntries={currentState.faqEntries}
        serviceId={serviceId}
        description={service.description}
        onChange={handleChange}
      />

      {/* Sticky-bottom save bar (scope-doc decision E revised 2026-05-20
          per exec UX review). Stays glued to the viewport bottom while
          the user scrolls through long FAQ lists; settles at the bottom
          of the tab content when the page reaches the end. Backdrop
          blur + top border separate it visually from the AI section
          card above. Sits inside the tab content (no negative margins)
          so the button keeps consistent breathing room from the right
          edge — earlier edge-extension version pinned Save flush to
          the viewport edge. */}
      <div className="sticky bottom-0 mt-4 z-10 bg-[#0A0A0A] border-t border-gray-800 px-4 sm:px-6 py-3 flex items-center justify-end gap-3">
        {hasChanges && !saving && (
          <span className="text-xs text-gray-400 font-medium">
            Unsaved changes
          </span>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saveDisabled}
          className={`flex items-center justify-center gap-2 font-semibold px-4 sm:px-5 py-2 rounded-lg transition-colors duration-200 flex-shrink-0 ${
            saveDisabled
              ? "bg-[#FFCC00]/40 text-black/70 cursor-not-allowed"
              : "bg-[#FFCC00] text-black hover:bg-[#FFD700]"
          }`}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
};
