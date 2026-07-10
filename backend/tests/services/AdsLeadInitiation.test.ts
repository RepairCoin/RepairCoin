// Part B — AI-initiated first contact engine. LeadInitiationService.onLeadCaptured decision logic:
// flag gate, per-campaign 'auto' mode, contactable + fresh + not-already-messaged guards, and the
// happy path (draft → deliver → record → stampFirstResponse). Repos/AI/sender are injected fakes; the
// LeadAIService singleton (constructs an AnthropicClient on import) is module-mocked.

jest.mock('../../src/domains/AdsDomain/services/LeadAIService', () => ({
  leadAIService: { draftOutreach: jest.fn() },
}));

import { LeadInitiationService } from '../../src/domains/AdsDomain/services/LeadInitiationService';

const baseCampaign = { id: 'c1', shopId: 's1', aiOutreachMode: 'auto' };
const baseLead = { id: 'l1', email: 'lead@x.com', leadStatus: 'new', firstResponseAt: null, campaignId: 'c1' };

const makeSvc = (over: { campaign?: any; lead?: any; messages?: any[]; draftThrows?: boolean } = {}) => {
  const leads: any = { findById: jest.fn(async () => over.lead === undefined ? baseLead : over.lead), stampFirstResponse: jest.fn(async () => {}) };
  const campaigns: any = { findById: jest.fn(async () => over.campaign === undefined ? baseCampaign : over.campaign) };
  const messages: any = { listByLead: jest.fn(async () => over.messages ?? []), append: jest.fn(async () => ({ id: 'm1' })) };
  const ai: any = { draftOutreach: jest.fn(async () => { if (over.draftThrows) throw Object.assign(new Error('over budget'), { status: 429 }); return { draft: 'Hi! Saw you were interested — happy to help.', costUsd: 0.001 }; }) };
  const channel: any = { deliver: jest.fn(async () => 'sent') };
  return { svc: new LeadInitiationService(leads, campaigns, messages, ai, channel), leads, campaigns, messages, ai, channel };
};

describe('LeadInitiationService.onLeadCaptured', () => {
  const prev = process.env.ADS_AI_INITIATE_ENABLED;
  beforeEach(() => { process.env.ADS_AI_INITIATE_ENABLED = 'true'; });
  afterEach(() => { if (prev === undefined) delete process.env.ADS_AI_INITIATE_ENABLED; else process.env.ADS_AI_INITIATE_ENABLED = prev; });

  it('is a no-op when the flag is off', async () => {
    delete process.env.ADS_AI_INITIATE_ENABLED;
    const { svc, campaigns } = makeSvc();
    expect(await svc.onLeadCaptured('l1', 'c1')).toBe('disabled');
    expect(campaigns.findById).not.toHaveBeenCalled();
  });

  it('skips campaigns not in auto mode', async () => {
    const { svc, ai } = makeSvc({ campaign: { ...baseCampaign, aiOutreachMode: 'draft' } });
    expect(await svc.onLeadCaptured('l1', 'c1')).toBe('mode_not_auto');
    expect(ai.draftOutreach).not.toHaveBeenCalled();
  });

  it('skips a lead with no email (only wired channel in v1)', async () => {
    const { svc } = makeSvc({ lead: { ...baseLead, email: null } });
    expect(await svc.onLeadCaptured('l1', 'c1')).toBe('no_channel');
  });

  it('skips an already-worked lead (not new / has first response)', async () => {
    expect(await makeSvc({ lead: { ...baseLead, leadStatus: 'contacted' } }).svc.onLeadCaptured('l1', 'c1')).toBe('already_worked');
    expect(await makeSvc({ lead: { ...baseLead, firstResponseAt: new Date() } }).svc.onLeadCaptured('l1', 'c1')).toBe('already_worked');
  });

  it('skips a lead that already has a message (idempotency)', async () => {
    const { svc, ai } = makeSvc({ messages: [{ id: 'x' }] });
    expect(await svc.onLeadCaptured('l1', 'c1')).toBe('already_messaged');
    expect(ai.draftOutreach).not.toHaveBeenCalled();
  });

  it('returns draft_failed (and sends nothing) when the AI draft is blocked/over budget', async () => {
    const { svc, channel, messages, leads } = makeSvc({ draftThrows: true });
    expect(await svc.onLeadCaptured('l1', 'c1')).toBe('draft_failed');
    expect(channel.deliver).not.toHaveBeenCalled();
    expect(messages.append).not.toHaveBeenCalled();
    expect(leads.stampFirstResponse).not.toHaveBeenCalled();
  });

  it('happy path: drafts, sends by email, records the message, marks contacted', async () => {
    const { svc, ai, channel, messages, leads } = makeSvc();
    expect(await svc.onLeadCaptured('l1', 'c1')).toBe('sent');
    expect(ai.draftOutreach).toHaveBeenCalledWith('l1');
    expect(channel.deliver).toHaveBeenCalledWith('email', baseLead, expect.stringContaining('happy to help'));
    expect(messages.append).toHaveBeenCalledWith(expect.objectContaining({ leadId: 'l1', direction: 'outbound', author: 'ai', channel: 'email' }));
    expect(leads.stampFirstResponse).toHaveBeenCalledWith('l1');
  });
});
