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
  /** 2-way chat identifiers. Populated for CTM/Messenger + WhatsApp leads; drive channel routing
   *  in LeadChannelSender.pickChannel (without these, a chat lead falls back to 'manual' and never sends). */
  messengerId: string | null;
  whatsappId: string | null;
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
  /** Take-over (P3): when true, the AI stops auto-answering this lead's replies — a human is handling it. */
  aiPaused: boolean;
  /** Escalation (P3): set when an inbound reply showed booking intent — forces 'needs_human'. Null = not escalated. */
  escalatedAt: Date | null;
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
  messengerId?: string | null;
}

export interface ListLeadsFilter {
  campaignId?: string;
  shopId?: string; // joins through ad_campaigns for shop-scoped reads
  status?: LeadStatus;
  page?: number;
  limit?: number;
}

/** A lead plus a summary of its last message + its campaign's AI mode — for the conversation inbox (P2). */
export interface LeadConversationRow extends AdLead {
  lastDirection: 'inbound' | 'outbound' | null;
  lastAuthor: 'lead' | 'ai' | 'admin' | null;
  lastBody: string | null;
  lastAt: Date | null;
  messageCount: number;
  campaignName: string | null;
  campaignOutreachMode: 'off' | 'draft' | 'auto' | null;
}

export class LeadRepository extends BaseRepository {
  async create(input: CreateLeadInput): Promise<AdLead> {
    const res = await this.pool.query(
      `INSERT INTO ad_leads
         (campaign_id, creative_id, name, phone, email, attribution_method, consent_to_contact, notes, meta_lead_id, gclid, messenger_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
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
        input.messengerId ?? null,
      ]
    );
    return this.mapRow(res.rows[0]);
  }

  /** Enrich a lead with contact details captured in the conversation (or a form), and link it to an
   *  EXISTING customer when the email/phone matches one (no duplicate). Latest non-null value wins;
   *  customer_id is only set (once) when a real customer matches — a booking's synthetic guest never links here. */
  async updateContact(id: string, c: { name?: string | null; email?: string | null; phone?: string | null }): Promise<void> {
    await this.pool.query(
      `UPDATE ad_leads
          SET name = COALESCE($2, name), email = COALESCE($3, email), phone = COALESCE($4, phone), updated_at = now()
        WHERE id = $1`,
      [id, c.name ?? null, c.email ?? null, c.phone ?? null]
    );
    if (c.email || c.phone) {
      const cust = await this.pool.query(
        `SELECT address FROM customers
           WHERE ($1::text IS NOT NULL AND $1 <> '' AND lower(email) = lower($1))
              OR ($2::text IS NOT NULL AND $2 <> '' AND phone = $2)
           LIMIT 1`,
        [c.email ?? null, c.phone ?? null]
      );
      if (cust.rows.length) {
        await this.pool.query(
          `UPDATE ad_leads SET customer_id = $2 WHERE id = $1 AND customer_id IS NULL`,
          [id, cust.rows[0].address]
        );
      }
    }
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

  /** Messenger: resolve a lead by its Page-Scoped ID (PSID). */
  async findByMessengerId(psid: string): Promise<AdLead | null> {
    const res = await this.pool.query(`SELECT * FROM ad_leads WHERE messenger_id = $1 LIMIT 1`, [psid]);
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

  /** Take-over (P3): pause/resume the AI auto-answer for this lead. */
  async setAiPaused(id: string, paused: boolean): Promise<void> {
    await this.pool.query(`UPDATE ad_leads SET ai_paused = $2, updated_at = now() WHERE id = $1`, [id, paused]);
  }

  /** Escalation (P3): flag a hot lead (no-op once flagged). Returns true if this call set it. */
  async setEscalated(id: string): Promise<boolean> {
    const r = await this.pool.query(
      `UPDATE ad_leads SET escalated_at = now(), updated_at = now() WHERE id = $1 AND escalated_at IS NULL`,
      [id]
    );
    return (r.rowCount ?? 0) > 0;
  }

  /** Clear escalation — a human has engaged the lead. */
  async clearEscalated(id: string): Promise<void> {
    await this.pool.query(`UPDATE ad_leads SET escalated_at = NULL, updated_at = now() WHERE id = $1 AND escalated_at IS NOT NULL`, [id]);
  }

  /** Dormant sweep (P3): leads whose last (our) message JUST crossed the dormancy window in the last
   *  `graceHours` — so the nightly sweep notifies once, as it goes dormant, not every night. Excludes
   *  terminal stages. Returns lead + shop for the notification. */
  async listJustDormant(windowDays = 7, graceHours = 24): Promise<Array<{ id: string; name: string | null; shopId: string; campaignName: string | null }>> {
    const res = await this.pool.query(
      `SELECT l.id, l.name, c.shop_id, c.name AS campaign_name
         FROM ad_leads l
         JOIN ad_campaigns c ON c.id = l.campaign_id
         JOIN LATERAL (
           SELECT direction, created_at FROM ad_lead_messages WHERE lead_id = l.id ORDER BY created_at DESC LIMIT 1
         ) m ON true
        WHERE l.lead_status NOT IN ('booked','paid','completed','lost')
          AND m.direction = 'outbound'
          AND m.created_at <  now() - ($1 || ' days')::interval
          AND m.created_at >= now() - ($1 || ' days')::interval - ($2 || ' hours')::interval`,
      [String(windowDays), String(graceHours)]
    );
    return res.rows.map((r) => ({ id: r.id, name: r.name, shopId: r.shop_id, campaignName: r.campaign_name }));
  }

  /** Speed-to-lead stamp: record first_response_at WITHOUT advancing the pipeline stage. Used by AI
   *  auto-outreach (Part B redesign) — an AI email is a fast first touch, but not a human 'contacted'
   *  sales milestone, so the funnel stage stays honest. No-op once first_response_at is set. */
  async stampFirstResponse(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE ad_leads SET first_response_at = COALESCE(first_response_at, now()), updated_at = now() WHERE id = $1`,
      [id]
    );
  }

