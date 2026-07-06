// Part B redesign (P3) — booking-intent detection + escalation feeding the conversation state.
import { detectBookingIntent } from '../../src/domains/AdsDomain/services/leadIntent';
import { deriveConversationState } from '../../src/domains/AdsDomain/services/leadConversationState';

describe('detectBookingIntent', () => {
  it('flags booking / buying signals', () => {
    for (const s of [
      "Can I book an appointment?",
      "How much for a screen repair?",
      "What time are you available tomorrow?",
      "I'm ready to get started",
      "Can I stop by today?",
      "whats the price",
    ]) expect(detectBookingIntent(s)).toBe(true);
  });
  it('ignores non-intent chatter', () => {
    for (const s of ["thanks!", "who are you?", "not interested", "", "just looking around"]) {
      expect(detectBookingIntent(s)).toBe(false);
    }
  });
});

describe('deriveConversationState — escalation overrides', () => {
  const NOW = 1_700_000_000_000;
  it('an escalated lead is needs_human even if we spoke last (AI answered)', () => {
    expect(deriveConversationState({
      hasMessages: true, lastDirection: 'outbound', lastAtMs: NOW, aiWillInitiate: false, escalated: true, nowMs: NOW,
    })).toBe('needs_human');
  });
  it('without escalation, we-spoke-last is calm (ai_engaged)', () => {
    expect(deriveConversationState({
      hasMessages: true, lastDirection: 'outbound', lastAtMs: NOW, aiWillInitiate: false, escalated: false, nowMs: NOW,
    })).toBe('ai_engaged');
  });
});
