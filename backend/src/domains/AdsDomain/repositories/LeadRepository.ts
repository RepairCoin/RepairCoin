// backend/src/domains/AdsDomain/repositories/LeadRepository.ts
//
// Ad leads — Stage 0 ships basic CRUD + status change. Attribution/dedupe/
// lead→customer conversion are Stage 2 (LeadAttributionService).

import crypto from 'crypto';
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
  /** True when the lead has a 2-way chat channel (Messenger/WhatsApp) — drives whether the UI
   *  offers Chat / AI-reply. Web-form & manual leads (phone/email only) are false → contact by call/email. */
  hasChatChannel: boolean;
  firstResponseAt: Date | null;
  notes: string | null;
  lostReason: string | null;
  /** Google click id (from auto-tagging on the landing URL) — used to upload an offline
   *  conversion to Google when this lead converts (Google conversion-optimization, Phase 1). */
  gclid: string | null;
  /** When this lead's offline conversion was uploaded to Google (Phase 2) — idempotency marker. */
  conversionUploadedAt: Date | null;
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
  metaLeadId?: string | null;
  gclid?: string | null;
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
         (campaign_id, creative_id, name, phone, email, attribution_method, consent_to_contact, notes, meta_lead_id, gclid)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        input.campaignId,
        input.creativeId ?? null,
        input.name ?? null,
        input.phone ?? null,
        input.email ?? null,
        input.attributionMethod ?? 'manual',
        input.consentToContact ?? false,
        input.notes ?? null,
        input.metaLeadId ?? null,
        input.gclid ?? null,
      ]
    );
    return this.mapRow(res.rows[0]);
  }

  /** Mark a lead's Google offline conversion as uploaded (idempotent — no-op if already set). */
  async markConversionUploaded(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE ad_leads SET conversion_uploaded_at = now() WHERE id = $1 AND conversion_uploaded_at IS NULL`,
      [id]
    );
  }

  /** Idempotency for Meta webhook re-delivery: existing lead id for a meta_lead_id. */
  async findByMetaLeadId(metaLeadId: string): Promise<string | null> {
    const res = await this.pool.query(`SELECT id FROM ad_leads WHERE meta_lead_id = $1`, [metaLeadId]);
    return res.rows[0]?.id ?? null;
  }

  async findById(id: string): Promise<AdLead | null> {
    const res = await this.pool.query(`SELECT * FROM ad_leads WHERE id = $1`, [id]);
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  /** Inbound email: get the lead's reply token, creating one on first use. The reply-to address is
   *  `${token}@reply.fixflow.ai`; an inbound reply is resolved back to the lead via this token.
   *  Race-safe (the UPDATE is guarded on reply_token IS NULL; re-reads on a concurrent set). */
  async getOrCreateReplyToken(id: string): Promise<string | null> {
    const cur = await this.pool.query(`SELECT reply_token FROM ad_leads WHERE id = $1`, [id]);
    if (!cur.rows[0]) return null;                       // no such lead
    if (cur.rows[0].reply_token) return cur.rows[0].reply_token;
    const token = crypto.randomBytes(12).toString('hex'); // 24 hex chars, opaque
    const upd = await this.pool.query(
      `UPDATE ad_leads SET reply_token = $2, updated_at = now()
        WHERE id = $1 AND reply_token IS NULL RETURNING reply_token`,
      [id, token]
    );
    if (upd.rows[0]?.reply_token) return upd.rows[0].reply_token;
    const re = await this.pool.query(`SELECT reply_token FROM ad_leads WHERE id = $1`, [id]);
    return re.rows[0]?.reply_token ?? null;
  }

  /** Inbound email: resolve a lead from its reply token (the inbound to-address local-part). */
  async findByReplyToken(token: string): Promise<AdLead | null> {
    const res = await this.pool.query(`SELECT * FROM ad_leads WHERE reply_token = $1`, [token]);
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

  /** Dedupe: a non-duplicate lead with the same phone on this campaign within
   *  `hours`. Returns the existing lead id, or null. */
  async findRecentByPhone(campaignId: string, phone: string, hours = 24): Promise<string | null> {
    const res = await this.pool.query(
      `SELECT id FROM ad_leads
        WHERE campaign_id = $1 AND phone = $2 AND is_duplicate = false
          AND created_at > now() - ($3 || ' hours')::interval
        ORDER BY created_at DESC LIMIT 1`,
      [campaignId, phone, String(hours)]
    );
    return res.rows[0]?.id ?? null;
  }

  /** Link a lead to an existing customer matched by phone or email; sets
   *  customer_id. Returns the matched customer address, or null if none. */
  async linkCustomerByContact(leadId: string, phone: string | null, email: string | null): Promise<string | null> {
    if (!phone && !email) return null;
    const match = await this.pool.query(
      `SELECT address FROM customers
        WHERE ($1::text IS NOT NULL AND phone = $1)
           OR ($2::text IS NOT NULL AND lower(email) = lower($2))
        LIMIT 1`,
      [phone, email]
    );
    const address = match.rows[0]?.address ?? null;
    if (!address) return null;
    await this.pool.query(
      `UPDATE ad_leads SET customer_id = $1, updated_at = now() WHERE id = $2`,
      [address, leadId]
    );
    return address;
  }

  /** Leads with no first response yet (SLA): oldest first. Optionally shop-scoped
   *  (joined through ad_campaigns.shop_id). Excludes terminal statuses. */
  async listAwaiting(shopId?: string, limit = 50): Promise<AdLead[]> {
    const params: any[] = [];
    const where = [`l.first_response_at IS NULL`, `l.lead_status NOT IN ('lost','completed','paid')`];
    let from = `ad_leads l`;
    if (shopId) {
      from = `ad_leads l JOIN ad_campaigns c ON c.id = l.campaign_id`;
      params.push(shopId);
      where.push(`c.shop_id = $${params.length}`);
    }
    params.push(limit);
    const res = await this.pool.query(
      `SELECT l.* FROM ${from}
        WHERE ${where.join(' AND ')}
        ORDER BY l.created_at ASC LIMIT $${params.length}`,
      params
    );
    return res.rows.map((r) => this.mapRow(r));
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

  /** The shop/admin actually reached out (logged call or sent email): stamp first_response_at
   *  (no-op once set) AND advance the pipeline from 'new' -> 'contacted'. Never downgrades a
   *  later stage (booked/paid/etc. stay put). Mirrors the chat path's markRespondedIfNew so the
   *  lead leaves the NEW column the moment it's worked, regardless of channel. */
  async markContacted(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE ad_leads
          SET first_response_at = COALESCE(first_response_at, now()),
              lead_status = CASE WHEN lead_status = 'new' THEN 'contacted' ELSE lead_status END,
              updated_at = now()
        WHERE id = $1`,
      [id]
    );
  }

  /** Q9 retention: hard-delete unconverted leads older than `retentionDays`.
   *  Converted leads (booked/paid/completed) are kept forever — they're linked to
   *  a customers row. Returns the number of rows deleted. */
  async purgeExpired(retentionDays = 180): Promise<number> {
    const res = await this.pool.query(
      `DELETE FROM ad_leads
        WHERE lead_status NOT IN ('booked','paid','completed')
          AND created_at < now() - ($1 || ' days')::interval`,
      [String(retentionDays)]
    );
    return res.rowCount ?? 0;
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
      hasChatChannel: !!(r.messenger_id || r.whatsapp_id),
      firstResponseAt: r.first_response_at,
      notes: r.notes,
      lostReason: r.lost_reason,
      gclid: r.gclid ?? null,
      conversionUploadedAt: r.conversion_uploaded_at ?? null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
}
