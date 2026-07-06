// backend/src/domains/AdsDomain/controllers/LeadController.ts
//
// Lead list + manual create + status change (admin), and own-scoped read (shop).
// Stage 0 = manual path only; UTM/Meta attribution + dedupe + convert is Stage 2.

import { Request, Response } from 'express';
import { logger } from '../../../utils/logger';
import { eventBus, createDomainEvent } from '../../../events/EventBus';
import { AdsEvents } from '../events';
import { LeadRepository, type LeadConversationRow } from '../repositories/LeadRepository';
import { CampaignRepository } from '../repositories/CampaignRepository';
import { deriveConversationState, needsHuman as isNeedsHuman } from '../services/leadConversationState';
import { AdLeadActivityRepository, type AdLeadActivityType } from '../repositories/AdLeadActivityRepository';
import { leadAttributionService } from '../services/LeadAttributionService';
import { getAdAttributionService } from '../services/AdAttributionService';
import { leadAIService } from '../services/LeadAIService';
import { leadAutoAnswerService } from '../services/LeadAutoAnswerService';
import { leadEmailService } from '../services/LeadEmailService';

const leads = new LeadRepository();
const campaigns = new CampaignRepository();
const activities = new AdLeadActivityRepository();
const shopIdOf = (req: Request): string | undefined => (req as any).user?.shopId;

const LEAD_STATUSES = ['new', 'contacted', 'booked', 'paid', 'completed', 'lost'];

/** Shop-scoped lead access: resolve the lead and confirm it belongs to the requesting shop
 *  (via the lead's campaign shop_id — never a path param). Sends the appropriate 401/404 and
 *  returns null on failure; returns the lead on success. */
async function getOwnedShopLead(req: Request, res: Response) {
  const shopId = shopIdOf(req);
  if (!shopId) { res.status(401).json({ success: false, error: 'Shop ID required' }); return null; }
  const lead = await leads.findById(req.params.id);
  if (!lead) { res.status(404).json({ success: false, error: 'Lead not found' }); return null; }
  const ownerShopId = await campaigns.getShopIdForCampaign(lead.campaignId);
  if (ownerShopId !== shopId) { res.status(404).json({ success: false, error: 'Lead not found' }); return null; }
  return lead;
}

/** Apply a lead status change + the conversion/booking side effects (shared by admin + shop). */
async function applyLeadStatus(leadId: string, status: string, lostReason: string | null, actorAddress?: string | null) {
  const lead = await leads.updateStatus(leadId, status as any, lostReason);
  if (!lead) return null;
  // Activity timeline: record every Kanban status move (best-effort — a log failure must not
  // break the status update).
  void activities.log({
    leadId, type: 'status_change', actorAddress: actorAddress ?? null,
    meta: { status, ...(lostReason ? { lostReason } : {}) },
  }).catch((e) => logger.warn(`lead activity log (status_change) failed for ${leadId}: ${e?.message || e}`));
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
      gclid: b.gclid,
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
    const lead = await applyLeadStatus(req.params.id, status, req.body?.lostReason ?? null, req.user?.address ?? null);
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
    const lead = await applyLeadStatus(req.params.id, status, req.body?.lostReason ?? null, req.user?.address ?? shopId);
    res.json({ success: true, data: lead });
  } catch (err) {
    logger.error('LeadController.updateShopLeadStatus failed', err);
    res.status(500).json({ success: false, error: 'Failed to update lead status' });
  }
}

// GET /leads/:id/activities (admin) — the lead's follow-up timeline (calls/notes/emails/status moves).
export async function getLeadActivities(req: Request, res: Response): Promise<void> {
  try {
    const lead = await leads.findById(req.params.id);
    if (!lead) { res.status(404).json({ success: false, error: 'Lead not found' }); return; }
    const items = await activities.listByLead(req.params.id);
    res.json({ success: true, data: items });
  } catch (err) {
    logger.error('LeadController.getLeadActivities failed', err);
    res.status(500).json({ success: false, error: 'Failed to load lead activities' });
  }
}

// POST /leads/:id/activities (admin) — log a manual note or call. (Emails are logged by the
// Phase 2 send endpoint; status moves are logged by the Kanban update — neither is logged here.)
export async function logLeadActivity(req: Request, res: Response): Promise<void> {
  const type = req.body?.type as AdLeadActivityType;
  if (type !== 'note' && type !== 'call') {
    res.status(400).json({ success: false, error: 'type must be "note" or "call"' });
    return;
  }
  try {
    const lead = await leads.findById(req.params.id);
    if (!lead) { res.status(404).json({ success: false, error: 'Lead not found' }); return; }
    const activity = await activities.log({
      leadId: req.params.id,
      type,
      channel: type === 'call' ? 'phone' : null,
      body: req.body?.body ?? null,
      outcome: type === 'call' ? (req.body?.outcome ?? null) : null,
      actorAddress: req.user?.address ?? null,
    });
    // A logged call is a real touch → stamp first response time (notes don't count).
    if (type === 'call') await leads.markContacted(req.params.id);
    res.status(201).json({ success: true, data: activity });
  } catch (err) {
    logger.error('LeadController.logLeadActivity failed', err);
    res.status(500).json({ success: false, error: 'Failed to log activity' });
  }
}

