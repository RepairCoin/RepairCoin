// Messenger Phase 2 — the click-to-Messenger (OUTCOME_ENGAGEMENT) objective: the pure spec builder +
// the ad-set / creative body shapes MetaService sends. Live delivery is App-Review-gated, so the Graph
// call is stubbed and we assert the request body it would send.
import { buildCampaignSpec, optimizationForObjective, asMetaObjective } from '../../src/domains/AdsDomain/services/metaTargeting';
import { MetaService } from '../../src/domains/AdsDomain/services/MetaService';

describe('metaTargeting — Messenger objective', () => {
  it('goal "messages" → OUTCOME_ENGAGEMENT + CONVERSATIONS + messagingDestination', () => {
    const spec = buildCampaignSpec({ goal: 'messages', monthlyBudgetCents: 30000, targetRadiusMiles: 10, lat: 1, lng: 2 });
    expect(spec.objective).toBe('OUTCOME_ENGAGEMENT');
    expect(spec.optimizationGoal).toBe('CONVERSATIONS');
    expect(spec.messagingDestination).toBe(true);
  });
  it('an explicit OUTCOME_ENGAGEMENT objective override wins over the goal', () => {
    const spec = buildCampaignSpec({ goal: 'more_bookings', objective: 'OUTCOME_ENGAGEMENT', monthlyBudgetCents: 30000, targetRadiusMiles: null, lat: null, lng: null });
    expect(spec.objective).toBe('OUTCOME_ENGAGEMENT');
    expect(spec.messagingDestination).toBe(true);
  });
  it('a non-messaging objective is not flagged', () => {
    expect(buildCampaignSpec({ goal: 'more_bookings', monthlyBudgetCents: 30000, targetRadiusMiles: null, lat: null, lng: null }).messagingDestination).toBe(false);
    expect(optimizationForObjective('OUTCOME_ENGAGEMENT')).toEqual({ optimizationGoal: 'CONVERSATIONS', billingEvent: 'IMPRESSIONS' });
    expect(asMetaObjective('OUTCOME_ENGAGEMENT')).toBe('OUTCOME_ENGAGEMENT');
  });
});

describe('MetaService — Messenger ad set + creative body', () => {
  const svc = new MetaService();
  let body: any;
  beforeEach(() => { body = undefined; (svc as any).create = async (_p: string, _t: string, b: any) => { body = b; return 'id123'; }; });

  it('ad set targets the MESSENGER destination + promotes the page', async () => {
    await svc.createAdSet('act_1', 'tok', {
      name: 'x', campaignId: 'c', dailyBudgetCents: 100, optimizationGoal: 'CONVERSATIONS',
      billingEvent: 'IMPRESSIONS', targeting: {}, promotedPageId: 'PAGE1', messagingDestination: true,
    });
    expect(body.destination_type).toBe('MESSENGER');
    expect(JSON.parse(body.promoted_object)).toEqual({ page_id: 'PAGE1' });
  });

  it('creative uses the MESSAGE_PAGE CTA and NO outbound link', async () => {
    await svc.createAdCreative('act_1', 'tok', { pageId: 'PAGE1', imageUrl: 'img', headline: 'H', message: 'M', linkUrl: 'https://x', messaging: true });
    const oss = JSON.parse(body.object_story_spec);
    expect(oss.link_data.call_to_action.type).toBe('MESSAGE_PAGE');
    expect(oss.link_data.call_to_action.value).toEqual({ app_destination: 'MESSENGER' });
    expect(oss.link_data.link).toBeUndefined();
  });

  it('a normal creative keeps the landing link (LEARN_MORE)', async () => {
    await svc.createAdCreative('act_1', 'tok', { pageId: 'PAGE1', imageUrl: 'img', headline: 'H', message: 'M', linkUrl: 'https://x' });
    const oss = JSON.parse(body.object_story_spec);
    expect(oss.link_data.call_to_action.type).toBe('LEARN_MORE');
    expect(oss.link_data.link).toBe('https://x');
  });
});
