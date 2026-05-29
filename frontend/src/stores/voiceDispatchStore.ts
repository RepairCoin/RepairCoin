// frontend/src/stores/voiceDispatchStore.ts
//
// Voice AI Dispatcher Phase 3 — coordination between the global mic
// surfaces (VoiceCommandPill / HeaderVoiceMic) and the existing AI
// panel launchers (InsightsLauncher / MarketingAILauncher /
// HelpAssistantLauncher).
//
// Flow:
//   1. Mic component POSTs /api/ai/dispatch and gets back a domain.
//   2. Mic component calls dispatch(domain, transcript).
//   3. Each launcher reads pending; when pending.domain matches its
//      own domain, it opens its Sheet.
//   4. The panel inside the Sheet reads pending too; when its domain
//      matches, it seeds its input + triggers send, then calls
//      consume() to clear the store.
//
// `dispatchId` is a per-dispatch unique id. Panel useEffects depend
// on it so that re-dispatching the same transcript (e.g. "show me
// revenue" twice in a row) triggers a fresh seed+send each time
// rather than being de-duped by React's value equality check.

import { create } from "zustand";

export type VoiceDispatchDomain = "insights" | "marketing" | "help";

export interface VoiceDispatchPending {
  domain: VoiceDispatchDomain;
  transcript: string;
  /** Unique per call so panels' useEffects re-run on repeats. */
  dispatchId: string;
}

interface VoiceDispatchState {
  pending: VoiceDispatchPending | null;
  dispatch: (domain: VoiceDispatchDomain, transcript: string) => void;
  consume: () => void;
}

function mintDispatchId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `dispatch-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export const useVoiceDispatchStore = create<VoiceDispatchState>((set) => ({
  pending: null,
  dispatch: (domain, transcript) =>
    set({ pending: { domain, transcript, dispatchId: mintDispatchId() } }),
  consume: () => set({ pending: null }),
}));
