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
  /** Inbound email Message-ID (for dedupe). */
  externalId?: string | null;
}

export class LeadMessageRepository extends BaseRepository {
  async append(input: AppendMessageInput): Promise<LeadMessage> {
    const res = await this.pool.query(
      `INSERT INTO ad_lead_messages
         (lead_id, direction, author, channel, body, ai_cost_cents, delivery_status, external_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        input.leadId, input.direction, input.author, input.channel ?? 'manual',
        input.body, input.aiCostCents ?? 0, input.deliveryStatus ?? 'recorded', input.externalId ?? null,
      ]
    );
    return this.mapRow(res.rows[0]);
  }

  /** Inbound dedupe: has this lead already got a message with this Message-ID? */
  async existsByExternalId(leadId: string, externalId: string): Promise<boolean> {
    const res = await this.pool.query(
      `SELECT 1 FROM ad_lead_messages WHERE lead_id = $1 AND external_id = $2 LIMIT 1`,
      [leadId, externalId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  /** Loop-rate-limit: count messages by an author for a lead in the last `minutes`. */
  async countByAuthorSince(leadId: string, author: MsgAuthor, minutes: number): Promise<number> {
    const res = await this.pool.query(
      `SELECT count(*)::int AS n FROM ad_lead_messages
        WHERE lead_id = $1 AND author = $2 AND created_at > now() - ($3 || ' minutes')::interval`,
      [leadId, author, String(minutes)]
    );
    return res.rows[0]?.n ?? 0;
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
