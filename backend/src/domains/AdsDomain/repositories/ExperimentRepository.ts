// backend/src/domains/AdsDomain/repositories/ExperimentRepository.ts
//
// Ads System Stage 5 — A/B experiments. An experiment groups creatives of a
// campaign; ad_creatives.experiment_id links them. The report compares creatives
// by LEADS + BOOKINGS + conversion rate (per-creative spend → per-creative CPL
// needs Meta per-ad insights, Stage 4 live).

import { BaseRepository } from '../../../repositories/BaseRepository';

export interface AdExperiment {
  id: string;
  campaignId: string;
  name: string;
  status: 'running' | 'ended';
  startedAt: Date;
  endedAt: Date | null;
  winnerCreativeId: string | null;
  notes: string | null;
}

export interface ExperimentArm {
  creativeId: string;
  headline: string | null;
  leads: number;
  bookings: number;
  conversionRate: number | null; // bookings / leads
}

export class ExperimentRepository extends BaseRepository {
  async create(campaignId: string, name: string): Promise<AdExperiment> {
    const res = await this.pool.query(
      `INSERT INTO ad_experiments (campaign_id, name) VALUES ($1,$2) RETURNING *`,
      [campaignId, name]
    );
    return this.mapRow(res.rows[0]);
  }

  async listByCampaign(campaignId: string): Promise<AdExperiment[]> {
    const res = await this.pool.query(
      `SELECT * FROM ad_experiments WHERE campaign_id = $1 ORDER BY created_at DESC`,
      [campaignId]
    );
    return res.rows.map((r) => this.mapRow(r));
  }

  async setWinner(id: string, winnerCreativeId: string): Promise<AdExperiment | null> {
    const res = await this.pool.query(
      `UPDATE ad_experiments
          SET winner_creative_id = $1, status = 'ended', ended_at = now(), updated_at = now()
        WHERE id = $2 RETURNING *`,
      [winnerCreativeId, id]
    );
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  /** Per-creative arm comparison for an experiment (leads, bookings, conversion). */
  async getReport(experimentId: string): Promise<ExperimentArm[]> {
    const res = await this.pool.query(
      `SELECT cr.id AS creative_id, cr.headline,
              COUNT(DISTINCT l.id) FILTER (WHERE l.is_duplicate = false)::int AS leads,
              COUNT(DISTINCT o.id)::int AS bookings
         FROM ad_creatives cr
         LEFT JOIN ad_leads l ON l.creative_id = cr.id
         LEFT JOIN service_orders o ON o.ad_lead_id = l.id
                                   AND COALESCE(o.status,'') NOT IN ('cancelled','refunded')
        WHERE cr.experiment_id = $1 AND cr.deleted_at IS NULL
        GROUP BY cr.id, cr.headline`,
      [experimentId]
    );
    return res.rows.map((r) => ({
      creativeId: r.creative_id,
      headline: r.headline,
      leads: r.leads,
      bookings: r.bookings,
      conversionRate: r.leads > 0 ? r.bookings / r.leads : null,
    }));
  }

  private mapRow(r: any): AdExperiment {
    return {
      id: r.id,
      campaignId: r.campaign_id,
      name: r.name,
      status: r.status,
      startedAt: r.started_at,
      endedAt: r.ended_at,
      winnerCreativeId: r.winner_creative_id,
      notes: r.notes,
    };
  }
}
