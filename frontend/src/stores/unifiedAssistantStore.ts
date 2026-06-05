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
  /** Whether the assistant has spoken its greeting yet THIS session. In-memory,
   *  so it resets on dashboard reload — i.e. greet once per session, then go
   *  straight to listening on later voice opens. */
  hasGreeted: boolean;
  /** Open the panel without starting the mic (the ✨ launcher). */
  open: () => void;
  /** Open the panel AND start its mic on mount (the voice triggers). */
  openWithMic: () => void;
  /** Controlled open setter for the Sheet's onOpenChange. Closing clears the
   *  pending-mic flag so a stale signal can't fire on the next open. */
  setOpen: (v: boolean) => void;
  /** Read-and-clear the pending-mic flag. Returns whether the mic should start. */
  consumePendingMic: () => boolean;
  /** Mark the greeting as played for this session. */
  markGreeted: () => void;
}

export const useUnifiedAssistantStore = create<UnifiedAssistantState>(
  (set, get) => ({
    isOpen: false,
    pendingMic: false,
    hasGreeted: false,
    open: () => set({ isOpen: true, pendingMic: false }),
    openWithMic: () => set({ isOpen: true, pendingMic: true }),
    setOpen: (v) => set(v ? { isOpen: true } : { isOpen: false, pendingMic: false }),
    consumePendingMic: () => {
      const v = get().pendingMic;
      if (v) set({ pendingMic: false });
      return v;
    },
    markGreeted: () => set({ hasGreeted: true }),
  })
);
