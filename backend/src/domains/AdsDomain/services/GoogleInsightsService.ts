// backend/src/domains/AdsDomain/services/GoogleInsightsService.ts
//
// Slice 4 — auto-import Google Ads insights so a Google campaign's spend/impressions/clicks show in
// the dashboard without manual entry. For every campaign pushed to Google, pull daily metrics via
// GAQL and write them to ad_performance_daily (partial upsert — leads/bookings/revenue stay
// pipeline-owned). Runs nightly in SafeguardScheduler.tick. Gated by ADS_GOOGLE_PUSH_ENABLED + a
// configured Google app. Mirrors MetaInsightsService.

import { logger } from '../../../utils/logger';
import { googleAdsService } from './GoogleAdsService';
import { mapGoogleInsights } from './googleInsights';
import { decryptToken } from '../../../utils/tokenCrypto';
import { GoogleConnectionRepository } from '../repositories/GoogleConnectionRepository';
import { CampaignRepository } from '../repositories/CampaignRepository';
import { PerformanceRepository } from '../repositories/PerformanceRepository';

export class GoogleInsightsService {
  constructor(
    private readonly connections = new GoogleConnectionRepository(),
    private readonly campaigns = new CampaignRepository(),
    private readonly perf = new PerformanceRepository()
  ) {}

  enabled(): boolean {
    return process.env.ADS_GOOGLE_PUSH_ENABLED === 'true' && googleAdsService.isConfigured();
  }

  /** Sync insights for all pushed Google campaigns. Returns the count synced. Per-campaign errors
   *  are logged and skipped (one bad token/campaign never stops the rest). */
  async syncAll(sinceDays = 14): Promise<number> {
    if (!this.enabled()) return 0;
    const camps = await this.campaigns.listWithGoogleCampaign().catch(() => []);
    // Resolve the connection (token + customerId + login-customer-id) once per shop.
    const connByShop = new Map<string, { token: string; customerId: string; managerId?: string } | null>();
    let synced = 0;
    for (const c of camps) {
      try {
        if (!connByShop.has(c.shopId)) {
          const conn = await this.connections.getConnection(c.shopId);
          connByShop.set(
            c.shopId,
            conn?.refreshTokenEnc && conn.customerId
              ? { token: decryptToken(conn.refreshTokenEnc), customerId: conn.customerId, managerId: conn.managerId ?? undefined }
              : null
          );
        }
        const conn = connByShop.get(c.shopId);
        if (!conn) continue; // shop disconnected — skip
        const rows = await googleAdsService.fetchCampaignInsights(conn.customerId, conn.token, c.googleCampaignId, sinceDays, conn.managerId);
        for (const d of mapGoogleInsights(rows)) {
          await this.perf.upsertGoogleInsights(c.id, d.date, d);
        }
        await this.campaigns.setGoogleObjects(c.id, { googleLastSyncedAt: new Date() });
        synced++;
      } catch (err: any) {
        logger.error(`GoogleInsightsService: sync failed for campaign ${c.id}`, err?.message || err);
      }
    }
    return synced;
  }
}

export const googleInsightsService = new GoogleInsightsService();