// POST /leads/:id/email (admin) — send a tracked email to the lead via Resend. Logs an `email`
// activity + posts into the conversation thread. Returns 503 {code:'email_not_configured'} when
// Resend isn't set up so the UI can fall back to a mailto: link.
export async function emailLead(req: Request, res: Response): Promise<void> {
  try {
    const result = await leadEmailService.send({
      leadId: req.params.id,
      subject: req.body?.subject,
      html: req.body?.html,
      actorAddress: req.user?.address ?? null,
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    const status = err?.status ?? 500;
    if (status >= 500 && status !== 503) logger.error('LeadController.emailLead failed', err);
    res.status(status).json({ success: false, error: err?.message || 'Failed to send email', code: err?.code });
  }
}

// --- Shop-scoped lead follow-up (shop works its OWN leads: timeline, log call/note, email) ---
// Same behaviour as the admin handlers above, but ownership-gated via getOwnedShopLead.

// GET /shop/leads/:id/activities (shop)
export async function getShopLeadActivities(req: Request, res: Response): Promise<void> {
  try {
    const lead = await getOwnedShopLead(req, res);
    if (!lead) return;
    const items = await activities.listByLead(req.params.id);
    res.json({ success: true, data: items });
  } catch (err) {
    logger.error('LeadController.getShopLeadActivities failed', err);
    res.status(500).json({ success: false, error: 'Failed to load lead activities' });
  }
}

// POST /shop/leads/:id/activities (shop) — log a note or call.
export async function logShopLeadActivity(req: Request, res: Response): Promise<void> {
  const type = req.body?.type as AdLeadActivityType;
  if (type !== 'note' && type !== 'call') {
    res.status(400).json({ success: false, error: 'type must be "note" or "call"' });
    return;
  }
  try {
    const lead = await getOwnedShopLead(req, res);
    if (!lead) return;
    const activity = await activities.log({
      leadId: req.params.id,
      type,
      channel: type === 'call' ? 'phone' : null,
      body: req.body?.body ?? null,
      outcome: type === 'call' ? (req.body?.outcome ?? null) : null,
      actorAddress: req.user?.address ?? shopIdOf(req) ?? null,
    });
    if (type === 'call') await leads.markContacted(req.params.id);
    res.status(201).json({ success: true, data: activity });
  } catch (err) {
    logger.error('LeadController.logShopLeadActivity failed', err);
    res.status(500).json({ success: false, error: 'Failed to log activity' });
  }
}

// POST /shop/leads/:id/email (shop) — send a tracked email to the shop's own lead.
export async function emailShopLead(req: Request, res: Response): Promise<void> {
  try {
    const lead = await getOwnedShopLead(req, res);
    if (!lead) return;
    const result = await leadEmailService.send({
      leadId: req.params.id,
      subject: req.body?.subject,
      html: req.body?.html,
      actorAddress: req.user?.address ?? shopIdOf(req) ?? null,
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    const status = err?.status ?? 500;
    if (status >= 500 && status !== 503) logger.error('LeadController.emailShopLead failed', err);
    res.status(status).json({ success: false, error: err?.message || 'Failed to send email', code: err?.code });
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

// --- Shop-scoped conversation thread (ownership-gated mirror of the admin message/draft/auto-answer
//     handlers above). Lets a shop READ the conversation (incl. the lead's email replies + AI answers)
//     and respond for its OWN leads — since in the AI-email model replies land in the app, not the
//     shop inbox. Ownership is verified via getOwnedShopLead (the lead's campaign shop_id). ---

// GET /shop/leads/:id/messages (shop) — conversation thread for an owned lead.
export async function getShopLeadThread(req: Request, res: Response): Promise<void> {
  try {
    const lead = await getOwnedShopLead(req, res);
    if (!lead) return;
    res.json({ success: true, data: await leadAutoAnswerService.getThread(req.params.id) });
  } catch (err) {
    logger.error('LeadController.getShopLeadThread failed', err);
    res.status(500).json({ success: false, error: 'Failed to load conversation' });
  }
}

// POST /shop/leads/:id/messages (shop) — shop sends a manual reply to its own lead.
export async function postShopLeadMessage(req: Request, res: Response): Promise<void> {
  const body = (req.body?.body || '').toString().trim();
  if (!body) { res.status(400).json({ success: false, error: 'body is required' }); return; }
  try {
    const lead = await getOwnedShopLead(req, res);
    if (!lead) return;
    res.status(201).json({ success: true, data: await leadAutoAnswerService.sendAdminMessage(req.params.id, body) });
  } catch (err: any) {
    const status = err?.status ?? 500;
    if (status >= 500) logger.error('LeadController.postShopLeadMessage failed', err);
    res.status(status).json({ success: false, error: err?.message || 'Failed to send message' });
  }
}

// POST /shop/leads/:id/auto-answer (shop) — generate + send an AI reply for an owned lead.
export async function autoAnswerShopLead(req: Request, res: Response): Promise<void> {
  try {
    const lead = await getOwnedShopLead(req, res);
    if (!lead) return;
    res.json({ success: true, data: await leadAutoAnswerService.generateReply(req.params.id) });
  } catch (err: any) {
    const status = err?.status ?? 500;
    if (status >= 500) logger.error('LeadController.autoAnswerShopLead failed', err);
    res.status(status).json({ success: false, error: err?.message || 'Failed to auto-answer' });
  }
}

// POST /shop/leads/:id/draft-reply (shop) — AI-drafted outreach for an owned lead.
export async function draftShopLeadReply(req: Request, res: Response): Promise<void> {
  try {
    const lead = await getOwnedShopLead(req, res);
    if (!lead) return;
    res.json({ success: true, data: await leadAIService.draftOutreach(req.params.id) });
  } catch (err: any) {
    const status = err?.status ?? 500;
    logger.error('LeadController.draftShopLeadReply failed', err);
    res.status(status).json({ success: false, error: err?.message || 'Failed to draft reply' });
  }
}

// --- Conversation inbox (Part B redesign, P2) — leads as conversation rows with a derived state, so
//     the shop works by conversation and the 'needs you' queue is meaningful in an AI-first flow. ---

/** Shape a repo row into an inbox item + its derived conversation state / needs-you flag. */
function toConversationItem(row: LeadConversationRow, nowMs: number) {
  const aiWillInitiate = row.campaignOutreachMode === 'auto' && process.env.ADS_AI_INITIATE_ENABLED === 'true';
  const state = deriveConversationState({
    hasMessages: (row.messageCount ?? 0) > 0,
    lastDirection: row.lastDirection,
    lastAtMs: row.lastAt ? new Date(row.lastAt).getTime() : null,
    aiWillInitiate,
    nowMs,
  });
  return {
    id: row.id, campaignId: row.campaignId, campaignName: row.campaignName,
    name: row.name, email: row.email, phone: row.phone,
    leadStatus: row.leadStatus, hasChatChannel: row.hasChatChannel,
    lastDirection: row.lastDirection, lastAuthor: row.lastAuthor, lastBody: row.lastBody,
    lastAt: row.lastAt, messageCount: row.messageCount ?? 0,
    conversationState: state, needsHuman: isNeedsHuman(state),
    createdAt: row.createdAt,
  };
}

// GET /shop/conversations (shop) — the shop's own lead conversations (optional ?campaignId).
export async function getShopConversations(req: Request, res: Response): Promise<void> {
  const shopId = shopIdOf(req);
  if (!shopId) { res.status(401).json({ success: false, error: 'Shop ID required' }); return; }
  try {
    const rows = await leads.listConversations({ shopId, campaignId: (req.query.campaignId as string) || undefined, limit: 200 });
    const now = Date.now();
    res.json({ success: true, data: rows.map((r) => toConversationItem(r, now)) });
  } catch (err) {
    logger.error('LeadController.getShopConversations failed', err);
    res.status(500).json({ success: false, error: 'Failed to load conversations' });
  }
}

// GET /leads/conversations (admin) — all lead conversations (optional ?campaignId / ?shopId).
export async function getLeadConversations(req: Request, res: Response): Promise<void> {
  try {
    const rows = await leads.listConversations({
      campaignId: (req.query.campaignId as string) || undefined,
      shopId: (req.query.shopId as string) || undefined,
      limit: 200,
    });
    const now = Date.now();
    res.json({ success: true, data: rows.map((r) => toConversationItem(r, now)) });
  } catch (err) {
    logger.error('LeadController.getLeadConversations failed', err);
    res.status(500).json({ success: false, error: 'Failed to load conversations' });
  }
}

// POST /attribution/backfill (admin) — run the conversion-attribution backfill now (contact-match
// unlinked paid orders → ad leads, advance to 'paid', and upload the offline conversion to Google
// for gclid leads). Normally runs on the order-paid event; this is a manual trigger. Optional ?shopId.
export async function triggerAttributionBackfill(req: Request, res: Response): Promise<void> {
  try {
    const shopId = (req.query.shopId as string) || undefined;
    const r = await getAdAttributionService().backfillUnattributed({ shopId, sinceDays: 180, limit: 500 });
    res.json({ success: true, data: r });
  } catch (err) {
    logger.error('LeadController.triggerAttributionBackfill failed', err);
    res.status(500).json({ success: false, error: 'Failed to run attribution backfill' });
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
