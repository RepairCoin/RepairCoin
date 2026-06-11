// backend/src/domains/AdsDomain/controllers/PerformanceController.ts
//
// Per-campaign performance: 30-day rows + ROI computed-at-read (Q5). Admin sees
// any campaign; shop sees only its own (ownership verified via the campaign's
// shop_id, never a path param).

import { Request, Response } from 'express';
import { logger } from '../../../utils/logger';
import { PerformanceRepository } from '../repositories/PerformanceRepository';
import { CampaignRepository } from '../repositories/CampaignRepository';
import { RoiCalculator } from '../services/RoiCalculator';

const perf = new PerformanceRepository();
const campaigns = new CampaignRepository();
const roi = new RoiCalculator(perf);
const shopIdOf = (req: Request): string | undefined => (req as any).user?.shopId;

async function buildPayload(campaignId: string) {
  const [rows, roiSummary] = await Promise.all([
    perf.getDailyRows(campaignId, 30),
    roi.computeForCampaign(campaignId),
  ]);
  return { campaignId, roi: roiSummary, dailyRows: rows };
}

// GET /campaigns/:id/performance (admin)
export async function getCampaignPerformance(req: Request, res: Response): Promise<void> {
  try {
    const campaign = await campaigns.findById(req.params.id);
    if (!campaign) { res.status(404).json({ success: false, error: 'Campaign not found' }); return; }
    res.json({ success: true, data: await buildPayload(campaign.id) });
  } catch (err) {
    logger.error('PerformanceController.getCampaignPerformance failed', err);
    res.status(500).json({ success: false, error: 'Failed to get performance' });
  }
}

// GET /shop/campaigns/:id/performance (shop) — own campaign only
export async function getShopCampaignPerformance(req: Request, res: Response): Promise<void> {
  const shopId = shopIdOf(req);
  if (!shopId) { res.status(401).json({ success: false, error: 'Shop ID required' }); return; }
  try {
    const ownerShopId = await campaigns.getShopIdForCampaign(req.params.id);
    if (!ownerShopId) { res.status(404).json({ success: false, error: 'Campaign not found' }); return; }
    if (ownerShopId !== shopId) {
      res.status(403).json({ success: false, error: 'Not your campaign' });
      return;
    }
    res.json({ success: true, data: await buildPayload(req.params.id) });
  } catch (err) {
    logger.error('PerformanceController.getShopCampaignPerformance failed', err);
    res.status(500).json({ success: false, error: 'Failed to get performance' });
  }
}
