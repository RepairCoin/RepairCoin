// backend/src/domains/AdsDomain/controllers/CampaignRequestController.ts
//
// Recurring campaign requests (lifecycle Phase 3). Shop submits (capacity-checked,
// §9.5 + decision #2 soft-block + upsell); admin builds it into a live campaign or
// declines. Concierge: campaign creation stays admin-only (Q8). Posts to the durable
// thread on each transition.

import { Request, Response } from 'express';
import { logger } from '../../../utils/logger';
import { eventBus, createDomainEvent } from '../../../events/EventBus';
import { AdsEvents } from '../events';
import { CampaignRequestRepository } from '../repositories/CampaignRequestRepository';
import { CampaignRepository } from '../repositories/CampaignRepository';
import { BillingPlanRepository } from '../repositories/BillingPlanRepository';
import { SafeguardRepository } from '../repositories/SafeguardRepository';
import { AdMessageRepository } from '../repositories/AdMessageRepository';
import { NotificationRepository } from '../../../repositories/NotificationRepository';
import { AdBillingService } from '../services/AdBillingService';
import { parseBrief } from '../services/briefValidation';
import { shopRepository } from '../../../repositories';

const requests = new CampaignRequestRepository();
const campaigns = new CampaignRepository();
const plans = new BillingPlanRepository();
const safeguards = new SafeguardRepository();
const messages = new AdMessageRepository();
const notifications = new NotificationRepository();
const billing = new AdBillingService();

const shopIdOf = (req: Request): string | undefined => (req as any).user?.shopId;
const adminId = (req: Request): string => (req as any).user?.address ?? 'admin';

async function notifyShop(shopId: string, message: string): Promise<void> {
  try {
    const shop = await shopRepository.getShop(shopId);
    const receiver = (shop as any)?.walletAddress || (shop as any)?.wallet_address;
    if (receiver) await notifications.create({ senderAddress: 'system', receiverAddress: receiver, notificationType: 'ad_campaign_request', message, metadata: { shopId } });
  } catch (err) { logger.error('CampaignRequestController.notifyShop failed', err); }
}
async function notifyAdmins(message: string, metadata: any): Promise<void> {
  try {
    const addrs = (process.env.ADMIN_ADDRESSES || '').split(',').map((a) => a.trim().toLowerCase()).filter(Boolean);
    for (const receiver of addrs) await notifications.create({ senderAddress: 'system', receiverAddress: receiver, notificationType: 'ad_campaign_request', message, metadata });
  } catch (err) { logger.error('CampaignRequestController.notifyAdmins failed', err); }
}
const postEvent = (shopId: string, body: string) => messages.postEvent(shopId, body).catch((e) => logger.error('postEvent failed', e));

// ---- Shop ----
// POST /shop/campaign-requests
export async function submitCampaignRequest(req: Request, res: Response): Promise<void> {
  const shopId = shopIdOf(req);
  if (!shopId) { res.status(401).json({ success: false, error: 'Shop ID required' }); return; }

  // §9.5 / decision #2 — soft-block + upsell at the tier's campaign cap.
  const cap = await billing.getShopCapacity(shopId);
  if (cap.remaining <= 0) {
    res.status(409).json({
      success: false, error: 'tier_capacity_reached',
      message: `You're using ${cap.usedCampaigns} of ${cap.maxCampaigns} campaigns on the ${cap.tier} plan. Upgrade for more.`,
      data: cap,
    });
    return;
  }

  const parsed = parseBrief(req.body?.brief);
  if ('error' in parsed) { res.status(400).json({ success: false, error: parsed.error }); return; }
  const message = (req.body?.message || '').toString().slice(0, 1000) || null;
  try {
    const r = await requests.create(shopId, parsed.brief, message);
    void postEvent(shopId, 'Shop requested a new campaign.');
    await notifyAdmins(`Shop ${shopId} requested a new campaign.`, { shopId, requestId: r.id });
    res.status(201).json({ success: true, data: r });
  } catch (err) {
    logger.error('CampaignRequestController.submitCampaignRequest failed', err);
    res.status(500).json({ success: false, error: 'Failed to submit request' });
  }
}

// GET /shop/campaign-requests
export async function listMyCampaignRequests(req: Request, res: Response): Promise<void> {
  const shopId = shopIdOf(req);
  if (!shopId) { res.status(401).json({ success: false, error: 'Shop ID required' }); return; }
  try {
    res.json({ success: true, data: await requests.listByShop(shopId) });
  } catch (err) {
    logger.error('CampaignRequestController.listMyCampaignRequests failed', err);
    res.status(500).json({ success: false, error: 'Failed to load requests' });
  }
}

