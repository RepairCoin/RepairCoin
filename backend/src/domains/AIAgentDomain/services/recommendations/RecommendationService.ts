// backend/src/domains/AIAgentDomain/services/recommendations/RecommendationService.ts
//
// P0 — generate / read / dismiss for the dashboard recommendation feed.
// Scope: docs/tasks/strategy/ai-recommendations/scope.md
//
// Three layers, mirroring the Phase 7.2 anomaly engine:
//   1. DETECT  — run every registered detector (pure SQL, no Claude).
//   2. RANK+GATE — drop what the shop's tier can't act on, score, persist.
//   3. PHRASE  — deterministic templates from the detector (Claude is P4).
//
// Tier filtering runs at BOTH write and read time. Write-time keeps the table
// clean; read-time is the one that matters, because a shop can downgrade after
// generation and must not keep seeing rows it can no longer act on.

import { Pool } from 'pg';
import { logger } from '../../../../utils/logger';
import { getSharedPool } from '../../../../utils/database-pool';
import { getShopTier } from '../../../../utils/shopTier';
import { SubscriptionTier } from '../../../../config/subscriptionPlans';
import { tierAllowsFeature } from '../../../../config/featureTiers';
import { RECOMMENDATION_DETECTORS } from './registry';
import {
  RecCandidate,
  RecommendationDetector,
  RecommendationDto,
  RecPresentation,
} from './types';

/** How long a generated recommendation stays eligible to show. */
const EXPIRY_DAYS = 14;
/** Default snooze when the shop hides a card without dismissing it outright. */
const SNOOZE_DAYS = 14;
/** Cards returned to the dashboard block (the "View All" surface passes more). */
const DEFAULT_LIMIT = 3;

/**
 * The feature that gates the feed itself. Must match the route guard
 * (`requireTier('aiInsights')` in AIAgentDomain/routes.ts) so generation and
 * access agree — generating cards a shop can never fetch is pure waste.
 *
 * Tier is the ONLY eligibility rule here. This deliberately does NOT consult
 * `ai_shop_settings.ai_global_enabled`: that column is the AI *Sales Agent*
 * kill-switch (migration 110, read by AgentOrchestrator before replying to
 * customers) and is admin-set, not tier-derived. A shop that turned off
 * customer-facing AI replies has not asked to stop seeing its own dashboard
 * insights, and AI access is moving to tier-based entitlement anyway.
 *
 * Free tier has no AI features at all, so `tierAllowsFeature('free', ...)` is
 * false for every feature and a free shop generates nothing — including a shop
 * that lands on free after an unconverted trial.
 */
const FEED_FEATURE = 'aiInsights';

const SEVERITY_WEIGHT: Record<string, number> = {
  high: 100,
  medium: 50,
  low: 20,
};

/** Deterministic rank. Severity dominates; an action the shop can take without
 *  leaving the page breaks ties toward the cheaper interaction. */
export function scoreCandidate(c: RecCandidate): number {
  const base = SEVERITY_WEIGHT[c.severity] ?? 0;
  const actionBonus = c.action.kind === 'navigate' ? 2 : 1;
  return base + actionBonus;
}

export interface RecommendationServiceDeps {
  pool?: Pool;
  detectors?: RecommendationDetector[];
  /** Injectable so the tier filter can be tested without depending on a
   *  particular shop's subscription state (every staging shop is business). */
  resolveTier?: (shopId: string) => Promise<SubscriptionTier>;
}

export class RecommendationService {
  private readonly pool: Pool;
  private readonly detectors: RecommendationDetector[];
  private readonly resolveTier: (shopId: string) => Promise<SubscriptionTier>;

  constructor(deps: RecommendationServiceDeps = {}) {
    this.pool = deps.pool ?? getSharedPool();
    this.detectors = deps.detectors ?? RECOMMENDATION_DETECTORS;
    this.resolveTier = deps.resolveTier ?? getShopTier;
  }

