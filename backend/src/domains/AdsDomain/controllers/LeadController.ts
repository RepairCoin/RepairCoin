// backend/src/domains/AdsDomain/controllers/LeadController.ts
//
// Lead list + manual create + status change (admin), and own-scoped read (shop).
// Stage 0 = manual path only; UTM/Meta attribution + dedupe + convert is Stage 2.

import { Request, Response } from 'express';
import { logger } from '../../../utils/logger';
import { eventBus, createDomainEvent } from '../../../events/EventBus';
import { AdsEvents } from '../events';
import { LeadRepository } from '../repositories/LeadRepository';
import { CampaignRepository } from '../repositories/CampaignRepository';
import { leadAttributionService } from '../services/LeadAttributionService';
import { leadAIService } from '../services/LeadAIService';
import { leadAutoAnswerService } from '../services/LeadAutoAnswerService';

const leads = new LeadRepository();
const campaigns = new CampaignRepository();
const shopIdOf = (req: Request): string | undefined => (req as any).user?.shopId;

const LEAD_STATUSES = ['new', 'contacted', 'booked', 'paid', 'completed', 'lost'];

/** Apply a lead status change + the conversion/booking side effects (shared by admin + shop). */
async function applyLeadStatus(leadId: string, status: string, lostReason: string | null) {
  const lead = await leads.updateStatus(leadId, status as any, lostReason);
  if (!lead) return null;
  // On conversion, link to an existing customer (match by phone/email). We do NOT auto-create a
  // wallet-less customer row — see Stage 2 notes.
  if ((status === 'booked' || status === 'paid') && !lead.customerId) {
    const customerId = await leads.linkCustomerByContact(lead.id, lead.phone, lead.email);
    if (customerId) {
      lead.customerId = customerId;
      await eventBus.publish(createDomainEvent(AdsEvents.LEAD_CONVERTED_TO_CUSTOMER, lead.id, { campaignId: lead.campaignId, customerId }, 'AdsDomain'));
    }
  }
  if (status === 'booked') {
    await eventBus.publish(createDomainEvent(AdsEvents.LEAD_BOOKED, lead.id, { campaignId: lead.campaignId }, 'AdsDomain'));
  }
  return lead;
}

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
  if (!LEAD_STATUSES.includes(status)) {
    res.status(400).json({ success: false, error: `status must be one of: ${LEAD_STATUSES.join(', ')}` });
    return;
  }
  try {
    const lead = await applyLeadStatus(req.params.id, status, req.body?.lostReason ?? null);
    if (!lead) { res.status(404).json({ success: false, error: 'Lead not found' }); return; }
    res.json({ success: true, data: lead });
  } catch (err) {
    logger.error('LeadController.updateLeadStatus failed', err);
    res.status(500).json({ success: false, error: 'Failed to update lead status' });
  }
}

// PATCH /shop/leads/:id/status (shop) — the shop works its OWN leads (call/email + advance
// status). Ownership is verified via the lead's campaign shop_id, never a param.
export async function updateShopLeadStatus(req: Request, res: Response): Promise<void> {
  const shopId = shopIdOf(req);
  if (!shopId) { res.status(401).json({ success: false, error: 'Shop ID required' }); return; }
  const status = req.body?.status;
  if (!LEAD_STATUSES.includes(status)) {
    res.status(400).json({ success: false, error: `status must be one of: ${LEAD_STATUSES.join(', ')}` });
    return;
  }
  try {
    const existing = await leads.findById(req.params.id);
    if (!existing) { res.status(404).json({ success: false, error: 'Lead not found' }); return; }
    const ownerShopId = await campaigns.getShopIdForCampaign(existing.campaignId);
    if (ownerShopId !== shopId) { res.status(404).json({ success: false, error: 'Lead not found' }); return; }
    const lead = await applyLeadStatus(req.params.id, status, req.body?.lostReason ?? null);
    res.json({ success: true, data: lead });
  } catch (err) {
    logger.error('LeadController.updateShopLeadStatus failed', err);
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

// GET /leads/:id/messages (admin) — Stage 3.5 conversation thread.
export async function getLeadThread(req: Request, res: Response): Promise<void> {
  try {
    res.json({ success: true, data: await leadAutoAnswerService.getThread(req.params.id) });
  } catch (err) {
    logger.error('LeadController.getLeadThread failed', err);
    res.status(500).json({ success: false, error: 'Failed to load conversation' });
  }
}

// POST /leads/:id/messages (admin) — admin sends a manual reply (stored + delivered).
export async function postLeadMessage(req: Request, res: Response): Promise<void> {
  const body = (req.body?.body || '').toString().trim();
  if (!body) { res.status(400).json({ success: false, error: 'body is required' }); return; }
  try {
    res.status(201).json({ success: true, data: await leadAutoAnswerService.sendAdminMessage(req.params.id, body) });
  } catch (err: any) {
    const status = err?.status ?? 500;
    if (status >= 500) logger.error('LeadController.postLeadMessage failed', err);
    res.status(status).json({ success: false, error: err?.message || 'Failed to send message' });
  }
}

// POST /leads/:id/auto-answer (admin) — generate + send an AI reply for the thread now.
export async function autoAnswerLead(req: Request, res: Response): Promise<void> {
  try {
    res.json({ success: true, data: await leadAutoAnswerService.generateReply(req.params.id) });
  } catch (err: any) {
    const status = err?.status ?? 500;
    if (status >= 500) logger.error('LeadController.autoAnswerLead failed', err);
    res.status(status).json({ success: false, error: err?.message || 'Failed to auto-answer' });
  }
}

// POST /leads/inbound (PUBLIC) — a lead's reply arrives (from a channel webhook).
// Stores it and auto-answers IF the campaign has ai_agent_enabled. Guarded by a
// shared token when ADS_INBOUND_WEBHOOK_TOKEN is set.
export async function inboundLeadMessage(req: Request, res: Response): Promise<void> {
  const expected = process.env.ADS_INBOUND_WEBHOOK_TOKEN;
  if (expected && req.headers['x-ads-inbound-token'] !== expected) {
    res.status(401).json({ success: false, error: 'Invalid inbound token' });
    return;
  }
  const leadId = (req.body?.leadId || '').toString();
  const body = (req.body?.body || '').toString().trim();
  if (!leadId || !body) { res.status(400).json({ success: false, error: 'leadId and body are required' }); return; }
  try {
    const result = await leadAutoAnswerService.handleInbound(leadId, body, req.body?.channel);
    res.json({
      success: true,
      data: { inboundId: result.inbound.id, autoAnswered: result.autoAnswered, reply: result.reply?.body ?? null },
    });
  } catch (err: any) {
    const status = err?.status ?? 500;
    if (status >= 500) logger.error('LeadController.inboundLeadMessage failed', err);
    res.status(status).json({ success: false, error: err?.message || 'Failed to process inbound message' });
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
