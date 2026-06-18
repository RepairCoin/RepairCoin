// backend/src/domains/AdsDomain/controllers/CampaignController.ts
//
// Campaign CRUD. Admin endpoints create/manage; shop endpoints read own only
// (shopId from JWT, never a path/body param). Soft-delete via deleted_at.

import { Request, Response } from 'express';
import { logger } from '../../../utils/logger';
import { eventBus, createDomainEvent } from '../../../events/EventBus';
import { AdsEvents } from '../events';
import { CampaignRepository } from '../repositories/CampaignRepository';
import { SafeguardRepository } from '../repositories/SafeguardRepository';
import { AdBillingService } from '../services/AdBillingService';
import { metaPushService } from '../services/MetaPushService';

const campaigns = new CampaignRepository();
const adBilling = new AdBillingService();
const safeguards = new SafeguardRepository();

const adminId = (req: Request) => (req as any).user?.address ?? 'admin';
const shopIdOf = (req: Request): string | undefined => (req as any).user?.shopId;

// POST /campaigns (admin)
export async function createCampaign(req: Request, res: Response): Promise<void> {
  const { shopId, name } = req.body || {};
  if (!shopId || !name) {
    res.status(400).json({ success: false, error: 'shopId and name are required' });
    return;
  }
  try {
    const campaign = await campaigns.create({
      shopId,
      name,
      industryId: req.body.industryId ?? null,
      platform: req.body.platform,
      targetRadiusMiles: req.body.targetRadiusMiles ?? null,
      targetUnits: req.body.targetUnits,
      dailyBudgetCents: req.body.dailyBudgetCents ?? 0,
      aiAgentEnabled: req.body.aiAgentEnabled ?? false,
      notes: req.body.notes ?? null,
      createdBy: adminId(req),
    });
    await safeguards.ensureDefault(campaign.id); // default $400/$800 thresholds
    await eventBus.publish(
      createDomainEvent(AdsEvents.CAMPAIGN_CREATED, campaign.id, { shopId, name }, 'AdsDomain')
    );
    res.status(201).json({ success: true, data: campaign });
  } catch (err) {
    logger.error('CampaignController.createCampaign failed', err);
    res.status(500).json({ success: false, error: 'Failed to create campaign' });
  }
}

// GET /campaigns (admin) — filter by shop / status, paginated
export async function listCampaigns(req: Request, res: Response): Promise<void> {
  try {
    const result = await campaigns.list({
      shopId: req.query.shopId as string | undefined,
      status: req.query.status as any,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 25,
    });
    res.json({ success: true, data: result.items, total: result.total });
  } catch (err) {
    logger.error('CampaignController.listCampaigns failed', err);
    res.status(500).json({ success: false, error: 'Failed to list campaigns' });
  }
}

// GET /campaigns/:id (admin)
export async function getCampaign(req: Request, res: Response): Promise<void> {
  try {
    const campaign = await campaigns.findById(req.params.id);
    if (!campaign) { res.status(404).json({ success: false, error: 'Campaign not found' }); return; }
    res.json({ success: true, data: campaign });
  } catch (err) {
    logger.error('CampaignController.getCampaign failed', err);
    res.status(500).json({ success: false, error: 'Failed to get campaign' });
  }
}

// PATCH /campaigns/:id (admin)
export async function updateCampaign(req: Request, res: Response): Promise<void> {
  try {
    // §9.5 — reactivating a paused campaign re-checks tier capacity, closing the
    // downgrade-then-unpause loophole (capacity counts active campaigns, so a currently
    // paused one isn't in the count; if the shop is already at the cap from other
    // active/committed campaigns, block the transition with the upsell).
    if (req.body?.status === 'active') {
      const target = await campaigns.findById(req.params.id);
      if (!target) { res.status(404).json({ success: false, error: 'Campaign not found' }); return; }
      if (target.status !== 'active') {
        const cap = await adBilling.getShopCapacity(target.shopId);
        if (cap.remaining <= 0) {
          res.status(409).json({
            success: false, error: 'tier_capacity_reached',
            message: `Shop is at ${cap.usedCampaigns}/${cap.maxCampaigns} campaigns (${cap.tier}). Upgrade or pause another campaign before reactivating this one.`,
            data: cap,
          });
          return;
        }
      }
    }

    const campaign = await campaigns.update(req.params.id, req.body || {});
    if (!campaign) { res.status(404).json({ success: false, error: 'Campaign not found' }); return; }

    // Push P4 — mirror pause/activate to the shop's Meta objects (best-effort; the DB stays
    // the source of truth, a transient Meta error shouldn't fail the toggle).
    if ((req.body?.status === 'active' || req.body?.status === 'paused') && campaign.metaCampaignId) {
      void metaPushService.pushStatus(campaign.id, req.body.status === 'active' ? 'ACTIVE' : 'PAUSED')
        .catch((e: any) => logger.warn(`Meta status push failed for ${campaign.id}: ${e?.message || e}`));
    }

    res.json({ success: true, data: campaign });
  } catch (err) {
    logger.error('CampaignController.updateCampaign failed', err);
    res.status(500).json({ success: false, error: 'Failed to update campaign' });
  }
}

// DELETE /campaigns/:id (admin) — soft delete
export async function deleteCampaign(req: Request, res: Response): Promise<void> {
  try {
    const ok = await campaigns.softDelete(req.params.id);
    if (!ok) { res.status(404).json({ success: false, error: 'Campaign not found' }); return; }
    res.json({ success: true });
  } catch (err) {
    logger.error('CampaignController.deleteCampaign failed', err);
    res.status(500).json({ success: false, error: 'Failed to delete campaign' });
  }
}

// GET /shop/campaigns (shop) — own campaigns only
export async function listShopCampaigns(req: Request, res: Response): Promise<void> {
  const shopId = shopIdOf(req);
  if (!shopId) { res.status(401).json({ success: false, error: 'Shop ID required' }); return; }
  try {
    const result = await campaigns.list({
      shopId,
      status: req.query.status as any,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 25,
    });
    res.json({ success: true, data: result.items, total: result.total });
  } catch (err) {
    logger.error('CampaignController.listShopCampaigns failed', err);
    res.status(500).json({ success: false, error: 'Failed to list campaigns' });
  }
}

// GET /shop/capacity (shop) — tier campaign limit vs. live campaigns used (lifecycle §9.5).
export async function getShopCapacity(req: Request, res: Response): Promise<void> {
  const shopId = shopIdOf(req);
  if (!shopId) { res.status(401).json({ success: false, error: 'Shop ID required' }); return; }
  try {
    res.json({ success: true, data: await adBilling.getShopCapacity(shopId) });
  } catch (err) {
    logger.error('CampaignController.getShopCapacity failed', err);
    res.status(500).json({ success: false, error: 'Failed to load capacity' });
  }
}
