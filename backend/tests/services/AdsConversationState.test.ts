// Part B redesign (P2) — the pure conversation-state deriver + needs-you predicate.
import { deriveConversationState, needsHuman } from '../../src/domains/AdsDomain/services/leadConversationState';

const NOW = 1_700_000_000_000;
const base = { hasMessages: true, lastDirection: 'outbound' as const, lastAtMs: NOW, aiWillInitiate: false, nowMs: NOW };

describe('deriveConversationState', () => {
  it('no messages + AI will greet → awaiting_ai', () => {
    expect(deriveConversationState({ ...base, hasMessages: false, aiWillInitiate: true })).toBe('awaiting_ai');
  });
  it('no messages + no AI → quiet (a human must start)', () => {
    expect(deriveConversationState({ ...base, hasMessages: false, aiWillInitiate: false })).toBe('quiet');
  });
  it('last message from the customer → needs_human (actionable)', () => {
    expect(deriveConversationState({ ...base, lastDirection: 'inbound' })).toBe('needs_human');
  });
  it('we spoke last, recently → ai_engaged (waiting on the customer)', () => {
    expect(deriveConversationState({ ...base, lastDirection: 'outbound', lastAtMs: NOW - 3600_000 })).toBe('ai_engaged');
  });
  it('we spoke last, past the dormancy window → dormant', () => {
    expect(deriveConversationState({ ...base, lastDirection: 'outbound', lastAtMs: NOW - 8 * 86400000, dormantDays: 7 })).toBe('dormant');
  });
});

describe('needsHuman', () => {
  it('flags customer replies and quiet, not calm AI-engaged states', () => {
    expect(needsHuman('needs_human')).toBe(true);
    expect(needsHuman('quiet')).toBe(true);
    expect(needsHuman('ai_engaged')).toBe(false);
    expect(needsHuman('awaiting_ai')).toBe(false);
    expect(needsHuman('dormant')).toBe(false);
  });
});
