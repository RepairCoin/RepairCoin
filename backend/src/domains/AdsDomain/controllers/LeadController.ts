// backend/src/domains/AdsDomain/controllers/LeadController.ts
//
// Lead list + manual create + status change (admin), and own-scoped read (shop).
// Stage 0 = manual path only; UTM/Meta attribution + dedupe + convert is Stage 2.

import { Request, Response } from 'express';
import { logger } from '../../../utils/logger';
import { eventBus, createDomainEvent } from '../../../events/EventBus';
import { AdsEvents } from '../events';
import { LeadRepository } from '../repositories/LeadRepository';
import { leadAttributionService } from '../services/LeadAttributionService';
import { leadAIService } from '../services/LeadAIService';

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
    const r = await leadAttributionService.attribute({
      campaignId,
      creativeId: req.body.creativeId,
      name: req.body.name,
      phone: req.body.phone,
      email: req.body.email,
      consentToContact: req.body.consentToContact,
      method: 'manual',
    });
    res.status(r.deduped ? 200 : 201).json({ success: true, data: r });
  } catch (err) {
    logger.error('LeadController.createManualLead failed', err);
    res.status(500).json({ success: false, error: 'Failed to create lead' });
  }
}

// POST /leads/webform (PUBLIC) — landing-page form submissions (UTM-attributed).
// No auth: attribution comes from the campaign id / utm params in the body.
export async function webformLead(req: Request, res: Response): Promise<void> {
  const b = req.body || {};
  if (!b.campaignId && !b.utm?.utm_campaign) {
    res.status(400).json({ success: false, error: 'campaignId or utm.utm_campaign required' });
    return;
  }
  try {
    const r = await leadAttributionService.attribute({
      campaignId: b.campaignId,
      creativeId: b.creativeId,
      name: b.name,
      phone: b.phone,
      email: b.email,
      utm: b.utm,
      clickId: b.clickId,
      consentToContact: b.consentToContact ?? true, // form submit = consent
      method: 'utm',
    });
    res.status(r.deduped ? 200 : 201).json({ success: true, data: { deduped: r.deduped } });
  } catch (err) {
    logger.error('LeadController.webformLead failed', err);
    res.status(500).json({ success: false, error: 'Failed to capture lead' });
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

    // On conversion, link to an existing customer (match by phone/email). We do
    // NOT auto-create a wallet-less customer row — see Stage 2 notes.
    if ((status === 'booked' || status === 'paid') && !lead.customerId) {
      const customerId = await leads.linkCustomerByContact(lead.id, lead.phone, lead.email);
      if (customerId) {
        lead.customerId = customerId;
        await eventBus.publish(
          createDomainEvent(
            AdsEvents.LEAD_CONVERTED_TO_CUSTOMER,
            lead.id,
            { campaignId: lead.campaignId, customerId },
            'AdsDomain'
          )
        );
      }
    }
    if (status === 'booked') {
      await eventBus.publish(
        createDomainEvent(AdsEvents.LEAD_BOOKED, lead.id, { campaignId: lead.campaignId }, 'AdsDomain')
      );
    }
    res.json({ success: true, data: lead });
  } catch (err) {
    logger.error('LeadController.updateLeadStatus failed', err);
    res.status(500).json({ success: false, error: 'Failed to update lead status' });
  }
}

// GET /leads/awaiting (admin) — first-response SLA: leads with no response yet.
export async function listAwaitingLeads(req: Request, res: Response): Promise<void> {
  try {
    const items = await leads.listAwaiting(undefined, 50);
    res.json({ success: true, data: items });
  } catch (err) {
    logger.error('LeadController.listAwaitingLeads failed', err);
    res.status(500).json({ success: false, error: 'Failed to load awaiting leads' });
  }
}

// GET /shop/leads/awaiting (shop) — own awaiting leads only.
export async function listShopAwaitingLeads(req: Request, res: Response): Promise<void> {
  const shopId = shopIdOf(req);
  if (!shopId) { res.status(401).json({ success: false, error: 'Shop ID required' }); return; }
  try {
    const items = await leads.listAwaiting(shopId, 50);
    res.json({ success: true, data: items });
  } catch (err) {
    logger.error('LeadController.listShopAwaitingLeads failed', err);
    res.status(500).json({ success: false, error: 'Failed to load awaiting leads' });
  }
}

// POST /leads/:id/draft-reply (admin) — Stage 3 (Option C): AI-drafted outreach.
export async function draftLeadReply(req: Request, res: Response): Promise<void> {
  try {
    const r = await leadAIService.draftOutreach(req.params.id);
    res.json({ success: true, data: r });
  } catch (err: any) {
    const status = err?.status ?? 500;
    logger.error('LeadController.draftLeadReply failed', err);
    res.status(status).json({ success: false, error: err?.message || 'Failed to draft reply' });
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
