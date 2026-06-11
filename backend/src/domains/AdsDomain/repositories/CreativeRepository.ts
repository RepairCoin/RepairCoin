// backend/src/domains/AdsDomain/repositories/CreativeRepository.ts
//
// Ad creatives CRUD + Q8 review flow (pending → approved/rejected before launch).

import { BaseRepository } from '../../../repositories/BaseRepository';

export interface AdCreative {
  id: string;
  campaignId: string;
  creativeType: 'image' | 'video' | 'carousel';
  language: string;
  landingUrl: string | null;
  landingUrlType: 'booking_page' | 'shop_profile' | 'lead_form' | null;
  headline: string | null;
  body: string | null;
  version: number;
  reviewStatus: 'pending' | 'approved' | 'rejected';
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCreativeInput {
  campaignId: string;
  creativeType: AdCreative['creativeType'];
  language?: string;
  landingUrl?: string | null;
  landingUrlType?: AdCreative['landingUrlType'];
  headline?: string | null;
  body?: string | null;
}

export class CreativeRepository extends BaseRepository {
  async create(input: CreateCreativeInput): Promise<AdCreative> {
    const res = await this.pool.query(
      `INSERT INTO ad_creatives
         (campaign_id, creative_type, language, landing_url, landing_url_type, headline, body)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        input.campaignId,
        input.creativeType,
        input.language ?? 'en',
        input.landingUrl ?? null,
        input.landingUrlType ?? null,
        input.headline ?? null,
        input.body ?? null,
      ]
    );
    return this.mapRow(res.rows[0]);
  }

  async listByCampaign(campaignId: string): Promise<AdCreative[]> {
    const res = await this.pool.query(
      `SELECT * FROM ad_creatives WHERE campaign_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [campaignId]
    );
    return res.rows.map((r) => this.mapRow(r));
  }

  async findById(id: string): Promise<AdCreative | null> {
    const res = await this.pool.query(
      `SELECT * FROM ad_creatives WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  /** Edit content; bumps version (history is preserved by the version field). */
  async update(id: string, fields: Partial<CreateCreativeInput>): Promise<AdCreative | null> {
    const sets: string[] = [];
    const params: any[] = [];
    const col = (c: string, v: any) => { params.push(v); sets.push(`${c} = $${params.length}`); };
    if (fields.creativeType !== undefined) col('creative_type', fields.creativeType);
    if (fields.language !== undefined) col('language', fields.language);
    if (fields.landingUrl !== undefined) col('landing_url', fields.landingUrl);
    if (fields.landingUrlType !== undefined) col('landing_url_type', fields.landingUrlType);
    if (fields.headline !== undefined) col('headline', fields.headline);
    if (fields.body !== undefined) col('body', fields.body);
    if (sets.length === 0) return this.findById(id);
    sets.push(`version = version + 1`, `review_status = 'pending'`, `updated_at = now()`);
    params.push(id);
    const res = await this.pool.query(
      `UPDATE ad_creatives SET ${sets.join(', ')} WHERE id = $${params.length} AND deleted_at IS NULL RETURNING *`,
      params
    );
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  /** Q8: approve/reject a creative before it can launch. */
  async review(
    id: string,
    status: 'approved' | 'rejected',
    reviewedBy: string
  ): Promise<AdCreative | null> {
    const res = await this.pool.query(
      `UPDATE ad_creatives
         SET review_status = $1, reviewed_by = $2, reviewed_at = now(), updated_at = now()
       WHERE id = $3 AND deleted_at IS NULL RETURNING *`,
      [status, reviewedBy, id]
    );
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  async softDelete(id: string): Promise<boolean> {
    const res = await this.pool.query(
      `UPDATE ad_creatives SET deleted_at = now(), updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return (res.rowCount ?? 0) > 0;
  }

  private mapRow(r: any): AdCreative {
    return {
      id: r.id,
      campaignId: r.campaign_id,
      creativeType: r.creative_type,
      language: r.language,
      landingUrl: r.landing_url,
      landingUrlType: r.landing_url_type,
      headline: r.headline,
      body: r.body,
      version: r.version,
      reviewStatus: r.review_status,
      reviewedBy: r.reviewed_by,
      reviewedAt: r.reviewed_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
}
