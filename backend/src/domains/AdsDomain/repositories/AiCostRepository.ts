// backend/src/domains/AdsDomain/repositories/AiCostRepository.ts
//
// Q6 — per-campaign AI cost ledger (ad_ai_costs). AI inference is FixFlow COGS:
// EXCLUDED from the shop-facing ROI but tracked here so the admin "true margin"
// panel can show FixFlow's real cost of delivery. One row per AI call that serves
// a campaign (e.g. lead-outreach drafts).

import { BaseRepository } from '../../../repositories/BaseRepository';

export interface RecordAiCostInput {
  campaignId: string;
  leadId?: string | null;
  /** Cost in cents (may be fractional — a draft is ~0.03c). */
  costCents: number;
  kind?: string;
  model?: string | null;
}

export class AiCostRepository extends BaseRepository {
  /** Append one ledger row. Never throws into the caller's happy path — AI cost
   *  bookkeeping must not break the feature it's measuring. */
  async record(input: RecordAiCostInput): Promise<void> {
    const cents = Math.max(0, input.costCents);
    await this.pool.query(
      `INSERT INTO ad_ai_costs (campaign_id, lead_id, cost_cents, kind, model)
       VALUES ($1,$2,$3,$4,$5)`,
      [input.campaignId, input.leadId ?? null, cents, input.kind ?? 'draft_outreach', input.model ?? null]
    );
  }

  /** Total AI cost (fractional cents) for one campaign. */
  async getCampaignCostCents(campaignId: string): Promise<number> {
    const res = await this.pool.query(
      `SELECT COALESCE(SUM(cost_cents),0)::float8 AS n FROM ad_ai_costs WHERE campaign_id = $1`,
      [campaignId]
    );
    return res.rows[0].n;
  }

  /** Total AI cost (fractional cents) across every campaign (all-shops summary). */
  async getAllCostCents(): Promise<number> {
    const res = await this.pool.query(`SELECT COALESCE(SUM(cost_cents),0)::float8 AS n FROM ad_ai_costs`);
    return res.rows[0].n;
  }
}
