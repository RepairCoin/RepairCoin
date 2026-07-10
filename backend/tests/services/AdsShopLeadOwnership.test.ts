// Part A — shop lead-conversation ownership gate. A shop may read/reply to the conversation ONLY for
// leads on its own campaigns (verified via the lead's campaign shop_id, never a path param).
// Controllers are exercised with mocked req/res; the repos are prototype-spied; the AI-service
// singletons (which construct an AnthropicClient on import) are module-mocked.

jest.mock('../../src/domains/AdsDomain/services/LeadAutoAnswerService', () => ({
  leadAutoAnswerService: {
    getThread: jest.fn(async () => [{ id: 'm1' }]),
    sendAdminMessage: jest.fn(async () => ({ id: 'm2' })),
    generateReply: jest.fn(async () => ({ id: 'm3' })),
  },
}));
jest.mock('../../src/domains/AdsDomain/services/LeadAIService', () => ({
  leadAIService: { draftOutreach: jest.fn(async () => ({ draft: 'hi', costUsd: 0 })) },
}));

import {
  getShopLeadThread, postShopLeadMessage, autoAnswerShopLead,
} from '../../src/domains/AdsDomain/controllers/LeadController';
import { LeadRepository } from '../../src/domains/AdsDomain/repositories/LeadRepository';
import { CampaignRepository } from '../../src/domains/AdsDomain/repositories/CampaignRepository';

const mockRes = () => {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};
const reqFor = (shopId: string | undefined, body?: any) => ({
  params: { id: 'lead1' }, body: body ?? {}, user: shopId ? { shopId } : {},
} as any);

describe('shop lead-conversation ownership gate', () => {
  beforeEach(() => {
    jest.spyOn(LeadRepository.prototype, 'findById').mockResolvedValue({ id: 'lead1', campaignId: 'camp1' } as any);
    jest.spyOn(CampaignRepository.prototype, 'getShopIdForCampaign').mockResolvedValue('shopA' as any);
  });
  afterEach(() => jest.restoreAllMocks());

  it('returns the thread when the shop owns the lead', async () => {
    const res = mockRes();
    await getShopLeadThread(reqFor('shopA'), res);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [{ id: 'm1' }] });
  });

  it('404s when a DIFFERENT shop tries to read the lead', async () => {
    const res = mockRes();
    await getShopLeadThread(reqFor('shopB'), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('401s when there is no shop id on the request', async () => {
    const res = mockRes();
    await getShopLeadThread(reqFor(undefined), res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects a manual reply to another shop\'s lead (404), before sending', async () => {
    const res = mockRes();
    await postShopLeadMessage(reqFor('shopB', { body: 'hello' }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('sends a manual reply (201) when the shop owns the lead', async () => {
    const res = mockRes();
    await postShopLeadMessage(reqFor('shopA', { body: 'hello' }), res);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('404s an AI auto-answer for another shop\'s lead', async () => {
    const res = mockRes();
    await autoAnswerShopLead(reqFor('shopB'), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
