// backend/src/domains/AdsDomain/controllers/LandingController.ts
//
// PUBLIC ad landing-page data (no auth). Given a campaign id (the ad's link target), returns
// the public-safe info the landing page shows: shop name, the offer, and the promoted services
// (name / price / photo) from the campaign's request brief. The lead itself is captured by the
// existing public POST /ads/leads/webform. Nothing sensitive is exposed.

import { Request, Response } from 'express';
import { logger } from '../../../utils/logger';
import { getSharedPool } from '../../../utils/database-pool';
import { CampaignRepository, LandingConfig } from '../repositories/CampaignRepository';

const campaigns = new CampaignRepository();

/**
 * Everything about the campaign itself, in ONE round trip: the campaign, its brief, the shop, and
 * the newest creative that has an image.
 *
 * This used to be four separate repository calls issued together with Promise.all. That shape is
 * what made this endpoint hang: with a cold pool, N parallel queries force N brand-new TLS
 * connections to the (remote) database at once, and connections that lose that race die on the
 * 10s connect timeout — long enough for the whole request to blow past the 30s request timeout and
 * return nothing at all. Two sequential queries reuse a single pooled client instead.
 *
 * LATERAL … LIMIT 1 keeps the one-row-per-campaign semantics the repository calls had; a plain
 * LEFT JOIN would fan the row out if a campaign ever had two briefs or two creatives.
 */
const CORE_SQL = `
  SELECT c.id                    AS campaign_id,
         c.shop_id               AS shop_id,
         c.landing_config        AS landing_config,
         req.offer               AS offer,
         req.goal                AS goal,
         req.promote_service_ids AS promote_service_ids,
         s.name                  AS shop_name,
         s.location_city         AS city,
         s.location_state        AS state,
         s.phone                 AS phone,
         s.meta_pixel_id         AS pixel_id
    FROM ad_campaigns c
    LEFT JOIN shops s ON s.shop_id = c.shop_id
    LEFT JOIN LATERAL (
      SELECT offer, goal, promote_service_ids
        FROM ad_campaign_requests
       WHERE campaign_id = c.id
       LIMIT 1
    ) req ON true
   WHERE c.id = $1 AND c.deleted_at IS NULL`;

/**
 * The page's enrichments — creative image, brand kit, review aggregate, testimonial and promoted
 * services — as scalar subqueries in ONE round trip. Best-effort by design: the caller degrades
 * every field to its empty value if this fails, so a missing brand kit or a broken reviews table
 * costs the page its polish, never the offer itself.
 */
const ENRICHMENT_SQL = `
  SELECT
    (SELECT image_url FROM ad_creatives
      WHERE campaign_id = $1 AND image_url IS NOT NULL AND deleted_at IS NULL
      ORDER BY updated_at DESC LIMIT 1) AS creative_image_url,
    (SELECT json_build_object('logoUrl', logo_url, 'primary', primary_color_hex, 'secondary', secondary_color_hex)
       FROM shop_brand_kits WHERE shop_id = $2) AS brand,
    (SELECT json_build_object('rating', ROUND(AVG(rating)::numeric, 1)::float, 'count', COUNT(*)::int)
       FROM service_reviews WHERE shop_id = $2) AS trust,
    (SELECT json_build_object('quote', comment, 'rating', rating)
       FROM service_reviews
      WHERE shop_id = $2 AND rating >= 4 AND comment IS NOT NULL AND length(trim(comment)) > 0
      ORDER BY created_at DESC LIMIT 1) AS testimonial,
    (SELECT json_agg(json_build_object(
              'id', service_id, 'name', service_name, 'priceUsd', price_usd,
              'imageUrl', image_url, 'category', category))
       FROM shop_services WHERE service_id = ANY($3::text[]) AND active = true) AS services`;

