// backend/src/domains/AdsDomain/repositories/AdLeadActivityRepository.ts
//
// Per-lead follow-up activity log (lead-tracking Phase 1). Append-only timeline of every contact
// and status move on an ad lead — email / call / note / status_change. Source of truth for
// "last contacted", response time, and the lead activity timeline.
// See docs/tasks/strategy/ads-system/ads-lead-followup-tracking-plan.md.

import { BaseRepository } from '../../../repositories/BaseRepository';

export type AdLeadActivityType = 'email' | 'call' | 'note' | 'status_change';

export interface AdLeadActivity {
  id: string;
  leadId: string;
  type: AdLeadActivityType;
  channel: string | null;
  subject: string | null;
  body: string | null;
  outcome: string | null;
  actorAddress: string | null;
  meta: Record<string, any>;
  createdAt: Date;
}

export interface LogActivityInput {
  leadId: string;
  type: AdLeadActivityType;
  channel?: string | null;
  subject?: string | null;
  body?: string | null;
  outcome?: string | null;
  actorAddress?: string | null;
  meta?: Record<string, any>;
}

export class AdLeadActivityRepository extends BaseRepository {
  async log(input: LogActivityInput): Promise<AdLeadActivity> {
    const res = await this.pool.query(
      `INSERT INTO ad_lead_activities (lead_id, type, channel, subject, body, outcome, actor_address, meta)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        input.leadId,
        input.type,
        input.channel ?? null,
        input.subject ? input.subject.slice(0, 500) : null,
        input.body ? input.body.slice(0, 8000) : null,
        input.outcome ?? null,
        input.actorAddress ?? null,
        JSON.stringify(input.meta ?? {}),
      ]
    );
    return this.mapRow(res.rows[0]);
  }

  async listByLead(leadId: string, limit = 200): Promise<AdLeadActivity[]> {
    const res = await this.pool.query(
      `SELECT * FROM ad_lead_activities WHERE lead_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [leadId, limit]
    );
    return res.rows.map((r) => this.mapRow(r));
  }

  private mapRow(r: any): AdLeadActivity {
    return {
      id: r.id,
      leadId: r.lead_id,
      type: r.type,
      channel: r.channel,
      subject: r.subject,
      body: r.body,
      outcome: r.outcome,
      actorAddress: r.actor_address,
      meta: r.meta ?? {},
      createdAt: r.created_at,
    };
  }
}
