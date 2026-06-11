// backend/src/domains/AdsDomain/controllers/MetaWebhookController.ts
//
// Public Meta Lead Ads webhook. GET = Meta's subscription verification handshake.
// POST = lead delivery: verify the X-Hub-Signature-256, then attribute each
// leadgen event to our campaign (mapped via ad_campaigns.meta_campaign_id) as a
// meta_webhook lead (idempotent on meta_lead_id). The full lead fields
// (name/phone/email) require a Graph-API fetch with a page token — that
// enrichment is the live-Meta follow-up (MetaService scaffold); here we record
// the leadgen_id so the lead exists and can be enriched/contacted.
//
// req.body is a raw Buffer for this route (express.raw registered in app.ts).

import { Request, Response } from 'express';
import { logger } from '../../../utils/logger';
import { verifyMetaSignature, parseLeadEvents } from '../services/MetaWebhookService';
import { leadAttributionService } from '../services/LeadAttributionService';
import { CampaignRepository } from '../repositories/CampaignRepository';

const campaigns = new CampaignRepository();

// GET /webhooks/meta/leads — subscription verification.
export function verifyMetaWebhook(req: Request, res: Response): void {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    res.status(200).send(String(challenge ?? ''));
    return;
  }
  res.sendStatus(403);
}

// POST /webhooks/meta/leads — verified lead delivery.
export async function receiveMetaWebhook(req: Request, res: Response): Promise<void> {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    logger.warn('Meta webhook received but META_APP_SECRET not configured — rejecting');
    res.sendStatus(503);
    return;
  }
  const rawBody: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}));
  const sig = req.header('x-hub-signature-256');
  if (!verifyMetaSignature(rawBody, sig, appSecret)) {
    logger.warn('Meta webhook signature verification failed');
    res.sendStatus(401);
    return;
  }

  // Ack fast (Meta retries on non-200), then process.
  res.sendStatus(200);

  let payload: any;
  try { payload = JSON.parse(rawBody.toString('utf8')); }
  catch { logger.error('Meta webhook: body is not valid JSON'); return; }

  const events = parseLeadEvents(payload);
  for (const ev of events) {
    try {
      if (!ev.campaignId) {
        logger.info(`Meta webhook: leadgen ${ev.leadgenId} has no campaign_id (Graph fetch needed) — skipped`);
        continue;
      }
      const campaign = await campaigns.findByMetaCampaignId(ev.campaignId);
      if (!campaign) {
        logger.info(`Meta webhook: no ad_campaign mapped to meta_campaign_id ${ev.campaignId} — skipped`);
        continue;
      }
      // TODO (live Meta): fetch full lead fields (name/phone/email) via Graph API
      // using leadgen_id + the shop's page token, then enrich this lead.
      await leadAttributionService.attribute({
        campaignId: campaign.id,
        metaLeadId: ev.leadgenId,
        consentToContact: true, // Meta lead form = consent
        method: 'meta_webhook',
      });
    } catch (err) {
      logger.error(`Meta webhook: failed to process leadgen ${ev.leadgenId}`, err);
    }
  }
}
