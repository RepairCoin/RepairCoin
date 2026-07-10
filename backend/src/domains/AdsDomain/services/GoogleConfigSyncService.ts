// backend/src/domains/AdsDomain/services/GoogleConfigSyncService.ts
//
// Two-way Google ⇄ app config sync (Slice 5: budget + status). Pulls a PUSHED Google campaign's
// current config back FROM Google and reconciles it into our DB, so the dashboard reflects manual
// Google-Ads edits and in-app actions don't clobber them. Google is source-of-truth for live
// campaigns; pre-push drafts are skipped (app is truth). Gated by ADS_GOOGLE_CONFIG_SYNC.
// Mirrors MetaConfigSyncService (simpler — no creative/targeting reflect for Google).

import { logger } from '../../../utils/logger';
import { googleAdsService } from './GoogleAdsService';
import { decryptToken } from '../../../utils/tokenCrypto';
import {
  reconcileGoogleFields, isGoogleCampaignRemoved, isGoogleObjectGone,
  ReconcileGoogleChanges,
} from './googleConfigSync';
import { GoogleConnectionRepository } from '../repositories/GoogleConnectionRepository';
import { CampaignRepository } from '../repositories/CampaignRepository';

export function isGoogleConfigSyncEnabled(): boolean {
  return process.env.ADS_GOOGLE_CONFIG_SYNC === 'true' && googleAdsService.isConfigured();
}

export type GoogleReconcileStatus = 'disabled' | 'skipped' | 'synced' | 'in_sync' | 'diverged' | 'error';
export interface GoogleReconcileResult {
  status: GoogleReconcileStatus;
  changes: ReconcileGoogleChanges & { status?: string };
  reason?: 'not_pushed' | 'disconnected' | 'google_removed';
  error?: string;
}

export class GoogleConfigSyncService {
  constructor(
    private readonly connections = new GoogleConnectionRepository(),
    private readonly campaigns = new CampaignRepository()
  ) {}

  /** Reconcile one campaign's config FROM Google. No-op when disabled, not pushed (no
   *  google_campaign_id → app is truth), or the shop is disconnected. Non-throwing. */
  async reconcile(campaignId: string): Promise<GoogleReconcileResult> {
    if (!isGoogleConfigSyncEnabled()) return { status: 'disabled', changes: {} };
    try {
      const c = await this.campaigns.findById(campaignId);
      if (!c || !c.googleCampaignId) return { status: 'skipped', reason: 'not_pushed', changes: {} };

      const conn = await this.connections.getConnection(c.shopId);
      if (!conn?.refreshTokenEnc || !conn.customerId) return { status: 'skipped', reason: 'disconnected', changes: {} };
      const token = decryptToken(conn.refreshTokenEnc);
      const login = conn.managerId ?? undefined;

      let cfg;
      try {
        cfg = await googleAdsService.fetchCampaignConfig(conn.customerId, token, c.googleCampaignId, login);
      } catch (err) {
        // A hard not-found means the campaign was deleted — reflect as diverged + halt.
        if (isGoogleObjectGone((err as Error)?.message)) return this.markDiverged(campaignId, c);
        throw err;
      }

      // REMOVED in Google Ads → reflect as archived + halt (never reverse it).
      if (isGoogleCampaignRemoved(cfg.campaignStatus)) return this.markDiverged(campaignId, c);

      const changes = reconcileGoogleFields(
        { dailyBudgetCents: c.dailyBudgetCents, status: c.status, googleStatus: c.googleStatus },
        { dailyBudgetCents: cfg.dailyBudgetCents, campaignStatus: cfg.campaignStatus }
      );

      if (changes.dailyBudgetCents !== undefined || changes.status !== undefined) {
        await this.campaigns.update(campaignId, {
          ...(changes.dailyBudgetCents !== undefined ? { dailyBudgetCents: changes.dailyBudgetCents } : {}),
          ...(changes.status !== undefined ? { status: changes.status as any } : {}),
        });
      }

      // Reflect RSA copy + keywords from Google (composer parity with Meta D3). Google is source for a
      // pushed campaign; unsaved local composer edits aren't persisted, so they're never clobbered.
      let nextContent: any;
      if (c.googleAdGroupId) {
        try {
          const fetched = await googleAdsService.fetchAdContent(conn.customerId, token, c.googleAdGroupId, login);
          if (fetched.headlines.length || fetched.keywords.length) {
            const cur = c.googleAdContent;
            const key = (h: string[], d: string[], k: string[]) => JSON.stringify([h, d, k]);
            if (!cur || key(cur.headlines, cur.descriptions, cur.keywords) !== key(fetched.headlines, fetched.descriptions, fetched.keywords)) {
              nextContent = { headlines: fetched.headlines, descriptions: fetched.descriptions, keywords: fetched.keywords, finalUrl: fetched.finalUrl };
              (changes as any).adContent = true;
            }
          }
        } catch { /* content read is best-effort — budget/status already reconciled */ }
      }

      // Stamp the check; persist the raw Google status + reflected content when they changed.
      await this.campaigns.setGoogleObjects(campaignId, {
        ...(changes.googleStatus !== undefined ? { googleStatus: changes.googleStatus } : {}),
        ...(nextContent ? { googleAdContent: nextContent } : {}),
        googleSyncedConfigAt: new Date(),
      });

      const changed = Object.keys(changes).length > 0;
      if (changed) logger.info('GoogleConfigSync: reconciled campaign from Google', { campaignId, changes });
      return { status: changed ? 'synced' : 'in_sync', changes };
    } catch (err) {
      const msg = (err as Error)?.message || 'google_read_failed';
      logger.error('GoogleConfigSync.reconcile failed (non-fatal)', { campaignId, error: msg });
      return { status: 'error', error: msg, changes: {} };
    }
  }

  /** The live Google campaign is REMOVED/deleted: reflect as archived (so in-app actions halt) and
   *  never recreate. Idempotent (skips the status update if already archived). */
  private async markDiverged(campaignId: string, c: { status: string }): Promise<GoogleReconcileResult> {
    const changes: GoogleReconcileResult['changes'] = {};
    if (c.status !== 'archived') {
      await this.campaigns.update(campaignId, { status: 'archived' as any });
      changes.status = 'archived';
    }
    changes.googleStatus = 'REMOVED';
    await this.campaigns.setGoogleObjects(campaignId, { googleStatus: 'REMOVED', googleSyncedConfigAt: new Date() });
    logger.warn('GoogleConfigSync: campaign diverged on Google (removed) — reflected as archived, halting in-app actions', { campaignId });
    return { status: 'diverged', reason: 'google_removed', changes };
  }

  /** Reconcile every pushed Google campaign for connected shops (nightly). Returns count reached. */
  async reconcileAll(): Promise<number> {
    if (!isGoogleConfigSyncEnabled()) return 0;
    const camps = await this.campaigns.listWithGoogleCampaign().catch(() => []);
    let n = 0;
    for (const c of camps) {
      const r = await this.reconcile(c.id);
      if (r.status === 'synced' || r.status === 'in_sync' || r.status === 'diverged') n++;
    }
    logger.info('GoogleConfigSync.reconcileAll done', { reached: n, scanned: camps.length });
    return n;
  }
}

export const googleConfigSyncService = new GoogleConfigSyncService();