  /** Conversation inbox (P2): each lead with a summary of its most-recent message, newest activity
   *  first. Shop-scoped (through ad_campaigns.shop_id) or campaign-scoped. State is derived in the
   *  service layer from these fields (see leadConversationState). */
  async listConversations(filter: { shopId?: string; campaignId?: string; limit?: number }): Promise<LeadConversationRow[]> {
    const where: string[] = [];
    const params: any[] = [];
    if (filter.shopId) { params.push(filter.shopId); where.push(`c.shop_id = $${params.length}`); }
    if (filter.campaignId) { params.push(filter.campaignId); where.push(`l.campaign_id = $${params.length}`); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    params.push(filter.limit ?? 100);
    const res = await this.pool.query(
      `SELECT l.*, c.name AS campaign_name, c.ai_outreach_mode AS campaign_outreach_mode,
              m.direction AS last_direction, m.author AS last_author,
              left(m.body, 140) AS last_body, m.created_at AS last_at, cnt.n AS message_count
         FROM ad_leads l
         LEFT JOIN ad_campaigns c ON c.id = l.campaign_id
         LEFT JOIN LATERAL (
           SELECT direction, author, body, created_at FROM ad_lead_messages
            WHERE lead_id = l.id ORDER BY created_at DESC LIMIT 1
         ) m ON true
         LEFT JOIN LATERAL (SELECT COUNT(*)::int AS n FROM ad_lead_messages WHERE lead_id = l.id) cnt ON true
         ${whereSql}
         ORDER BY COALESCE(m.created_at, l.created_at) DESC
         LIMIT $${params.length}`,
      params
    );
    return res.rows.map((r) => ({
      ...this.mapRow(r),
      lastDirection: r.last_direction ?? null,
      lastAuthor: r.last_author ?? null,
      lastBody: r.last_body ?? null,
      lastAt: r.last_at ?? null,
      messageCount: r.message_count ?? 0,
      campaignName: r.campaign_name ?? null,
      campaignOutreachMode: r.campaign_outreach_mode ?? null,
    }));
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
      messengerId: r.messenger_id ?? null,
      whatsappId: r.whatsapp_id ?? null,
      leadStatus: r.lead_status,
      attributionMethod: r.attribution_method,
      consentToContact: r.consent_to_contact,
      hasChatChannel: !!(r.messenger_id || r.whatsapp_id),
      firstResponseAt: r.first_response_at,
      notes: r.notes,
      lostReason: r.lost_reason,
      gclid: r.gclid ?? null,
      conversionUploadedAt: r.conversion_uploaded_at ?? null,
      aiPaused: r.ai_paused === true,
      escalatedAt: r.escalated_at ?? null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
}