// ---- Admin ----
// GET /campaign-requests
export async function listCampaignRequests(req: Request, res: Response): Promise<void> {
  try {
    res.json({ success: true, data: await requests.list(req.query.status as any) });
  } catch (err) {
    logger.error('CampaignRequestController.listCampaignRequests failed', err);
    res.status(500).json({ success: false, error: 'Failed to list requests' });
  }
}

// POST /campaign-requests/:id/build — create a live campaign from the request (concierge).
export async function buildCampaignFromRequest(req: Request, res: Response): Promise<void> {
  const id = req.params.id;
  try {
    const r = await requests.findById(id);
    if (!r) { res.status(404).json({ success: false, error: 'Request not found' }); return; }
    if (r.status === 'live' || r.status === 'declined' || r.status === 'cancelled') {
      res.status(400).json({ success: false, error: `Request already ${r.status}` }); return;
    }
    // §9.6 — can't go live until the shop's ad account is connected.
    if (!(await plans.isAdsAccountConnected(r.shopId))) {
      res.status(409).json({ success: false, error: 'ad_account_not_connected', message: `Connect ${r.shopId}'s ad account before building a live campaign.` });
      return;
    }
    // Re-check capacity at build time (§9.5).
    const cap = await billing.getShopCapacity(r.shopId);
    if (cap.remaining <= 0) {
      res.status(409).json({ success: false, error: 'tier_capacity_reached', message: `Shop is at ${cap.usedCampaigns}/${cap.maxCampaigns} campaigns (${cap.tier}).`, data: cap });
      return;
    }

    const name = (req.body?.name || '').toString().trim() || `Campaign — ${r.goal ?? 'ads'}`;
    const dailyBudgetCents = req.body?.dailyBudgetCents
      ?? (r.monthlyBudgetCents ? Math.round(r.monthlyBudgetCents / 30) : 0);

    const campaign = await campaigns.create({
      shopId: r.shopId,
      name,
      targetRadiusMiles: r.targetRadiusMiles ?? null,
      dailyBudgetCents,
      notes: r.offer ? `Offer: ${r.offer}` : null,
      createdBy: adminId(req),
    } as any);
    await campaigns.update(campaign.id, { status: 'active' }); // go live → billing starts (§9.2, nightly)
    await safeguards.ensureDefault(campaign.id);
    const updated = await requests.setStatus(id, 'live', { campaignId: campaign.id, decidedBy: adminId(req) });

    void postEvent(r.shopId, `Campaign "${name}" is live.`);
    await notifyShop(r.shopId, `Your campaign "${name}" is now live.`);
    await eventBus.publish(createDomainEvent(AdsEvents.CAMPAIGN_CREATED, campaign.id, { shopId: r.shopId, name }, 'AdsDomain'));
    res.status(201).json({ success: true, data: { request: updated, campaign } });
  } catch (err) {
    logger.error('CampaignRequestController.buildCampaignFromRequest failed', err);
    res.status(500).json({ success: false, error: 'Failed to build campaign' });
  }
}

// POST /campaign-requests/:id/decline
export async function declineCampaignRequest(req: Request, res: Response): Promise<void> {
  const id = req.params.id;
  try {
    const r = await requests.findById(id);
    if (!r) { res.status(404).json({ success: false, error: 'Request not found' }); return; }
    const reason = (req.body?.declineReason || '').toString().slice(0, 500) || null;
    const updated = await requests.setStatus(id, 'declined', { declineReason: reason ?? undefined, decidedBy: adminId(req) });
    void postEvent(r.shopId, `Campaign request declined${reason ? `: ${reason}` : '.'}`);
    await notifyShop(r.shopId, `A campaign request was declined${reason ? `: ${reason}` : '.'} You're not billed for it — feel free to revise and resubmit.`);
    res.json({ success: true, data: updated });
  } catch (err) {
    logger.error('CampaignRequestController.declineCampaignRequest failed', err);
    res.status(500).json({ success: false, error: 'Failed to decline request' });
  }
}

// POST /shops/:shopId/ads-account (admin) — mark the shop's ad account connected/disconnected (§9.6).
export async function setAdsAccountConnected(req: Request, res: Response): Promise<void> {
  const shopId = req.params.shopId;
  const connected = req.body?.connected === true;
  try {
    await plans.setAdsAccountConnected(shopId, connected);
    void postEvent(shopId, connected ? 'Ad account connected — campaigns can now go live.' : 'Ad account disconnected.');
    res.json({ success: true, data: { shopId, connected } });
  } catch (err) {
    logger.error('CampaignRequestController.setAdsAccountConnected failed', err);
    res.status(500).json({ success: false, error: 'Failed to update ad account' });
  }
}
