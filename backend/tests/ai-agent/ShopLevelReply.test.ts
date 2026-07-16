/**
 * Phase 1 Slice 2B (AI Auto-Replies SMS) — AgentOrchestrator.handleShopLevelMessage: the
 * serviceless (D3) shop-level reply used for SMS. Verifies the shared gates (shop kill-switch,
 * spend cap, ai_paused), the catalog-grounded Claude call, and that the AI reply is persisted as a
 * shop-sent, channel='sms', ai_agent message. All deps injected — no DB / no network / no Anthropic.
 */
import { describe, it, expect } from '@jest/globals';
import { AgentOrchestrator } from '../../src/domains/AIAgentDomain/services/AgentOrchestrator';

function makePool(rows: { aiGlobal?: boolean; noSettings?: boolean; pausedUntil?: Date | null; shopName?: string } = {}) {
  const aiGlobal = rows.aiGlobal ?? true;
  const pausedUntil = rows.pausedUntil ?? null;
  const shopName = rows.shopName ?? 'Test Shop';
  return {
    query: async (sql: string) => {
      if (sql.includes('ai_global_enabled')) return { rows: rows.noSettings ? [] : [{ ai_global_enabled: aiGlobal }] };
      if (sql.includes('ai_paused_until')) return { rows: [{ ai_paused_until: pausedUntil }] };
      if (sql.includes('FROM shops')) return { rows: [{ name: shopName }] };
      return { rows: [] };
    },
  } as any;
}

function makeOrchestrator(over: any = {}) {
  const created: any[] = [];
  const recorded: number[] = [];
  const claude = over.complete ?? (async () => ({
    text: over.replyText ?? 'Yes, we offer screen repair for $99.',
    model: 'claude-haiku-4-5-20251001',
    costUsd: 0.0012,
    latencyMs: 220,
    stopReason: 'end_turn',
    usage: { inputTokens: 100, outputTokens: 20, cacheReadInputTokens: 0 },
    toolUses: [],
  }));
  const orch = new AgentOrchestrator({
    pool: over.pool ?? makePool(over.poolRows),
    serviceRepo: {
      getServicesByShop: async () => ({
        items: over.catalog ?? [{ serviceName: 'Screen Repair', category: 'phone', priceUsd: 99, durationMinutes: 45, description: 'Fix cracked screens' }],
        pagination: {},
      }),
    } as any,
    messageRepo: {
      getRecentConversationMessages: async () => over.history ?? [],
      createMessage: async (p: any) => { created.push(p); return { message: { messageId: p.messageId }, created: true }; },
    } as any,
    anthropicClient: { complete: claude } as any,
    auditLogger: { log: async () => {} } as any,
    spendCapEnforcer: {
      canSpend: async () => over.spend ?? { allowed: true, useCheaperModel: false },
      recordSpend: async (_s: string, c: number) => { recorded.push(c); },
    } as any,
  });
  return { orch, created, recorded };
}

const INPUT = {
  messageId: 'msg-in',
  conversationId: 'conv1',
  customerAddress: '0xabc',
  shopId: 'shop1',
  customerMessageText: 'Do you fix screens?',
};

describe('AgentOrchestrator.handleShopLevelMessage', () => {
  it('replies at shop level and persists a shop-sent sms ai_agent message', async () => {
    const { orch, created, recorded } = makeOrchestrator();
    const res = await orch.handleShopLevelMessage(INPUT);
    expect(res.outcome).toBe('ai_replied');
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      conversationId: 'conv1',
      senderAddress: 'shop1',
      senderType: 'shop',
      channel: 'sms',
    });
    expect(created[0].metadata).toMatchObject({ generated_by: 'ai_agent', shop_level: true });
    expect(created[0].messageText).toContain('screen repair');
    expect(recorded).toEqual([0.0012]); // spend recorded
  });

  it('persists the reply on the whatsapp channel when channel=whatsapp', async () => {
    const { orch, created } = makeOrchestrator();
    const res = await orch.handleShopLevelMessage({ ...INPUT, channel: 'whatsapp' });
    expect(res.outcome).toBe('ai_replied');
    expect(created[0].channel).toBe('whatsapp');
  });

  it('strips markdown emphasis from the reply (raw text over SMS)', async () => {
    const { orch, created } = makeOrchestrator({ replyText: 'We offer **Screen Repair** for $99.' });
    await orch.handleShopLevelMessage(INPUT);
    expect(created[0].messageText).toBe('We offer Screen Repair for $99.');
  });

  it('skips when the shop AI kill-switch is off', async () => {
    const { orch, created } = makeOrchestrator({ poolRows: { aiGlobal: false } });
    const res = await orch.handleShopLevelMessage(INPUT);
    expect(res).toEqual({ outcome: 'skipped', reason: 'shop_ai_disabled' });
    expect(created).toHaveLength(0);
  });

  it('skips when the shop has no ai_shop_settings row', async () => {
    const { orch } = makeOrchestrator({ pool: makePool({ noSettings: true }) });
    const res = await orch.handleShopLevelMessage(INPUT);
    expect(res).toEqual({ outcome: 'skipped', reason: 'no_shop_settings' });
  });

  it('skips when the spend cap is exceeded', async () => {
    const { orch, created } = makeOrchestrator({ spend: { allowed: false, useCheaperModel: false } });
    const res = await orch.handleShopLevelMessage(INPUT);
    expect(res).toEqual({ outcome: 'skipped', reason: 'spend_cap_exceeded' });
    expect(created).toHaveLength(0);
  });

  it('skips when the conversation is AI-paused (takeover / race window)', async () => {
    const future = new Date(Date.now() + 60_000);
    const { orch, created } = makeOrchestrator({ poolRows: { pausedUntil: future } });
    const res = await orch.handleShopLevelMessage(INPUT);
    expect(res).toEqual({ outcome: 'skipped', reason: 'ai_paused' });
    expect(created).toHaveLength(0);
  });

  it('fails cleanly when Claude returns empty text (nothing persisted)', async () => {
    const { orch, created } = makeOrchestrator({ replyText: '   ' });
    const res = await orch.handleShopLevelMessage(INPUT);
    expect(res).toEqual({ outcome: 'failed', error: 'empty_reply' });
    expect(created).toHaveLength(0);
  });
});
