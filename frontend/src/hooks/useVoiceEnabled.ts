import { useFeatureAccess } from "@/hooks/useFeatureAccess";

// WS2: single source of truth for whether the Voice AI Assistant is available to
// the current shop. Voice (dictation + spoken replies) is a Growth+ feature per
// the pricing sheet; the basic *text* assistant stays Starter+. Every voice
// affordance (header mic, mobile mic, dashboard pill, per-panel inline mics, the
// unified assistant's own mic) self-gates on this so there's one rule to change.
//
// Returns false while feature access is still loading, so a below-tier shop never
// briefly sees a mic it can't use (and an above-tier shop just gets it a beat later).
export function useVoiceEnabled(): boolean {
  const { can, loading } = useFeatureAccess();
  return !loading && can("voiceAiAssistant");
}