// GET /ads/landing/:campaignId — PUBLIC.
export async function getCampaignLanding(req: Request, res: Response): Promise<void> {
  try {
    const pool = getSharedPool();
    const core = (await pool.query(CORE_SQL, [req.params.campaignId])).rows[0];
    if (!core) { res.status(404).json({ success: false, error: 'not_found' }); return; }

    const ids: string[] = core.promote_service_ids ?? [];
    const extra = await pool
      .query(ENRICHMENT_SQL, [core.campaign_id, core.shop_id, ids])
      .then((r) => r.rows[0])
      .catch((err) => {
        logger.warn('LandingController: enrichment query failed, serving core fields only', err);
        return null;
      });

    const brand = extra?.brand ?? null;
    const trust = extra?.trust ?? null;
    const testimonial = extra?.testimonial ?? null;
    const reviewCount: number = trust?.count ?? 0;
    const services: Array<{ id: string; name: string; priceUsd: number | null; imageUrl: string | null; category: string | null }> =
      (extra?.services ?? []).map((s: any) => ({
        id: s.id,
        name: s.name,
        priceUsd: s.priceUsd != null ? Number(s.priceUsd) : null,
        imageUrl: s.imageUrl ?? null,
        category: s.category ?? null,
      }));

    // Hero = the approved ad creative image; fall back to the first promoted service photo.
    const heroImageUrl = extra?.creative_image_url ?? services.find((s) => s.imageUrl)?.imageUrl ?? null;

    const shop = {
      name: core.shop_name ?? 'Our shop',
      city: core.city ?? null,
      state: core.state ?? null,
      phone: core.phone ?? null,
    };

    // Phase 2 — merge the shop's overrides over the auto-composed defaults (overrides win).
    // landing_config is JSONB, so pg hands it back already parsed.
    const cfg: LandingConfig = core.landing_config ?? {};
    const offer = core.offer ?? null;
    const showRating = cfg.showRating !== false; // default on
    const benefitBullets = Array.isArray(cfg.benefitBullets)
      ? cfg.benefitBullets.map((b) => String(b).trim()).filter(Boolean).slice(0, 6)
      : [];

    res.json({
      success: true,
      data: {
        shopId: core.shop_id,
        shopName: shop.name,
        offer,
        goal: core.goal ?? null,
        services,
        pixelId: core.pixel_id ?? null, // Meta Pixel → fire PageView + Lead for conversion tracking
        // Phase 1 conversion fields (auto-composed; all null-safe):
        logoUrl: brand?.logoUrl ?? null,
        primaryColor: brand?.primary ?? null,
        secondaryColor: brand?.secondary ?? null,
        heroImageUrl,
        // A zero-review shop aggregates to AVG(NULL) — report no rating rather than a bare 0.
        rating: showRating && reviewCount > 0 ? trust?.rating ?? null : null,
        reviewCount: showRating ? reviewCount : 0,
        testimonial: testimonial
          ? { quote: String(testimonial.quote), rating: Number(testimonial.rating) }
          : null,
        city: shop.city,
        state: shop.state,
        // Phase 2 — resolved magnet config (overrides over defaults):
        headline: cfg.headline?.trim() || offer, // hero headline; offer is the default
        subhead: cfg.subhead?.trim() || null,
        urgencyText: cfg.urgencyText?.trim() || null,
        benefitBullets,
        ctaLabel: cfg.ctaLabel?.trim() || null, // FE supplies its own default label
        // Call-now is opt-in (D3); only then is the shop phone exposed publicly.
        callNow: cfg.callNowEnabled && shop.phone ? { phone: shop.phone } : null,
      },
    });
  } catch (err) {
    logger.error('LandingController.getCampaignLanding failed', err);
    res.status(500).json({ success: false, error: 'Failed to load landing' });
  }
}

// GET /ads/campaigns/:id/landing-config — current magnet overrides for the editor.
export async function getLandingConfig(req: Request, res: Response): Promise<void> {
  try {
    const campaign = await campaigns.findById(req.params.id);
    if (!campaign) { res.status(404).json({ success: false, error: 'not_found' }); return; }
    res.json({ success: true, data: campaign.landingConfig ?? {} });
  } catch (err) {
    logger.error('LandingController.getLandingConfig failed', err);
    res.status(500).json({ success: false, error: 'Failed to load landing config' });
  }
}

// PUT /ads/campaigns/:id/landing-config — save the shop's magnet overrides. Sanitizes input;
// unset/empty fields fall back to the auto-composed defaults.
export async function updateLandingConfig(req: Request, res: Response): Promise<void> {
  try {
    const b = req.body || {};
    const str = (v: any, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);
    const config = {
      headline: str(b.headline, 120),
      subhead: str(b.subhead, 200),
      urgencyText: str(b.urgencyText, 80),
      ctaLabel: str(b.ctaLabel, 40),
      benefitBullets: Array.isArray(b.benefitBullets)
        ? b.benefitBullets.map((x: any) => String(x).trim()).filter(Boolean).slice(0, 6).map((s: string) => s.slice(0, 60))
        : undefined,
      showRating: typeof b.showRating === 'boolean' ? b.showRating : undefined,
      callNowEnabled: typeof b.callNowEnabled === 'boolean' ? b.callNowEnabled : undefined,
    };
    // Drop undefined keys so we store a clean blob (null when entirely empty → pure auto-compose).
    const clean = Object.fromEntries(Object.entries(config).filter(([, v]) => v !== undefined));
    const updated = await campaigns.setLandingConfig(req.params.id, Object.keys(clean).length ? clean : null);
    if (!updated) { res.status(404).json({ success: false, error: 'not_found' }); return; }
    res.json({ success: true, data: updated.landingConfig ?? {} });
  } catch (err) {
    logger.error('LandingController.updateLandingConfig failed', err);
    res.status(500).json({ success: false, error: 'Failed to save landing config' });
  }
}
