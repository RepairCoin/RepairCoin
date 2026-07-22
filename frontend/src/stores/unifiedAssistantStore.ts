// frontend/src/stores/unifiedAssistantStore.ts
//
// Coordinates the "one door" Unified Assistant launcher with the global voice
// entry points (HeaderVoiceMic + MobileBottomNavMic).
//
// Before: those mics ran their own recorder + the old voice-v1 4-way dispatcher
// (route-to-panels). Now they're thin triggers — tapping one OPENS the unified
// assistant Sheet and (for the mics) signals the panel to auto-start its own
// tap-to-talk recorder. One assistant, one recorder, one conversation.
//
// `pendingMic` is a one-shot: the launcher's Sheet mounts the panel fresh on
// each open, and the panel consumes the flag on mount (consumePendingMic) to
// decide whether to start recording immediately. Consuming flips it false so a
// StrictMode double-mount can't double-start.

import { create } from "zustand";

interface UnifiedAssistantState {
  /** Whether the unified assistant Sheet is open (controlled by the launcher). */
  isOpen: boolean;
  /** One-shot: panel auto-starts its mic on mount when true. */
  pendingMic: boolean;
  /** One-shot: panel auto-submits this text on mount. Set by callers that open
   *  the assistant WITH a question already decided — e.g. a dashboard
   *  recommendation card ("draft a promo for next week"). Same one-shot
   *  discipline as pendingMic so a StrictMode double-mount can't double-send. */
  pendingPrompt: string | null;
  /** Whether the assistant has spoken its greeting yet THIS session. In-memory,
   *  so it resets on dashboard reload — i.e. greet once per session, then go
   *  straight to listening on later voice opens. */
  hasGreeted: boolean;
  /** Open the panel without starting the mic (the ✨ launcher). */
  open: () => void;
  /** Open the panel AND start its mic on mount (the voice triggers). */
  openWithMic: () => void;
  /** Open the panel AND submit `prompt` on mount (recommendation cards). */
  openWithPrompt: (prompt: string) => void;
  /** Controlled open setter for the Sheet's onOpenChange. Closing clears the
   *  pending-mic flag so a stale signal can't fire on the next open. */
  setOpen: (v: boolean) => void;
  /** Read-and-clear the pending-mic flag. Returns whether the mic should start. */
  consumePendingMic: () => boolean;
  /** Read-and-clear the pending prompt. Returns the text to submit, or null. */
  consumePendingPrompt: () => string | null;
  /** Mark the greeting as played for this session. */
  markGreeted: () => void;
}

export const useUnifiedAssistantStore = create<UnifiedAssistantState>(
  (set, get) => ({
    isOpen: false,
    pendingMic: false,
    pendingPrompt: null,
    hasGreeted: false,
    open: () => set({ isOpen: true, pendingMic: false, pendingPrompt: null }),
    openWithMic: () => set({ isOpen: true, pendingMic: true, pendingPrompt: null }),
    // Mic and prompt are mutually exclusive: the question is already decided,
    // so opening the recorder on top of it would race the auto-submit.
    openWithPrompt: (prompt) =>
      set({ isOpen: true, pendingMic: false, pendingPrompt: prompt }),
    setOpen: (v) =>
      set(
        v
          ? { isOpen: true }
          : { isOpen: false, pendingMic: false, pendingPrompt: null }
      ),
    consumePendingMic: () => {
      const v = get().pendingMic;
      if (v) set({ pendingMic: false });
      return v;
    },
    consumePendingPrompt: () => {
      const v = get().pendingPrompt;
      if (v !== null) set({ pendingPrompt: null });
      return v;
    },
    markGreeted: () => set({ hasGreeted: true }),
  })
);
