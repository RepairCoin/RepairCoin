// backend/src/domains/AIAgentDomain/services/recommendations/RecommendationPhraser.ts
//
// P4 — optional AI phrasing for recommendation cards.
//
// Same shape as AnomalyPhraser: Claude does NOT decide what is worth
// surfacing (detectors already did that, in SQL). Claude only rewords a card
// that already exists, on the CHEAP model, one short call per card. That keeps
// cost proportional to what is actually shown rather than to what was scanned.
//
// Fail-safe at every step — spend cap exhausted, API error, unparseable JSON,
// or a rewrite that fails validation all leave ai_title/ai_description NULL and
// the deterministic template stands. The feed never renders blank because of
// this layer.
//
// ⚠️ THE VALIDATION THAT MATTERS
// This whole feature exists because the old dashboard told every shop "87
// inactive customers" regardless of their data. The rule that fixed it: every
// figure on a card comes from the detector's `evidence`. An AI rewrite is the
// one thing that can silently break that rule again — by rounding "10" to
// "about a dozen", dropping a number, or inventing one.
//
// So every number in the rewritten copy is checked against the evidence values
// (and the numbers already present in the template, which are evidence-derived
// — e.g. "4 others" for a count of 5). Any unaccounted figure and the rewrite is
// discarded wholesale. We would rather ship plain, correct copy than warm,
// wrong copy.

import { Pool } from 'pg';
import { logger } from '../../../../utils/logger';
import { getSharedPool } from '../../../../utils/database-pool';
import { cheapModel } from '../../../../config/aiModels';
import { AnthropicClient } from '../../services/AnthropicClient';
import { SpendCapEnforcer } from '../../services/SpendCapEnforcer';

interface UnphrasedRecommendation {
  id: string;
  shopId: string;
  detectorKey: string;
  title: string;
  description: string;
  evidence: Record<string, unknown>;
}

export interface RecommendationPhraserDeps {
  pool?: Pool;
  spendCap?: SpendCapEnforcer;
  anthropic?: AnthropicClient;
}

/** Numbers a rewrite is allowed to contain: the evidence values, plus every
 *  number already in the deterministic copy (those are evidence-derived — a
 *  description saying "and 4 others" for a count of 5 is legitimate). */
export function allowedNumbers(
  evidence: Record<string, unknown>,
  templateTitle: string,
  templateDescription: string
): Set<string> {
  const allowed = new Set<string>();
  for (const v of Object.values(evidence ?? {})) {
    if (typeof v === 'number') {
      allowed.add(String(v));
      allowed.add(String(Math.round(v)));
    } else if (typeof v === 'string') {
      for (const n of v.match(/\d+/g) ?? []) allowed.add(n);
    }
  }
  for (const n of `${templateTitle} ${templateDescription}`.match(/\d+/g) ?? []) {
    allowed.add(n);
  }
  return allowed;
}

/**
 * True when every number in `text` is accounted for by the evidence.
 * Thousands separators are stripped first so "$3,450" matches evidence 3450.
 */
export function copyIsEvidenceBacked(
  text: string,
  allowed: Set<string>
): boolean {
  const numbers = text.replace(/(\d),(?=\d{3}\b)/g, '$1').match(/\d+/g) ?? [];
  return numbers.every((n) => allowed.has(n));
}

export class RecommendationPhraser {
  private readonly pool: Pool;
  private readonly spendCap: SpendCapEnforcer;
  private anthropic: AnthropicClient | null;

  constructor(deps: RecommendationPhraserDeps = {}) {
    this.pool = deps.pool ?? getSharedPool();
    this.spendCap = deps.spendCap ?? new SpendCapEnforcer();
    this.anthropic = deps.anthropic ?? null;
  }

