// backend/src/domains/AdsDomain/services/GooglePushService.ts
//
// Google go-live + status mirror. Mirrors MetaPushService.pushStatus / goLive for the Google plan.
// Campaigns are created PAUSED (see GoogleAdsService.createSearchCampaign); this enables/pauses the
// campaign + ad group + ad(s) on the shop's own Google Ads account. Gated by ADS_GOOGLE_PUSH_ENABLED
// + a configured Google app. The DB stays source-of-truth; a transient Google error on a best-effort
// pause shouldn't fail the toggle (callers catch), but go-live surfaces errors to the admin.

import { logger } from '../../../utils/logger';
import { googleAdsService } from './GoogleAdsService';
import { decryptToken } from '../../../utils/tokenCrypto';
import { GoogleConnectionRepository } from '../repositories/GoogleConnectionRepository';
import { CampaignRepository } from '../repositories/CampaignRepository';

export class GooglePushService {
  constructor(
    private readonly connections = new GoogleConnectionRepository(),
    private readonly campaigns = new CampaignRepository()
  ) {}

  /** Push is live only when the flag is on AND a Google app is configured. */
  enabled(): boolean {
    return process.env.ADS_GOOGLE_PUSH_ENABLED === 'true' && googleAdsService.isConfigured();
  }

  /** Mirror a status change (ENABLED|PAUSED) to the campaign's Google objects. Used by go-live and
   *  admin/shop pause/activate. Returns false when there's nothing to push (not enabled / not a
   *  pushed Google campaign / disconnected). Throws on a Google error so go-live can surface it;
   *  best-effort callers (pause/activate toggle) should catch. */
  async pushStatus(campaignId: string, status: 'ENABLED' | 'PAUSED'): Promise<boolean> {
    if (!this.enabled()) return false;
    const campaign = await this.campaigns.findById(campaignId);
    if (!campaign?.googleCampaignId || !campaign.googleAdGroupId) return false;
    const conn = await this.connections.getConnection(campaign.shopId);
    if (!conn?.refreshTokenEnc || !conn.customerId) return false;
    const token = decryptToken(conn.refreshTokenEnc);
    await googleAdsService.setCampaignServingStatus(
      conn.customerId,
      token,
      { campaignId: campaign.googleCampaignId, adGroupId: campaign.googleAdGroupId },
      status,
      conn.managerId ?? undefined
    );
    await this.campaigns.setGoogleObjects(campaignId, { googleStatus: status });
    return true;
  }

  /** Go live: verify a conversion action + funding source on the shop's Google account (real spend
   *  starts here), then enable the campaign / ad group / ad. Throws a descriptive error for the UI.
   *  Both preconditions are unattainable on a TEST account, so this is effectively prod-only. */
  async goLive(campaignId: string): Promise<void> {
    if (!this.enabled()) throw new Error('push_disabled');
    const campaign = await this.campaigns.findById(campaignId);
    if (!campaign?.googleCampaignId || !campaign.googleAdGroupId) throw new Error('not_a_google_draft');
    // Never re-activate a campaign whose Google objects were archived/removed.
    if (campaign.status === 'archived') {
      throw new Error('campaign_archived_on_google: this campaign was archived or removed; it cannot go live again');
    }
    const conn = await this.connections.getConnection(campaign.shopId);
    if (!conn?.refreshTokenEnc || !conn.customerId) throw new Error('google_not_connected');
    const token = decryptToken(conn.refreshTokenEnc);
    const login = conn.managerId ?? undefined;

    const pre = await googleAdsService.getGoLivePreconditions(conn.customerId, token, login);
    if (!pre.hasConversionAction) {
      throw new Error('no_conversion_action: add a conversion action in Google Ads before going live (needed to measure & optimize).');
    }
    if (!pre.hasFunding) {
      throw new Error('no_funding_source: add a payment method to the shop\'s Google Ads account before going live.');
    }

    await googleAdsService.setCampaignServingStatus(
      conn.customerId,
      token,
      { campaignId: campaign.googleCampaignId, adGroupId: campaign.googleAdGroupId },
      'ENABLED',
      login
    );
    await this.campaigns.setGoogleObjects(campaignId, { googleStatus: 'ENABLED' });
    logger.info(`GooglePushService: campaign ${campaign.googleCampaignId} set ENABLED (go-live) for shop ${campaign.shopId}`);
  }
}

export const googlePushService = new GooglePushService();