  /**
   * Run every detector for one shop and persist what survives gating.
   * Returns the number of rows written.
   *
   * Safe to re-run: the partial unique index on (shop_id, detector_key)
   * WHERE acted_at IS NULL collapses duplicates, so a second run within the
   * same window is a no-op rather than a pile-up. Only an ACTED card releases
   * the slot — a dismissed card must never regenerate (migration 235), and a
   * snoozed one returns as the same row when its snooze expires.
   */
  async generateForShop(shopId: string): Promise<number> {
    const tier = await this.resolveTier(shopId);

    // Feed-level gate. One tier resolution, then an early exit — a below-tier
    // shop costs zero detector queries. This is what makes it safe for
    // runForAllShops to walk every shop rather than a pre-filtered subset.
    if (!tierAllowsFeature(tier, FEED_FEATURE)) return 0;

    let written = 0;

    for (const detector of this.detectors) {
      // Skip the query entirely when the shop couldn't act on the result —
      // no point spending SQL on a card we'd discard.
      if (
        detector.requiredFeature &&
        !tierAllowsFeature(tier, detector.requiredFeature)
      ) {
        continue;
      }

      let candidates: RecCandidate[] = [];
      try {
        candidates = await detector.detect(this.pool, shopId);
      } catch (err) {
        // One broken detector must not take down the whole feed.
        logger.error(
          `RecommendationService: detector "${detector.key}" failed for shop ${shopId}`,
          err
        );
        continue;
      }

      for (const c of candidates) {
        try {
          const result = await this.pool.query(
            `INSERT INTO ai_recommendations
               (shop_id, detector_key, category, severity, score, evidence, action,
                assistant_prompt, required_feature, title, description,
                presentation, cta_label, expires_at)
             VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10,$11,$12,$13,
                     NOW() + INTERVAL '${EXPIRY_DAYS} days')
             ON CONFLICT DO NOTHING`,
            [
              shopId,
              c.detectorKey,
              c.category,
              c.severity,
              scoreCandidate(c),
              JSON.stringify(c.evidence),
              JSON.stringify(c.action),
              c.assistantPrompt,
              detector.requiredFeature ?? null,
              c.title,
              c.description,
              c.presentation ?? 'card',
              c.ctaLabel ?? null,
            ]
          );
          written += result.rowCount ?? 0;
        } catch (err) {
          logger.error(
            `RecommendationService: insert failed for "${c.detectorKey}" / shop ${shopId}`,
            err
          );
        }
      }
    }

    return written;
  }

  /**
   * Nightly batch: generate for every active shop, gated purely on TIER.
   *
   * Eligibility is decided per shop inside generateForShop (see FEED_FEATURE),
   * not by a pre-filter here — so there is exactly one definition of "who gets
   * recommendations" and it is the same one the route guard enforces. Below-tier
   * shops early-exit after a single tier lookup.
   *
   * NOTE: this intentionally does NOT filter on `ai_shop_settings.
   * ai_global_enabled`. That column is the admin-set AI Sales Agent
   * kill-switch, not an entitlement, and it has a defaulting trap — the column
   * defaults to FALSE while the old query treated a MISSING row as true, so
   * merely creating a settings row silently dropped a shop from the batch.
   * (AnomalyDetector.runForAllShops still uses that predicate — same issue.)
   *
   * Expires nothing and deletes nothing: rows age out via expires_at, so a
   * re-run is safe and the history stays auditable.
   */
  async runForAllShops(): Promise<{
    shopsProcessed: number;
    shopsEligible: number;
    recommendationsWritten: number;
    shopErrors: number;
  }> {
    const shops = await this.pool.query<{ shop_id: string }>(
      `SELECT shop_id FROM shops WHERE active = true ORDER BY shop_id`
    );

    let written = 0;
    let shopErrors = 0;
    let eligible = 0;
    for (const row of shops.rows) {
      try {
        const tier = await this.resolveTier(row.shop_id);
        if (!tierAllowsFeature(tier, FEED_FEATURE)) continue;
        eligible++;
        written += await this.generateForShop(row.shop_id);
      } catch (err) {
        shopErrors++;
        logger.error(
          `RecommendationService: shop ${row.shop_id} generation failed`,
          err
        );
      }
    }

    logger.info('RecommendationService: nightly run complete', {
      shopsProcessed: shops.rows.length,
      shopsEligible: eligible,
      recommendationsWritten: written,
      shopErrors,
    });

    return {
      shopsProcessed: shops.rows.length,
      shopsEligible: eligible,
      recommendationsWritten: written,
      shopErrors,
    };
  }

