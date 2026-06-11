// backend/src/domains/AdsDomain/controllers/LeadController.ts
//
// Lead list + manual create + status change (admin), and own-scoped read (shop).
// Stage 0 = manual path only; UTM/Meta attribution + dedupe + convert is Stage 2.

import { Request, Response } from 'express';
import { logger } from '../../../utils/logger';
import { LeadRepository } from '../repositories/LeadRepository';

const leads = new LeadRepository();
const shopIdOf = (req: Request): string | undefined => (req as any).user?.shopId;

// GET /leads (admin) — filter by campaign / status
export async function listLeads(req: Request, res: Response): Promise<void> {
  try {
    const result = await leads.list({
      campaignId: req.query.campaignId as string | undefined,
      status: req.query.status as any,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 25,
    });
    res.json({ success: true, data: result.items, total: result.total });
  } catch (err) {
    logger.error('LeadController.listLeads failed', err);
    res.status(500).json({ success: false, error: 'Failed to list leads' });
  }
}

// POST /leads/manual (admin) — attribution_method = 'manual'
export async function createManualLead(req: Request, res: Response): Promise<void> {
  const { campaignId } = req.body || {};
  if (!campaignId) { res.status(400).json({ success: false, error: 'campaignId is required' }); return; }
  try {
    const lead = await leads.create({
      campaignId,
      creativeId: req.body.creativeId ?? null,
      name: req.body.name ?? null,
      phone: req.body.phone ?? null,
      email: req.body.email ?? null,
      attributionMethod: 'manual',
      consentToContact: req.body.consentToContact ?? false,
      notes: req.body.notes ?? null,
    });
    res.status(201).json({ success: true, data: lead });
  } catch (err) {
    logger.error('LeadController.createManualLead failed', err);
    res.status(500).json({ success: false, error: 'Failed to create lead' });
  }
}

// PATCH /leads/:id/status (admin)
export async function updateLeadStatus(req: Request, res: Response): Promise<void> {
  const status = req.body?.status;
  const allowed = ['new', 'contacted', 'booked', 'paid', 'completed', 'lost'];
  if (!allowed.includes(status)) {
    res.status(400).json({ success: false, error: `status must be one of: ${allowed.join(', ')}` });
    return;
  }
  try {
    const lead = await leads.updateStatus(req.params.id, status, req.body?.lostReason ?? null);
    if (!lead) { res.status(404).json({ success: false, error: 'Lead not found' }); return; }
    res.json({ success: true, data: lead });
  } catch (err) {
    logger.error('LeadController.updateLeadStatus failed', err);
    res.status(500).json({ success: false, error: 'Failed to update lead status' });
  }
}

// GET /shop/leads (shop) — own leads only (joined through ad_campaigns.shop_id)
export async function listShopLeads(req: Request, res: Response): Promise<void> {
  const shopId = shopIdOf(req);
  if (!shopId) { res.status(401).json({ success: false, error: 'Shop ID required' }); return; }
  try {
    const result = await leads.list({
      shopId,
      campaignId: req.query.campaignId as string | undefined,
      status: req.query.status as any,
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 25,
    });
    res.json({ success: true, data: result.items, total: result.total });
  } catch (err) {
    logger.error('LeadController.listShopLeads failed', err);
    res.status(500).json({ success: false, error: 'Failed to list leads' });
  }
}
