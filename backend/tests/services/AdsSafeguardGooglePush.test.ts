// backend/tests/services/AdsSafeguardGooglePush.test.ts
//
// The nightly safeguard hard-pause must stop spend on BOTH platforms. Previously it only mirrored
// to Meta, so a Google campaign flagged for auto-pause was marked paused in our DB but kept spending
// on Google. This verifies SafeguardScheduler.tick() pushes PAUSED to Meta AND Google for each
// hard_pause decision (each pushStatus no-ops for the wrong platform), and not for non-hard-pause.

// SafeguardScheduler → MetaPushService → AdCreativeService eagerly constructs an AnthropicClient,
// which throws without ANTHROPIC_API_KEY. We don't exercise creative here, so stub the client out.
jest.mock('../../src/domains/AIAgentDomain/services/AnthropicClient');

import { SafeguardScheduler } from '../../src/domains/AdsDomain/services/SafeguardScheduler';
import { metaPushService } from '../../src/domains/AdsDomain/services/MetaPushService';
import { googlePushService } from '../../src/domains/AdsDomain/services/GooglePushService';

describe('SafeguardScheduler — safeguard pause mirrors to Google', () => {
  const origMeta = (metaPushService as any).pushStatus;
  const origGoogle = (googlePushService as any).pushStatus;
  let metaCalls: any[];
  let googleCalls: any[];

  const okAsync = (v: any = 0) => (async () => v);

  // All injected deps stubbed to benign no-ops so tick() runs without a DB; the evaluator returns
  // one hard_pause + one 'none' decision.
  const makeScheduler = () => {
    const evaluator: any = { runNightly: async () => [
      { campaignId: 'c1', action: 'hard_pause' },
      { campaignId: 'c2', action: 'none' },
    ] };
    const perf: any = { rollUpFromPipeline: okAsync(), rollUpCohortRevenue: okAsync() };
    const leads: any = { purgeExpired: okAsync(0) };
    const billing: any = { runNightly: okAsync() };
    const subscriptions: any = { applyDueScheduledChanges: okAsync(0) };
    const metaConnections: any = { refreshExpiring: okAsync(0) };
    const metaInsights: any = { syncAll: okAsync(0) };
    const googleInsights: any = { syncAll: okAsync(0) };
    const metaConfigSync: any = { reconcileAll: okAsync(0) };
    const googleConfigSync: any = { reconcileAll: okAsync(0) };
    return new SafeguardScheduler(
      evaluator, perf, leads, billing, subscriptions, metaConnections,
      metaInsights, googleInsights, metaConfigSync, googleConfigSync
    );
  };

  beforeEach(() => {
    metaCalls = []; googleCalls = [];
    (metaPushService as any).pushStatus = async (id: string, status: string) => { metaCalls.push([id, status]); return true; };
    (googlePushService as any).pushStatus = async (id: string, status: string) => { googleCalls.push([id, status]); return true; };
  });
  afterEach(() => {
    (metaPushService as any).pushStatus = origMeta;
    (googlePushService as any).pushStatus = origGoogle;
  });

  it('pushes PAUSED to both Meta and Google for a hard_pause, and skips non-hard-pause decisions', async () => {
    await makeScheduler().tick();
    expect(metaCalls).toEqual([['c1', 'PAUSED']]);
    expect(googleCalls).toEqual([['c1', 'PAUSED']]);
  });
});
