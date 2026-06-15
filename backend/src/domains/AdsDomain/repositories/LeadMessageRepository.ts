// backend/src/domains/AdsDomain/repositories/LeadMessageRepository.ts
//
// Per-lead conversation thread (Stage 3.5). Keyed by lead_id — NOT wallet — because
// ad leads have no wallet. Stores both sides of the conversation plus AI replies.

import { BaseRepository } from '../../../repositories/BaseRepository';

export type MsgDirection = 'inbound' | 'outbound';
export type MsgAuthor = 'lead' | 'ai' | 'admin';
export type MsgChannel = 'sms' | 'whatsapp' | 'messenger' | 'email' | 'manual';
export type DeliveryStatus = 'recorded' | 'queued' | 'sent' | 'delivered' | 'failed';

export interface LeadMessage {
  id: string;
  leadId: string;
  direction: MsgDirection;
  author: MsgAuthor;
  channel: MsgChannel;
  body: string;
  aiCostCents: number;
  deliveryStatus: DeliveryStatus;
  createdAt: Date;
}

export interface AppendMessageInput {
  leadId: string;
  direction: MsgDirection;
  author: MsgAuthor;
  channel?: MsgChannel;
  body: string;
  aiCostCents?: number;
  deliveryStatus?: DeliveryStatus;
}

export class LeadMessageRepository extends BaseRepository {
  async append(input: AppendMessageInput): Promise<LeadMessage> {
    const res = await this.pool.query(
      `INSERT INTO ad_lead_messages
         (lead_id, direction, author, channel, body, ai_cost_cents, delivery_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        input.leadId, input.direction, input.author, input.channel ?? 'manual',
        input.body, input.aiCostCents ?? 0, input.deliveryStatus ?? 'recorded',
      ]
    );
    return this.mapRow(res.rows[0]);
  }

  /** Full thread, oldest first. */
  async listByLead(leadId: string, limit = 100): Promise<LeadMessage[]> {
    const res = await this.pool.query(
      `SELECT * FROM ad_lead_messages WHERE lead_id = $1 ORDER BY created_at ASC LIMIT $2`,
      [leadId, limit]
    );
    return res.rows.map((r) => this.mapRow(r));
  }

  async countByLead(leadId: string): Promise<number> {
    const res = await this.pool.query(
      `SELECT COUNT(*)::int AS n FROM ad_lead_messages WHERE lead_id = $1`, [leadId]
    );
    return res.rows[0].n;
  }

  private mapRow(r: any): LeadMessage {
    return {
      id: r.id,
      leadId: r.lead_id,
      direction: r.direction,
      author: r.author,
      channel: r.channel,
      body: r.body,
      aiCostCents: typeof r.ai_cost_cents === 'string' ? parseFloat(r.ai_cost_cents) : r.ai_cost_cents,
      deliveryStatus: r.delivery_status,
      createdAt: r.created_at,
    };
  }
}