  /**
   * Active recommendations for the dashboard, newest-and-highest-scoring first.
   *
   * Re-checks `required_feature` against the CURRENT tier — a shop that
   * downgrades stops seeing rows it can no longer act on, without needing a
   * regeneration pass.
   */
  async listForShop(
    shopId: string,
    limit = DEFAULT_LIMIT,
    presentation: RecPresentation = 'card'
  ): Promise<RecommendationDto[]> {
    const tier = await this.resolveTier(shopId);

    const rows = await this.pool.query<{
      id: string;
      detector_key: string;
      category: any;
      severity: any;
      title: string;
      description: string;
      action: any;
      assistant_prompt: string | null;
      evidence: any;
      required_feature: string | null;
      presentation: RecPresentation;
      cta_label: string | null;
      detected_at: Date;
    }>(
      `SELECT id, detector_key, category, severity, title, description,
              action, assistant_prompt, evidence, required_feature,
              presentation, cta_label, detected_at
         FROM ai_recommendations
        WHERE shop_id = $1
          AND presentation = $2
          AND dismissed_at IS NULL
          AND acted_at IS NULL
          AND (snoozed_until IS NULL OR snoozed_until < NOW())
          AND expires_at > NOW()
        ORDER BY score DESC, detected_at DESC`,
      [shopId, presentation]
    );

    return rows.rows
      .filter(
        (r) =>
          !r.required_feature || tierAllowsFeature(tier, r.required_feature)
      )
      .slice(0, limit)
      .map((r) => ({
        id: r.id,
        detectorKey: r.detector_key,
        category: r.category,
        severity: r.severity,
        title: r.title,
        description: r.description,
        action: r.action,
        assistantPrompt: r.assistant_prompt,
        evidence: r.evidence ?? {},
        presentation: r.presentation,
        ctaLabel: r.cta_label,
        detectedAt: r.detected_at.toISOString(),
      }));
  }

  /**
   * How many active recommendations this shop's tier hides. Powers the honest
   * "N more available on Business" line instead of dangling locked cards.
   */
  async countGatedForShop(shopId: string): Promise<number> {
    const tier = await this.resolveTier(shopId);
    const rows = await this.pool.query<{ required_feature: string | null }>(
      `SELECT required_feature
         FROM ai_recommendations
        WHERE shop_id = $1
          AND dismissed_at IS NULL
          AND acted_at IS NULL
          AND (snoozed_until IS NULL OR snoozed_until < NOW())
          AND expires_at > NOW()
          AND required_feature IS NOT NULL`,
      [shopId]
    );
    return rows.rows.filter(
      (r) => r.required_feature && !tierAllowsFeature(tier, r.required_feature)
    ).length;
  }

  /**
   * Hide one recommendation. `permanent` = never show this detector's card
   * again for this shop; otherwise it's a SNOOZE_DAYS snooze so a recurring
   * condition can resurface.
   *
   * Shop-scoped UPDATE — the caller's shopId, never the URL, decides scope.
   * Returns false when nothing matched (surfaced as 404 so the endpoint
   * doesn't leak whether an id exists).
   */
  async dismiss(
    shopId: string,
    id: string,
    permanent = false
  ): Promise<boolean> {
    const result = await this.pool.query(
      permanent
        ? `UPDATE ai_recommendations SET dismissed_at = NOW()
            WHERE id = $1 AND shop_id = $2 AND dismissed_at IS NULL`
        : `UPDATE ai_recommendations
              SET snoozed_until = NOW() + INTERVAL '${SNOOZE_DAYS} days'
            WHERE id = $1 AND shop_id = $2 AND dismissed_at IS NULL`,
      [id, shopId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /** Record a tap-through — the conversion signal for tuning detectors later. */
  async markActed(shopId: string, id: string): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE ai_recommendations SET acted_at = NOW()
        WHERE id = $1 AND shop_id = $2 AND acted_at IS NULL`,
      [id, shopId]
    );
    return (result.rowCount ?? 0) > 0;
  }
}

let _default: RecommendationService | null = null;
export function getRecommendationService(): RecommendationService {
  if (!_default) _default = new RecommendationService();
  return _default;
}
