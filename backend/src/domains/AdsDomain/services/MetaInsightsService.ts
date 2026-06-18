// backend/src/domains/AdsDomain/services/MetaInsightsService.ts
//
// Stage-4 push Phase 3 — auto-import Meta insights so manual daily-metric entry is no longer
// needed. For every campaign pushed to Meta, pull spend/impressions/clicks and write them to
// ad_performance_daily (partial upsert — leads/bookings/revenue stay pipeline-owned). Runs
// nightly in SafeguardScheduler.tick. Gated by ADS_META_PUSH_ENABLED + a configured Meta App.

import { logger } from '../../../utils/logger';
import { metaService } from './MetaService';
import { mapInsights } from './metaInsights';
import { decryptToken } from '../../../utils/tokenCrypto';
import { MetaConnectionRepository } from '../repositories/MetaConnectionRepository';
import { CampaignRepository } from '../repositories/CampaignRepository';
import { PerformanceRepository } from '../repositories/PerformanceRepository';

export class MetaInsightsService {
  constructor(
    private readonly connections = new MetaConnectionRepository(),
    private readonly campaigns = new CampaignRepository(),
    private readonly perf = new PerformanceRepository()
  ) {}

  enabled(): boolean {
    return process.env.ADS_META_PUSH_ENABLED === 'true' && metaService.isConfigured();
  }

  /** Sync insights for all pushed campaigns. Returns the count synced. Per-campaign errors
   *  are logged and skipped (one bad token/campaign never stops the rest). */
  async syncAll(datePreset = 'last_7d'): Promise<number> {
    if (!this.enabled()) return 0;
    const camps = await this.campaigns.listWithMetaCampaign().catch(() => []);
    const tokenByShop = new Map<string, string | null>(); // decrypt once per shop
    let synced = 0;
    for (const c of camps) {
      try {
        if (!tokenByShop.has(c.shopId)) {
          const conn = await this.connections.getConnection(c.shopId);
          tokenByShop.set(c.shopId, conn?.userTokenEnc ? decryptToken(conn.userTokenEnc) : null);
        }
        const token = tokenByShop.get(c.shopId);
        if (!token) continue; // shop disconnected — skip
        const rows = await metaService.fetchCampaignInsights(c.metaCampaignId, token, datePreset);
        for (const d of mapInsights(rows)) {
          await this.perf.upsertMetaInsights(c.id, d.date, d);
        }
        await this.campaigns.setMetaObjects(c.id, { metaLastSyncedAt: new Date() });
        synced++;
      } catch (err: any) {
        logger.error(`MetaInsightsService: sync failed for campaign ${c.id}`, err?.message || err);
      }
    }
    return synced;
  }
}

export const metaInsightsService = new MetaInsightsService();
