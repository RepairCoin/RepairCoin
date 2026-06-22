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
import { shopRepository } from '../../../repositories';

const campaigns = new CampaignRepository();
const requests = new CampaignRequestRepository();
const connections = new MetaConnectionRepository();

// GET /ads/landing/:campaignId — PUBLIC.
export async function getCampaignLanding(req: Request, res: Response): Promise<void> {
  try {
    const campaign = await campaigns.findById(req.params.campaignId);
    if (!campaign) { res.status(404).json({ success: false, error: 'not_found' }); return; }

    const [request, shop, conn] = await Promise.all([
      requests.findByCampaignId(campaign.id),
      shopRepository.getShop(campaign.shopId).catch(() => null),
      connections.getConnection(campaign.shopId).catch(() => null),
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

    res.json({
      success: true,
      data: {
        shopId: campaign.shopId, // for the "Book online" deep-link into the customer service view
        shopName: (shop as any)?.name ?? 'Our shop',
        offer: request?.offer ?? null,
        goal: request?.goal ?? null,
        services,
        pixelId: conn?.pixelId ?? null, // Meta Pixel → fire PageView + Lead for conversion tracking
      },
    });
  } catch (err) {
    logger.error('LandingController.getCampaignLanding failed', err);
    res.status(500).json({ success: false, error: 'Failed to load landing' });
  }
}
