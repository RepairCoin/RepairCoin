// Part B redesign (P3) — take-over gate. When a lead is ai_paused (a human took over), handleInbound
// records the customer's reply but must NOT auto-answer over them. Deps are injected; AnthropicClient
// (constructed by the module-level singleton on import) is mocked so importing doesn't need a key.

jest.mock('../../src/domains/AIAgentDomain/services/AnthropicClient', () => ({ AnthropicClient: class {} }));

import { LeadAutoAnswerService } from '../../src/domains/AdsDomain/services/LeadAutoAnswerService';

const makeSvc = (lead: any) => {
  const anthropic: any = {};
  const spendCap: any = { canSpend: async () => ({ allowed: true }) };
  const brandKit: any = { getBrandKit: async () => null };
  const leads: any = { findById: async () => lead };
  const campaigns: any = { findById: async () => ({ aiAgentEnabled: true }) };
  const aiCosts: any = {};
  const messages: any = { append: jest.fn(async () => ({ id: 'in1' })), listByLead: async () => [], countByAuthorSince: async () => 0 };
  const channel: any = { deliver: async () => 'sent' };
  const svc = new LeadAutoAnswerService(anthropic, spendCap, brandKit, leads, campaigns, aiCosts, messages, channel);
  return { svc, messages };
};

describe('LeadAutoAnswerService.handleInbound — take-over (ai_paused)', () => {
  it('records the reply but does NOT auto-answer when the lead is paused', async () => {
    const { svc, messages } = makeSvc({ id: 'l1', campaignId: 'c1', aiPaused: true });
    const genSpy = jest.spyOn(svc as any, 'generateReply');
    const r = await svc.handleInbound('l1', 'hello?');
    expect(r.autoAnswered).toBe(false);
    expect(r.reason).toBe('ai_paused');
    expect(genSpy).not.toHaveBeenCalled();
    expect(messages.append).toHaveBeenCalled(); // the inbound message is still recorded
  });

  it('auto-answers when the lead is not paused', async () => {
    const { svc } = makeSvc({ id: 'l1', campaignId: 'c1', aiPaused: false });
    jest.spyOn(svc as any, 'generateReply').mockResolvedValue({ id: 'r1' });
    const r = await svc.handleInbound('l1', 'hello?');
    expect(r.autoAnswered).toBe(true);
  });
});
