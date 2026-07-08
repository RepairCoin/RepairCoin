// Grounding: the lead-reply AI must be fed the shop's live service catalog + the ad's creative copy,
// so it answers "do you offer X?" decisively instead of always deferring. Asserts generateReply builds
// those system blocks (and that ADS_AI_CATALOG_GROUNDING=false / an empty catalog degrade cleanly).
process.env.SKIP_DB_CONNECTION_TESTS = 'true';
process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'test-key';

// Keep AI-memory recall out of the picture (no DB, deterministic).
jest.mock('../../src/domains/AIAgentDomain/services/AiMemoryService', () => ({
  getAiMemoryService: () => ({ recallBlock: async () => null }),
}));

import { LeadAutoAnswerService } from '../../src/domains/AdsDomain/services/LeadAutoAnswerService';

type Block = { text: string; cache: boolean };

function buildService(overrides: { services?: any; creatives?: any } = {}) {
  let captured: Block[] = [];
  const anthropic = {
    complete: async ({ systemPrompt }: any) => {
      captured = systemPrompt;
      return { text: 'ok', costUsd: 0.0001, model: 'claude-haiku-4-5-20251001' };
    },
  };
  const spendCap = { canSpend: async () => ({ allowed: true }), recordSpend: async () => {} };
  const brandKit = { getBrandKit: async () => ({ brandVoice: 'warm', industryStyle: 'artisan café' }) };
  const lead = { id: 'L1', campaignId: 'C1', creativeId: null, leadStatus: 'contacted', messengerId: 'PSID1' };
  const leads = { findById: async () => lead, updateStatus: async () => {}, clearEscalated: async () => {} };
  const campaigns = { findById: async () => ({ id: 'C1', shopId: 'shop1', name: 'Test Campaign', aiAgentEnabled: true }) };
  const aiCosts = { record: async () => {} };
  const messages = {
    listByLead: async () => [{ author: 'lead', body: 'Do you offer baking training?' }],
    append: async (m: any) => ({ ...m, id: 'm1', createdAt: new Date() }),
  };
  const services = overrides.services ?? {
    getServicesByShop: async () => ({
      items: [
        { serviceName: 'Baking Training', category: 'education_classes', priceUsd: 75, durationMinutes: 120, description: 'Hands-on class', active: true },
      ],
      pagination: {},
    }),
  };
  const creatives = overrides.creatives ?? {
    findById: async () => null,
    listByCampaign: async () => [{ headline: '20% off Baking Classes', body: 'Learn to bake with us', reviewStatus: 'approved' }],
  };
  const channel = { deliver: async () => 'sent' };

  const svc = new LeadAutoAnswerService(
    anthropic as any, spendCap as any, brandKit as any, leads as any, campaigns as any,
    aiCosts as any, messages as any, services as any, creatives as any, channel as any
  );
  return { svc, text: () => captured.map((b) => b.text).join('\n') };
}

describe('LeadAutoAnswerService — catalog + creative grounding', () => {
  afterEach(() => { delete process.env.ADS_AI_CATALOG_GROUNDING; });

  it('injects the service catalog (name + price) and the ad creative copy', async () => {
    const { svc, text } = buildService();
    await svc.generateReply('L1');
    const t = text();
    expect(t).toContain('Baking Training');
    expect(t).toContain('$75');
    expect(t).toContain('ONLY services this shop offers');
    expect(t).toContain('20% off Baking Classes'); // creative headline
  });

  it('omits both blocks when ADS_AI_CATALOG_GROUNDING=false', async () => {
    process.env.ADS_AI_CATALOG_GROUNDING = 'false';
    const { svc, text } = buildService();
    await svc.generateReply('L1');
    const t = text();
    expect(t).not.toContain('Baking Training');
    expect(t).not.toContain('20% off Baking Classes');
  });

  it('degrades cleanly when the shop has no active services (creative still injected)', async () => {
    const { svc, text } = buildService({ services: { getServicesByShop: async () => ({ items: [], pagination: {} }) } });
    await svc.generateReply('L1');
    const t = text();
    expect(t).not.toContain('ONLY services this shop offers');
    expect(t).toContain('20% off Baking Classes');
  });
});
