// backend/src/domains/AdsDomain/repositories/AppPlacementRepository.ts
//
// In-app ad placements: the eligible-campaign feed for sponsored cards rendered inside the
// customer app, plus the click log. Eligibility is deliberately strict — an active campaign with
// an APPROVED creative that has an image — so every card the app renders has a real image and
// real copy. Half-empty sponsored cards are worse than no cards.

import { BaseRepository } from '../../../repositories/BaseRepository';

/** One eligible campaign, joined with everything a sponsored card needs to render. */
export interface EligiblePlacementRow {
  campaignId: string;
  shopId: string;
  shopName: string;
  headline: string | null;
  body: string | null;
  imageUrl: string;
  logoUrl: string | null;
  offer: string | null;
  promoteServiceIds: string[];
}

export interface RecordClickInput {
  campaignId: string;
  customerAddress: string | null;
  placement: string;
}

export class AppPlacementRepository extends BaseRepository {
  /**
   * Campaigns eligible for an in-app sponsored card.
   *
   * DISTINCT ON (c.id) + ORDER BY c.id, cr.updated_at DESC picks exactly one creative per
   * campaign — the newest approved one — matching the "latest wins" rule that
   * CreativeRepository.findAiByCampaign() uses everywhere else in this domain.
   *
   * The campaign brief (ad_campaign_requests) and brand kit are LEFT JOINed: a campaign built
   * without a request row, or a shop with no brand kit, still yields a renderable card.
   *
   * The outer ORDER BY random() matters for fairness: DISTINCT ON forces an ordering by
   * campaign id, so a plain LIMIT would serve the same lowest-UUID campaigns forever and starve
   * every other advertiser. Randomising also makes pull-to-refresh actually rotate the cards.
   */
  async listEligible(limit: number): Promise<EligiblePlacementRow[]> {
    const res = await this.pool.query(
      `SELECT * FROM (
         SELECT DISTINCT ON (c.id)
                c.id                      AS campaign_id,
                c.shop_id                 AS shop_id,
                s.name                    AS shop_name,
                cr.headline               AS headline,
                cr.body                   AS body,
                cr.image_url              AS image_url,
                bk.logo_url               AS logo_url,
                req.offer                 AS offer,
                req.promote_service_ids   AS promote_service_ids
           FROM ad_campaigns c
           JOIN ad_creatives cr
             ON cr.campaign_id = c.id
            AND cr.review_status = 'approved'
            AND cr.image_url IS NOT NULL
            AND cr.deleted_at IS NULL
           JOIN shops s
             ON s.shop_id = c.shop_id
           LEFT JOIN ad_campaign_requests req ON req.campaign_id = c.id
           LEFT JOIN shop_brand_kits       bk  ON bk.shop_id = c.shop_id
          WHERE c.status = 'active'
            AND c.deleted_at IS NULL
          ORDER BY c.id, cr.updated_at DESC
       ) eligible
       ORDER BY random()
       LIMIT $1`,
      [limit]
    );

    return res.rows.map((r) => ({
      campaignId: r.campaign_id,
      shopId: r.shop_id,
      shopName: r.shop_name ?? 'A local shop',
      headline: r.headline ?? null,
      body: r.body ?? null,
      imageUrl: r.image_url,
      logoUrl: r.logo_url ?? null,
      offer: r.offer ?? null,
      promoteServiceIds: r.promote_service_ids ?? [],
    }));
  }

  /** Active services among the promoted ids, so a card never links to a deactivated service. */
  async findActiveServices(
    serviceIds: string[]
  ): Promise<Array<{ serviceId: string; serviceName: string }>> {
    if (!serviceIds.length) return [];
    const res = await this.pool.query(
      `SELECT service_id, service_name
         FROM shop_services
        WHERE service_id = ANY($1) AND active = true`,
      [serviceIds]
    );
    return res.rows.map((r) => ({ serviceId: r.service_id, serviceName: r.service_name }));
  }

  async recordClick(input: RecordClickInput): Promise<void> {
    await this.pool.query(
      `INSERT INTO ad_app_placement_clicks (campaign_id, customer_address, placement)
       VALUES ($1, $2, $3)`,
      [input.campaignId, input.customerAddress, input.placement]
    );
  }

  /** Guards the click endpoint against writes for campaigns that don't exist. */
  async campaignExists(campaignId: string): Promise<boolean> {
    const res = await this.pool.query(
      `SELECT 1 FROM ad_campaigns WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [campaignId]
    );
    return (res.rowCount ?? 0) > 0;
  }
}
