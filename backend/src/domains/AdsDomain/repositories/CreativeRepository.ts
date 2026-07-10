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
  imageUrl: string | null;
  metaCreativeId: string | null;
  generationPrompt: string | null;
  version: number;
  reviewStatus: 'pending' | 'approved' | 'rejected';
  reviewedBy: string | null;
  reviewedAt: Date | null;
  /** Two-way sync (Phase 2): the live creative was swapped/edited in Ads Manager and reflected
   *  back here. Surfaces the review-gate bypass; cleared on a local edit/regenerate/re-review. */
  externallyEdited: boolean;
  externallyEditedAt: Date | null;
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
    // A local edit supersedes any external Ads-Manager edit and re-arms the review gate.
    sets.push(`version = version + 1`, `review_status = 'pending'`, `externally_edited = false`, `externally_edited_at = NULL`, `updated_at = now()`);
    params.push(id);
    const res = await this.pool.query(
      `UPDATE ad_creatives SET ${sets.join(', ')} WHERE id = $${params.length} AND deleted_at IS NULL RETURNING *`,
      params
    );
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  /** The AI creative for a campaign (the generated image+copy — identified by a non-null
   *  image_url). Latest wins. This is the row reviewed in the panel and that gates go-live.
   *  It exists from the local "prepare" step onward; meta_creative_id is filled in at push. */
  async findAiByCampaign(campaignId: string): Promise<AdCreative | null> {
    const res = await this.pool.query(
      `SELECT * FROM ad_creatives
        WHERE campaign_id = $1 AND image_url IS NOT NULL AND deleted_at IS NULL
        ORDER BY updated_at DESC LIMIT 1`,
      [campaignId]
    );
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  /** Record (or refresh) the AI creative for a campaign — generated locally at prepare time,
   *  before any Meta push. Always lands as 'pending' so an admin must approve it before go-live;
   *  a regenerate bumps version + re-arms review and clears any stale meta_creative_id (a new
   *  Meta creative is created at push/edit time). One AI row per campaign (replaced in place). */
  async upsertAi(input: {
    campaignId: string;
    imageUrl: string;
    headline: string | null;
    body: string | null;
    landingUrl?: string | null;
    generationPrompt: string | null;
  }): Promise<AdCreative> {
    const existing = await this.findAiByCampaign(input.campaignId);
    if (existing) {
      const res = await this.pool.query(
        `UPDATE ad_creatives
            SET image_url = $1, headline = $2, body = $3, landing_url = COALESCE($4, landing_url),
                generation_prompt = $5, meta_creative_id = NULL, version = version + 1,
                review_status = 'pending', reviewed_by = NULL, reviewed_at = NULL,
                externally_edited = false, externally_edited_at = NULL, updated_at = now()
          WHERE id = $6 RETURNING *`,
        [input.imageUrl, input.headline, input.body, input.landingUrl ?? null, input.generationPrompt, existing.id]
      );
      return this.mapRow(res.rows[0]);
    }
    const res = await this.pool.query(
      `INSERT INTO ad_creatives
         (campaign_id, creative_type, language, image_url, headline, body, landing_url, generation_prompt)
       VALUES ($1,'image','en',$2,$3,$4,$5,$6) RETURNING *`,
      [input.campaignId, input.imageUrl, input.headline, input.body, input.landingUrl ?? null, input.generationPrompt]
    );
    return this.mapRow(res.rows[0]);
  }

  /** Stamp the Meta ad-creative id on the AI creative row once it's pushed to Meta. */
  async setMetaCreativeId(id: string, metaCreativeId: string): Promise<void> {
    await this.pool.query(
      `UPDATE ad_creatives SET meta_creative_id = $1, updated_at = now() WHERE id = $2`,
      [metaCreativeId, id]
    );
  }

  /** Q8: approve/reject a creative before it can launch. */
  async review(
    id: string,
    status: 'approved' | 'rejected',
    reviewedBy: string
  ): Promise<AdCreative | null> {
    // Re-reviewing acknowledges any external Ads-Manager edit, so clear the flag.
    const res = await this.pool.query(
      `UPDATE ad_creatives
         SET review_status = $1, reviewed_by = $2, reviewed_at = now(),
             externally_edited = false, externally_edited_at = NULL, updated_at = now()
       WHERE id = $3 AND deleted_at IS NULL RETURNING *`,
      [status, reviewedBy, id]
    );
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  /** Two-way sync (Phase 2): reflect a creative that was swapped/edited directly in Ads Manager
   *  into the campaign's AI creative row, and raise the externally_edited flag. Non-empty fields
   *  only (an empty spec value preserves what we have). NEVER touches review_status — an external
   *  edit must not auto-approve (D3); the flag surfaces the bypass for an admin to re-review. */
  async reflectExternalCreative(
    campaignId: string,
    fields: { headline?: string | null; body?: string | null; imageUrl?: string | null }
  ): Promise<AdCreative | null> {
    const row = await this.findAiByCampaign(campaignId);
    if (!row) return null;
    const res = await this.pool.query(
      `UPDATE ad_creatives
         SET headline  = COALESCE(NULLIF($1, ''), headline),
             body      = COALESCE(NULLIF($2, ''), body),
             image_url = COALESCE(NULLIF($3, ''), image_url),
             externally_edited = true, externally_edited_at = now(), updated_at = now()
       WHERE id = $4 RETURNING *`,
      [fields.headline ?? '', fields.body ?? '', fields.imageUrl ?? '', row.id]
    );
    return res.rows[0] ? this.mapRow(res.rows[0]) : null;
  }

  /** Raise the externally_edited flag without changing content (used when the live creative
   *  diverged but its spec couldn't be read back). */
  async flagExternallyEdited(campaignId: string): Promise<void> {
    const row = await this.findAiByCampaign(campaignId);
    if (!row) return;
    await this.pool.query(
      `UPDATE ad_creatives SET externally_edited = true, externally_edited_at = now(), updated_at = now()
       WHERE id = $1`,
      [row.id]
    );
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
      imageUrl: r.image_url ?? null,
      metaCreativeId: r.meta_creative_id ?? null,
      generationPrompt: r.generation_prompt ?? null,
      version: r.version,
      reviewStatus: r.review_status,
      reviewedBy: r.reviewed_by,
      reviewedAt: r.reviewed_at,
      externallyEdited: r.externally_edited ?? false,
      externallyEditedAt: r.externally_edited_at ?? null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }
}
