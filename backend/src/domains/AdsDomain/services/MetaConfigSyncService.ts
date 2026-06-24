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
import { CreativeRepository } from '../repositories/CreativeRepository';

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
export interface ReconcileChanges {
  dailyBudgetCents?: number; status?: string; metaStatus?: string;
  creativeExternallyEdited?: boolean;
  objective?: string; targetRadiusMiles?: number;
}

/** PURE: best-effort radius (in miles, rounded) from a Meta targeting spec. Reads the first custom
 *  geo location's radius + distance_unit (Meta gives 'mile' or 'kilometer'). Returns null when
 *  there's no custom-location radius to read. km→mi via /1.609. Unit-testable. */
export function extractRadiusMiles(targeting: any): number | null {
  const loc = targeting?.geo_locations?.custom_locations?.[0];
  const radius = loc?.radius;
  if (radius == null || radius === '' || isNaN(Number(radius))) return null;
  const r = Number(radius);
  const unit = String(loc?.distance_unit || 'mile').toLowerCase();
  const miles = unit.startsWith('kilom') || unit === 'km' ? r / 1.609 : r;
  return Math.round(miles);
}

/** Outcome of a reconcile, so callers can message distinctly (a Meta-read failure is NOT the
 *  same as "already in sync"; a campaign DELETED in Ads Manager is "diverged", not an error). */
export type ReconcileStatus = 'disabled' | 'skipped' | 'synced' | 'in_sync' | 'diverged' | 'error';
export interface ReconcileResult {
  status: ReconcileStatus;
  changes: ReconcileChanges;
  reason?: 'not_pushed' | 'disconnected' | 'meta_archived' | 'meta_deleted';
  error?: string;
}

/** PURE: does a Meta Graph error message indicate the object no longer exists (deleted in Ads
 *  Manager), as opposed to a transient/permission error? Matches Graph's "does not exist" /
 *  "Unsupported get request" / subcode 33. Used to treat a 404 as divergence (D5), not an error. */
export function isMetaObjectGone(message: string | null | undefined): boolean {
  const m = (message || '').toLowerCase();
  return m.includes('does not exist') || m.includes('unsupported get request') || m.includes('/33)');
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
    private readonly campaigns = new CampaignRepository(),
    private readonly creatives = new CreativeRepository()
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

      let adset, campaign;
      try {
        [adset, campaign] = await Promise.all([
          metaService.getAdSet(c.metaAdSetId, token),
          metaService.getCampaign(c.metaCampaignId, token),
        ]);
      } catch (err) {
        // D5 — a 404 ("does not exist") means the object was deleted in Ads Manager. Reflect it as
        // archived + halt; never recreate. A transient/permission error re-throws → 'error'.
        if (isMetaObjectGone((err as Error)?.message)) return this.markDiverged(campaignId, c, 'meta_deleted');
        throw err;
      }

      // D5 — object still exists but is archived/deleted on Meta → reflect + halt (don't reverse it).
      const eff = (campaign.effectiveStatus || '').toUpperCase();
      if (eff === 'ARCHIVED' || eff === 'DELETED') {
        return this.markDiverged(campaignId, c, eff === 'DELETED' ? 'meta_deleted' : 'meta_archived');
      }

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

      // Phase 2 — creative reflect + flag (D3). If the live ad's bound creative id ≠ the one we
      // pushed, it was swapped/edited in Ads Manager: pull the new spec into our AI creative row
      // and flag it (never auto-approve). Re-stamp metaCreativeId so we don't re-detect next run.
      if (c.metaAdId && c.metaCreativeId) {
        const ad = await metaService.getAd(c.metaAdId, token).catch(() => null);
        if (ad?.creativeId && ad.creativeId !== c.metaCreativeId) {
          const spec = await metaService.getCreativeSpec(ad.creativeId, token);
          if (spec) {
            await this.creatives.reflectExternalCreative(campaignId, {
              headline: spec.headline, body: spec.message, imageUrl: spec.picture,
            });
          } else {
            await this.creatives.flagExternallyEdited(campaignId); // diverged but spec unreadable
          }
          await this.campaigns.setMetaObjects(campaignId, { metaCreativeId: ad.creativeId });
          changes.creativeExternallyEdited = true;
          logger.info('MetaConfigSync: external creative swap reflected', {
            campaignId, from: c.metaCreativeId, to: ad.creativeId, specRead: !!spec,
          });
        }
      }

      // Phase 3 — objective + targeting reflect (read-only fidelity; D4: never reverse-push). Reflect
      // the objective and a best-effort radius (km→mi) into our typed columns for display; the full
      // targeting spec is stored raw below since rich targeting can't be losslessly round-tripped.
      const objChanged = !!campaign.objective && campaign.objective !== c.objective;
      const radiusMi = extractRadiusMiles(adset.targeting);
      const radiusChanged = radiusMi != null && radiusMi !== c.targetRadiusMiles;
      if (objChanged || radiusChanged) {
        await this.campaigns.update(campaignId, {
          ...(objChanged ? { objective: campaign.objective } : {}),
          ...(radiusChanged ? { targetRadiusMiles: radiusMi! } : {}),
        });
        if (objChanged) changes.objective = campaign.objective!;
        if (radiusChanged) changes.targetRadiusMiles = radiusMi!;
      }

      // Always stamp the sync time (records we checked); update metaStatus when it changed; persist
      // the raw targeting spec (fidelity) whenever Meta returned one.
      await this.campaigns.setMetaObjects(campaignId, {
        ...(changes.metaStatus !== undefined ? { metaStatus: changes.metaStatus } : {}),
        ...(adset.targeting != null ? { metaTargetingRaw: adset.targeting } : {}),
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

  /** D5 — the live Meta objects are archived/deleted: reflect the campaign as archived (so in-app
   *  actions halt) and never recreate. Idempotent (skips the status update if already archived). */
  private async markDiverged(
    campaignId: string,
    c: { status: string },
    reason: 'meta_archived' | 'meta_deleted'
  ): Promise<ReconcileResult> {
    const metaState = reason === 'meta_deleted' ? 'DELETED' : 'ARCHIVED';
    const changes: ReconcileChanges = {};
    if (c.status !== 'archived') {
      await this.campaigns.update(campaignId, { status: 'archived' as any });
      changes.status = 'archived';
    }
    changes.metaStatus = metaState;
    await this.campaigns.setMetaObjects(campaignId, { metaStatus: metaState, metaSyncedConfigAt: new Date() });
    logger.warn('MetaConfigSync: campaign diverged on Meta (archived/deleted) — reflected as archived, halting in-app actions', { campaignId, reason });
    return { status: 'diverged', reason, changes };
  }

  /** Reconcile every pushed campaign for connected shops (nightly). Returns count reached. */
  async reconcileAll(): Promise<number> {
    if (!isConfigSyncEnabled()) return 0;
    const camps = await this.campaigns.listWithMetaCampaign().catch(() => []);
    let n = 0;
    for (const c of camps) {
      const r = await this.reconcile(c.id);
      if (r.status === 'synced' || r.status === 'in_sync' || r.status === 'diverged') n++;
    }
    logger.info('MetaConfigSync.reconcileAll done', { reached: n, scanned: camps.length });
    return n;
  }
}

export const metaConfigSyncService = new MetaConfigSyncService();
