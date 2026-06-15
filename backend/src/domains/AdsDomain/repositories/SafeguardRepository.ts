// backend/src/domains/AdsDomain/repositories/SafeguardRepository.ts
//
// ad_safeguards_state — one row per campaign holding the auto-pause thresholds.
// Stage 0: ensure-default + read. The nightly SafeguardEvaluator (Stage 1) reads
// these thresholds and flips campaign status when breached.

import { BaseRepository } from '../../../repositories/BaseRepository';

export interface SafeguardState {
  campaignId: string;
  autoPauseThresholdCents: number;
  autoPauseNoBookingsCents: number;
  pausedBySafeguardAt: Date | null;
  pausedReason: string | null;
}

export class SafeguardRepository extends BaseRepository {
  /** Create the default safeguard row for a campaign if missing; return it. */
  async ensureDefault(campaignId: string): Promise<SafeguardState> {
    await this.pool.query(
      `INSERT INTO ad_safeguards_state (campaign_id)
       VALUES ($1) ON CONFLICT (campaign_id) DO NOTHING`,
      [campaignId]
    );
    const res = await this.pool.query(
      `SELECT * FROM ad_safeguards_state WHERE campaign_id = $1`,
      [campaignId]
    );
    return this.mapRow(res.rows[0]);
  }

  /** Stamp that a safeguard paused this campaign (audit). */
  async recordPause(campaignId: string, reason: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO ad_safeguards_state (campaign_id, paused_by_safeguard_at, paused_reason)
       VALUES ($1, now(), $2)
       ON CONFLICT (campaign_id) DO UPDATE SET
         paused_by_safeguard_at = now(), paused_reason = $2`,
      [campaignId, reason]
    );
  }

  async getByCampaign(campaignId: string): Promise<SafeguardState | null> {
    const res = await this.pool.query(
      `SELECT * FROM ad_safeguards_state WHERE campaign_id = $1`,
      [campaignId]
    );
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  private mapRow(r: any): SafeguardState {
    return {
      campaignId: r.campaign_id,
      autoPauseThresholdCents: r.auto_pause_threshold_cents,
      autoPauseNoBookingsCents: r.auto_pause_no_bookings_cents,
      pausedBySafeguardAt: r.paused_by_safeguard_at,
      pausedReason: r.paused_reason,
    };
  }
}
