// backend/src/domains/AdsDomain/controllers/LandingController.ts
//
// PUBLIC ad landing-page data (no auth). Given a campaign id (the ad's link target), returns
// the public-safe info the landing page shows: shop name, the offer, and the promoted services
// (name / price / photo) from the campaign's request brief. The lead itself is captured by the
// existing public POST /ads/leads/webform. Nothing sensitive is exposed.

import { Request, Response } from 'express';
import { logger } from '../../../utils/logger';
import { getSharedPool } from '../../../utils/database-pool';
import { CampaignRepository } from '../repositories/CampaignRepository';
import { CampaignRequestRepository } from '../repositories/CampaignRequestRepository';
import { MetaConnectionRepository } from '../repositories/MetaConnectionRepository';
import { CreativeRepository } from '../repositories/CreativeRepository';

const campaigns = new CampaignRepository();
const requests = new CampaignRequestRepository();
const connections = new MetaConnectionRepository();
const creatives = new CreativeRepository();

/** Public-safe shop brand (logo + colors) for branding the landing page. Null-safe. */
async function getBrand(shopId: string): Promise<{ logoUrl: string | null; primaryColor: string | null; secondaryColor: string | null }> {
  try {
    const r = await getSharedPool().query(
      `SELECT logo_url, primary_color_hex, secondary_color_hex FROM shop_brand_kits WHERE shop_id = $1`,
      [shopId]
    );
    const b = r.rows[0];
    return { logoUrl: b?.logo_url ?? null, primaryColor: b?.primary_color_hex ?? null, secondaryColor: b?.secondary_color_hex ?? null };
  } catch { return { logoUrl: null, primaryColor: null, secondaryColor: null }; }
}

/** Aggregate trust signals from the shop's reviews + one recent positive testimonial. Null-safe. */
async function getTrust(shopId: string): Promise<{ rating: number | null; reviewCount: number; testimonial: { quote: string; rating: number } | null }> {
  try {
    const pool = getSharedPool();
    const agg = await pool.query(
      `SELECT ROUND(AVG(rating)::numeric, 1)::float AS avg, COUNT(*)::int AS cnt FROM service_reviews WHERE shop_id = $1`,
      [shopId]
    );
    const tRow = await pool.query(
      `SELECT comment, rating FROM service_reviews
        WHERE shop_id = $1 AND rating >= 4 AND comment IS NOT NULL AND length(trim(comment)) > 0
        ORDER BY created_at DESC LIMIT 1`,
      [shopId]
    );
    const cnt = agg.rows[0]?.cnt ?? 0;
    const t = tRow.rows[0];
    return {
      rating: cnt > 0 ? (agg.rows[0]?.avg ?? null) : null,
      reviewCount: cnt,
      testimonial: t ? { quote: String(t.comment), rating: Number(t.rating) } : null,
    };
  } catch { return { rating: null, reviewCount: 0, testimonial: null }; }
}

/** Shop name + location + phone for the header / "serving {city}" chip / opt-in Call-now. Null-safe.
 *  Phone is fetched here but only ever exposed when the shop enables Call-now (D3). */
async function getShopInfo(shopId: string): Promise<{ name: string; city: string | null; state: string | null; phone: string | null }> {
  try {
    const r = await getSharedPool().query(
      `SELECT name, location_city, location_state, phone FROM shops WHERE shop_id = $1`,
      [shopId]
    );
    const s = r.rows[0];
    return { name: s?.name ?? 'Our shop', city: s?.location_city ?? null, state: s?.location_state ?? null, phone: s?.phone ?? null };
  } catch { return { name: 'Our shop', city: null, state: null, phone: null }; }
}

// GET /ads/landing/:campaignId — PUBLIC.
export async function getCampaignLanding(req: Request, res: Response): Promise<void> {
  try {
    const campaign = await campaigns.findById(req.params.campaignId);
    if (!campaign) { res.status(404).json({ success: false, error: 'not_found' }); return; }

    // Fetch everything in parallel; each helper is null-safe so a missing brand kit / zero reviews /
    // no creative just degrades that piece rather than failing the page.
    const [request, conn, brand, trust, shop, creative] = await Promise.all([
      requests.findByCampaignId(campaign.id),
      connections.getConnection(campaign.shopId).catch(() => null),
      getBrand(campaign.shopId),
      getTrust(campaign.shopId),
      getShopInfo(campaign.shopId),
      creatives.findAiByCampaign(campaign.id).catch(() => null),
    ]);

    const ids = request?.promoteServiceIds ?? [];
    let services: Array<{ id: string; name: string; priceUsd: number | null; imageUrl: string | null; category: string | null }> = [];
    if (ids.length) {
      const r = await getSharedPool().query(
        `SELECT service_id, service_name, price_usd, image_url, category
           FROM shop_services WHERE service_id = ANY($1) AND active = true`,
        [ids]
      );
      services = r.rows.map((s) => ({
        id: s.service_id,
        name: s.service_name,
        priceUsd: s.price_usd != null ? Number(s.price_usd) : null,
        imageUrl: s.image_url ?? null,
        category: s.category ?? null,
      }));
    }

    // Hero = the approved ad creative image; fall back to the first promoted service photo.
    const heroImageUrl = creative?.imageUrl ?? services.find((s) => s.imageUrl)?.imageUrl ?? null;

    // Phase 2 — merge the shop's overrides over the auto-composed defaults (overrides win).
    const cfg = campaign.landingConfig ?? {};
    const offer = request?.offer ?? null;
    const showRating = cfg.showRating !== false; // default on
    const benefitBullets = Array.isArray(cfg.benefitBullets)
      ? cfg.benefitBullets.map((b) => String(b).trim()).filter(Boolean).slice(0, 6)
      : [];

    res.json({
      success: true,
      data: {
        shopId: campaign.shopId,
        shopName: shop.name,
        offer,
        goal: request?.goal ?? null,
        services,
        pixelId: conn?.pixelId ?? null, // Meta Pixel → fire PageView + Lead for conversion tracking
        // Phase 1 conversion fields (auto-composed; all null-safe):
        logoUrl: brand.logoUrl,
        primaryColor: brand.primaryColor,
        secondaryColor: brand.secondaryColor,
        heroImageUrl,
        rating: showRating ? trust.rating : null,
        reviewCount: showRating ? trust.reviewCount : 0,
        testimonial: trust.testimonial,
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