  private lazyAnthropic(): AnthropicClient | null {
    if (this.anthropic) return this.anthropic;
    try {
      this.anthropic = new AnthropicClient();
      return this.anthropic;
    } catch (err) {
      logger.warn('RecommendationPhraser: Anthropic client unavailable', {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * Phrase every card that has never been considered. Returns counts.
   * Never throws — this layer is optional by construction.
   */
  async phraseAllPending(
    limit = 100
  ): Promise<{ phrased: number; rejected: number; skipped: number }> {
    let phrased = 0;
    let rejected = 0;
    let skipped = 0;

    const rows = await this.pool.query<UnphrasedRecommendation>(
      `SELECT id, shop_id AS "shopId", detector_key AS "detectorKey",
              title, description, evidence
         FROM ai_recommendations
        WHERE phrased_at IS NULL
          AND dismissed_at IS NULL
          AND acted_at IS NULL
          AND expires_at > NOW()
        ORDER BY score DESC
        LIMIT $1`,
      [limit]
    );

    for (const rec of rows.rows) {
      const outcome = await this.phraseOne(rec);
      if (outcome === 'phrased') phrased++;
      else if (outcome === 'rejected') rejected++;
      else skipped++;
    }

    if (rows.rows.length > 0) {
      logger.info('RecommendationPhraser: run complete', {
        considered: rows.rows.length,
        phrased,
        rejected,
        skipped,
      });
    }
    return { phrased, rejected, skipped };
  }

  private async phraseOne(
    rec: UnphrasedRecommendation
  ): Promise<'phrased' | 'rejected' | 'skipped'> {
    // Spend-cap gate. Do NOT stamp phrased_at here — the card should get
    // another chance next month when the budget rolls over.
    const spendCheck = await this.spendCap.canSpend(rec.shopId);
    if (!spendCheck.allowed) return 'skipped';

    const anthropic = this.lazyAnthropic();
    if (!anthropic) return 'skipped';

    const systemPrompt =
      'You reword dashboard cards for a busy shop owner. Output strict JSON: ' +
      '{"title": "...", "description": "..."}. Title is at most 6 words. ' +
      'Description is ONE short sentence. Keep it plain and direct — no ' +
      'exclamation marks, no marketing voice, no emoji. ' +
      'CRITICAL: reuse EVERY number exactly as given. Never round, never ' +
      'approximate ("about a dozen" is forbidden), never introduce a number ' +
      'that was not given to you. If you cannot keep the numbers exact, repeat ' +
      'the original text verbatim.';

    const userMessage =
      `Reword this shop-dashboard card.\n\n` +
      `Title: ${rec.title}\n` +
      `Description: ${rec.description}\n` +
      `Figures that must be preserved exactly: ${JSON.stringify(rec.evidence)}`;

    try {
      const response = await anthropic.complete({
        systemPrompt: [{ text: systemPrompt, cache: true }],
        messages: [{ role: 'user', content: userMessage }],
        model: cheapModel(),
        maxTokens: 200,
      });

      await this.spendCap.recordSpend(rec.shopId, response.costUsd);

      const parsed = parsePhrasing(response.text);
      if (!parsed) {
        await this.markConsidered(rec.id);
        return 'rejected';
      }

      // The guard. A rewrite that introduces or loses a figure is discarded
      // wholesale — plain and correct beats warm and wrong.
      const allowed = allowedNumbers(rec.evidence, rec.title, rec.description);
      const combined = `${parsed.title} ${parsed.description}`;
      if (!copyIsEvidenceBacked(combined, allowed)) {
        logger.warn(
          'RecommendationPhraser: rewrite rejected — unsourced figure',
          { id: rec.id, detectorKey: rec.detectorKey, rewrite: combined }
        );
        await this.markConsidered(rec.id);
        return 'rejected';
      }

      await this.pool.query(
        `UPDATE ai_recommendations
            SET ai_title = $2, ai_description = $3, phrased_at = NOW()
          WHERE id = $1`,
        [rec.id, parsed.title, parsed.description]
      );
      return 'phrased';
    } catch (err) {
      logger.error(
        `RecommendationPhraser: Claude call failed for ${rec.id}`,
        err
      );
      // Don't stamp — a transient API error shouldn't permanently deny this
      // card its rewrite.
      return 'skipped';
    }
  }

  /** Mark as considered-but-not-phrased so it is never retried in a loop. */
  private async markConsidered(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE ai_recommendations SET phrased_at = NOW() WHERE id = $1`,
      [id]
    );
  }
}

function parsePhrasing(
  text: string
): { title: string; description: string } | null {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const obj = JSON.parse(match[0]);
    const title = typeof obj.title === 'string' ? obj.title.trim() : '';
    const description =
      typeof obj.description === 'string' ? obj.description.trim() : '';
    if (!title || !description) return null;
    // A rewrite longer than the original is not an improvement.
    if (title.length > 80 || description.length > 200) return null;
    return { title, description };
  } catch {
    return null;
  }
}

let _instance: RecommendationPhraser | null = null;
export function getRecommendationPhraser(): RecommendationPhraser {
  if (!_instance) _instance = new RecommendationPhraser();
  return _instance;
}
