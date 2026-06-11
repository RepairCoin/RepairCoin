// backend/src/domains/AdsDomain/repositories/LeadRepository.ts
//
// Ad leads — Stage 0 ships basic CRUD + status change. Attribution/dedupe/
// lead→customer conversion are Stage 2 (LeadAttributionService).

import { BaseRepository } from '../../../repositories/BaseRepository';

export type LeadStatus = 'new' | 'contacted' | 'booked' | 'paid' | 'completed' | 'lost';
export type AttributionMethod = 'manual' | 'utm' | 'click_id' | 'meta_webhook';

export interface AdLead {
  id: string;
  campaignId: string;
  creativeId: string | null;
  customerId: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  leadStatus: LeadStatus;
  attributionMethod: AttributionMethod;
  consentToContact: boolean;
  firstResponseAt: Date | null;
  notes: string | null;
  lostReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateLeadInput {
  campaignId: string;
  creativeId?: string | null;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  attributionMethod?: AttributionMethod;
  consentToContact?: boolean;
  notes?: string | null;
}

export interface ListLeadsFilter {
  campaignId?: string;
  shopId?: string; // joins through ad_campaigns for shop-scoped reads
  status?: LeadStatus;
  page?: number;
  limit?: number;
}

export class LeadRepository extends BaseRepository {
  async create(input: CreateLeadInput): Promise<AdLead> {
    const res = await this.pool.query(
      `INSERT INTO ad_leads
         (campaign_id, creative_id, name, phone, email, attribution_method, consent_to_contact, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        input.campaignId,
        input.creativeId ?? null,
        input.name ?? null,
        input.phone ?? null,
        input.email ?? null,
        input.attributionMethod ?? 'manual',
        input.consentToContact ?? false,
        input.notes ?? null,
      ]
    );
    return this.mapRow(res.rows[0]);
  }

  async findById(id: string): Promise<AdLead | null> {
    const res = await this.pool.query(`SELECT * FROM ad_leads WHERE id = $1`, [id]);
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  async list(filter: ListLeadsFilter): Promise<{ items: AdLead[]; total: number }> {
    const where: string[] = [];
    const params: any[] = [];
    const joinShop = !!filter.shopId;
    if (filter.campaignId) { params.push(filter.campaignId); where.push(`l.campaign_id = $${params.length}`); }
    if (filter.status) { params.push(filter.status); where.push(`l.lead_status = $${params.length}`); }
    if (filter.shopId) { params.push(filter.shopId); where.push(`c.shop_id = $${params.length}`); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const from = joinShop
      ? `ad_leads l JOIN ad_campaigns c ON c.id = l.campaign_id`
      : `ad_leads l`;

    const page = filter.page ?? 1;
    const limit = filter.limit ?? 25;
    const offset = this.getPaginationOffset(page, limit);

    const countRes = await this.pool.query(`SELECT COUNT(*)::int AS n FROM ${from} ${whereSql}`, params);
    const dataRes = await this.pool.query(
      `SELECT l.* FROM ${from} ${whereSql}
       ORDER BY l.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    return { items: dataRes.rows.map((r) => this.mapRow(r)), total: countRes.rows[0].n };
  }

  async updateStatus(id: string, status: LeadStatus, lostReason?: string | null): Promise<AdLead | null> {
    const res = await this.pool.query(
      `UPDATE ad_leads
         SET lead_status = $1,
             lost_reason = $2,
             first_response_at = CASE WHEN $1 = 'contacted' THEN COALESCE(first_response_at, now()) ELSE first_response_at END,
             updated_at = now()
       WHERE id = $3 RETURNING *`,
      [status, lostReason ?? null, id]
    );
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  private mapRow(r: any): AdLead {
    return {
      id: r.id,
      campaignId: r.campaign_id,
      creativeId: r.creative_id,
      customerId: r.customer_id,
      name: r.name,
      phone: r.phone,
      email: r.email,
      leadStatus: r.lead_status,
      attributionMethod: r.attribution_method,
      consentToContact: r.consent_to_contact,
      firstResponseAt: r.first_response_at,
      notes: r.notes,
      lostReason: r.lost_reason,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
}
