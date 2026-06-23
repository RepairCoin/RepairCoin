// backend/src/domains/AdsDomain/services/MetaConfigSyncService.ts
//
// Two-way Meta ⇄ app config sync (Phase 1: budget + status). Pulls a PUSHED campaign's current
// config back from Meta and reconciles it into our DB, so the dashboard reflects manual
// Ads-Manager edits and in-app actions don't clobber them. Meta is source-of-truth for live
// campaigns (D1); pre-push drafts are skipped (app is truth). Gated by ADS_META_CONFIG_SYNC.
// See ads-meta-two-way-sync-implementation-plan.md.

import { logger } from '../../../utils/logger';
import { metaService } from './MetaService';
import { decryptToken } from '../../../utils/tokenCrypto';
import { MetaConnectionRepository } from '../repositories/MetaConnectionRepository';
import { CampaignRepository } from '../repositories/CampaignRepository';

export function isConfigSyncEnabled(): boolean {
  return process.env.ADS_META_CONFIG_SYNC === 'true' && metaService.isConfigured();
}

/** Meta's configured campaign status → our lowercase status. Returns null for states we don't
 *  map (PENDING_REVIEW, DISAPPROVED, …) so we leave our status untouched rather than guess. */
export function mapMetaStatus(metaStatus: string | null | undefined): 'active' | 'paused' | 'archived' | null {
  switch ((metaStatus || '').toUpperCase()) {
    case 'ACTIVE': return 'active';
    case 'PAUSED': return 'paused';
    case 'ARCHIVED':
    case 'DELETED': return 'archived';
    default: return null;
  }
}

export interface ReconcileDbState { dailyBudgetCents: number; status: string; metaStatus: string | null; }
export interface ReconcileMetaState { dailyBudgetCents: number | null; campaignStatus: string | null; }
export interface ReconcileChanges { dailyBudgetCents?: number; status?: string; metaStatus?: string }

/** Outcome of a reconcile, so callers can message distinctly (a Meta-read failure is NOT the
 *  same as "already in sync"). */
export type ReconcileStatus = 'disabled' | 'skipped' | 'synced' | 'in_sync' | 'error';
export interface ReconcileResult {
  status: ReconcileStatus;
  changes: ReconcileChanges;
  reason?: 'not_pushed' | 'disconnected';
  error?: string;
}

/**
 * PURE decision: given our DB state + Meta's current state, what should change (Meta wins, D1).
 * Returns only the fields that differ. Unit-testable without a DB/HTTP.
 */
export function reconcileFields(db: ReconcileDbState, meta: ReconcileMetaState): ReconcileChanges {
  const changes: ReconcileChanges = {};
  if (meta.dailyBudgetCents != null && meta.dailyBudgetCents !== db.dailyBudgetCents) {
    changes.dailyBudgetCents = meta.dailyBudgetCents;
  }
  const mapped = mapMetaStatus(meta.campaignStatus);
  if (mapped && mapped !== db.status) changes.status = mapped;
  if (meta.campaignStatus && meta.campaignStatus !== db.metaStatus) changes.metaStatus = meta.campaignStatus;
  return changes;
}

export class MetaConfigSyncService {
  constructor(
    private readonly connections = new MetaConnectionRepository(),
    private readonly campaigns = new CampaignRepository()
  ) {}

  /**
   * Reconcile one campaign's config from Meta. No-op when disabled, not pushed (no adset id →
   * app is truth), or the shop's token is missing. Non-throwing; returns the applied changes.
   */
  async reconcile(campaignId: string): Promise<ReconcileResult> {
    if (!isConfigSyncEnabled()) return { status: 'disabled', changes: {} };
    try {
      const c = await this.campaigns.findById(campaignId);
      if (!c || !c.metaAdSetId || !c.metaCampaignId) return { status: 'skipped', reason: 'not_pushed', changes: {} }; // pre-push → app is truth (D1)

      const conn = await this.connections.getConnection(c.shopId);
      if (!conn?.userTokenEnc) return { status: 'skipped', reason: 'disconnected', changes: {} };
      const token = decryptToken(conn.userTokenEnc);

      const [adset, campaign] = await Promise.all([
        metaService.getAdSet(c.metaAdSetId, token),
        metaService.getCampaign(c.metaCampaignId, token),
      ]);

      const changes = reconcileFields(
        { dailyBudgetCents: c.dailyBudgetCents, status: c.status, metaStatus: c.metaStatus },
        { dailyBudgetCents: adset.dailyBudgetCents, campaignStatus: campaign.status }
      );

      if (changes.dailyBudgetCents !== undefined || changes.status !== undefined) {
        await this.campaigns.update(campaignId, {
          ...(changes.dailyBudgetCents !== undefined ? { dailyBudgetCents: changes.dailyBudgetCents } : {}),
          ...(changes.status !== undefined ? { status: changes.status as any } : {}),
        });
      }
      // Always stamp the sync time (records we checked); update metaStatus when it changed.
      await this.campaigns.setMetaObjects(campaignId, {
        ...(changes.metaStatus !== undefined ? { metaStatus: changes.metaStatus } : {}),
        metaSyncedConfigAt: new Date(),
      });

      const changed = Object.keys(changes).length > 0;
      if (changed) logger.info('MetaConfigSync: reconciled campaign from Meta', { campaignId, changes });
      return { status: changed ? 'synced' : 'in_sync', changes };
    } catch (err) {
      const msg = (err as Error)?.message || 'meta_read_failed';
      logger.error('MetaConfigSync.reconcile failed (non-fatal)', { campaignId, error: msg });
      return { status: 'error', error: msg, changes: {} };
    }
  }

  /** Reconcile every pushed campaign for connected shops (nightly). Returns count reached. */
  async reconcileAll(): Promise<number> {
    if (!isConfigSyncEnabled()) return 0;
    const camps = await this.campaigns.listWithMetaCampaign().catch(() => []);
    let n = 0;
    for (const c of camps) {
      const r = await this.reconcile(c.id);
      if (r.status === 'synced' || r.status === 'in_sync') n++;
    }
    logger.info('MetaConfigSync.reconcileAll done', { reached: n, scanned: camps.length });
    return n;
  }
}

export const metaConfigSyncService = new MetaConfigSyncService();
