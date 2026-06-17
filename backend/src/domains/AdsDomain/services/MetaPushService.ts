// backend/src/domains/AdsDomain/services/MetaPushService.ts
//
// Stage-4 PUSH orchestration (Phase 1). On Build, create the real Campaign + Ad Set on the
// shop's connected Meta ad account — PAUSED (Option B: admin reviews + goes live later). The
// ad + creative come in Phase 2; insights in Phase 3; go-live/status in Phase 4/5. Gated by
// ADS_META_PUSH_ENABLED + a configured Meta App; until on, Build stays record-only (no regression).

import { logger } from '../../../utils/logger';
import { metaService } from './MetaService';
import { buildCampaignSpec } from './metaTargeting';
import { decryptToken } from '../../../utils/tokenCrypto';
import { MetaConnectionRepository } from '../repositories/MetaConnectionRepository';
import { CampaignRepository, AdCampaign } from '../repositories/CampaignRepository';
import { AdCampaignRequest } from '../repositories/CampaignRequestRepository';

export class MetaPushService {
  constructor(
    private readonly connections = new MetaConnectionRepository(),
    private readonly campaigns = new CampaignRepository()
  ) {}

  /** Push is live only when the flag is on AND a Meta App is configured. */
  enabled(): boolean {
    return process.env.ADS_META_PUSH_ENABLED === 'true' && metaService.isConfigured();
  }

  /** Create PAUSED Campaign + Ad Set on the shop's ad account; persist ids on our campaign.
   *  Throws (with rollback of any created Meta objects) on failure — caller maps to 502. */
  async pushNewCampaign(shopId: string, request: AdCampaignRequest, campaign: AdCampaign): Promise<void> {
    const conn = await this.connections.getConnection(shopId);
    if (!conn?.userTokenEnc || !conn.adAccountId || !conn.pageId) {
      throw new Error('meta_not_connected: shop must connect its Meta ad account + Page first');
    }
    const token = decryptToken(conn.userTokenEnc);

    // Account must be active. (Funding source is verified at GO-LIVE — Phase 5 — since a
    // PAUSED draft never spends; this lets dev/test ad accounts build objects.)
    const status = await metaService.getAccountStatus(conn.adAccountId, token);
    if (status.accountStatus !== 1) throw new Error('ad_account_not_active: the shop\'s Meta ad account is not active');

    const geo = await this.connections.getShopGeo(shopId);
    const spec = buildCampaignSpec({
      goal: request.goal,
      monthlyBudgetCents: request.monthlyBudgetCents,
      targetRadiusMiles: request.targetRadiusMiles,
      lat: geo.lat,
      lng: geo.lng,
    });

    let metaCampaignId: string | undefined;
    let metaAdSetId: string | undefined;
    try {
      metaCampaignId = await metaService.createCampaign(conn.adAccountId, token, {
        name: campaign.name, objective: spec.objective,
      });
      metaAdSetId = await metaService.createAdSet(conn.adAccountId, token, {
        name: `${campaign.name} — ad set`,
        campaignId: metaCampaignId,
        dailyBudgetCents: spec.dailyBudgetCents,
        optimizationGoal: spec.optimizationGoal,
        billingEvent: spec.billingEvent,
        targeting: spec.targeting,
        promotedPageId: conn.pageId,
      });
      await this.campaigns.setMetaObjects(campaign.id, { metaCampaignId, metaAdSetId, metaStatus: 'PAUSED' });
      logger.info(`MetaPushService: created PAUSED campaign ${metaCampaignId} / adset ${metaAdSetId} for shop ${shopId}`);
    } catch (err) {
      // Roll back any Meta objects we created so there are no orphans.
      if (metaAdSetId) await metaService.deleteObject(metaAdSetId, token);
      if (metaCampaignId) await metaService.deleteObject(metaCampaignId, token);
      throw err;
    }
  }
}

export const metaPushService = new MetaPushService();
