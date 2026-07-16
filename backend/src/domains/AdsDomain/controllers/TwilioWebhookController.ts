// backend/src/domains/AdsDomain/controllers/TwilioWebhookController.ts
//
// Shared Twilio inbound webhook (SMS). One endpoint, three payload kinds, all gated by the
// X-Twilio-Signature (HMAC-SHA1, verified in TwilioService):
//   1. STOP/START keywords    → the GLOBAL sms opt-out list (suppresses ads + notifications + marketing)
//   2. delivery-status callback → move a sent message to delivered/failed (keys on the message SID)
//   3. any other inbound text  → route to the ads lead loop (find lead by phone → AI auto-answer)
// Acks fast with empty TwiML (Twilio retries non-2xx, and empty TwiML = "handled, no auto-reply").
//
// Body is application/x-www-form-urlencoded → parsed by the global express.urlencoded (this route is
// NOT in app.ts's raw-body list). Twilio signs the PARSED params, so no raw body is needed.

import { Request, Response } from 'express';
import { logger } from '../../../utils/logger';
import { twilioService } from '../../../services/TwilioService';
import { smsOptOutRepository } from '../../../repositories/SmsOptOutRepository';
import { normalizePhone } from '../../../utils/phone';
import { leadAutoAnswerService } from '../services/LeadAutoAnswerService';
import { LeadRepository } from '../repositories/LeadRepository';
import { LeadMessageRepository } from '../repositories/LeadMessageRepository';
import { customerSmsInboundService } from '../../messaging/services/CustomerSmsInboundService';

const leads = new LeadRepository();
const messages = new LeadMessageRepository();

const STOP_RE = /^(stop|stopall|unsubscribe|cancel|end|quit|revoke|optout)$/i;
const START_RE = /^(start|yes|unstop|optin)$/i;

/** Twilio MessageStatus → our ad_lead_messages.delivery_status enum; null = not a status we track. */
function mapStatus(s: string | undefined): string | null {
  switch ((s || '').toLowerCase()) {
    case 'queued': case 'accepted': case 'scheduled': case 'sending': return 'queued';
    case 'sent': return 'sent';
    case 'delivered': return 'delivered';
    case 'failed': case 'undelivered': return 'failed';
    default: return null;
  }
}

/** The exact public URL Twilio POSTed to — required for signature verification. Prefer an explicit
 *  override (proxies rewrite host/proto); else reconstruct from forwarded headers. */
function reconstructUrl(req: Request): string {
  if (process.env.TWILIO_WEBHOOK_URL) return process.env.TWILIO_WEBHOOK_URL;
  const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol;
  return `${proto}://${req.get('host')}${req.originalUrl}`;
}

// POST /api/ads/webhooks/twilio — inbound SMS + status callbacks (public, signature-verified).
export async function receiveTwilioWebhook(req: Request, res: Response): Promise<void> {
  const params = (req.body ?? {}) as Record<string, string>;
  const sig = req.header('x-twilio-signature');
  if (!twilioService.verifyWebhookSignature(reconstructUrl(req), params, sig)) {
    logger.warn('Twilio webhook: signature verification failed');
    res.sendStatus(403);
    return;
  }

  // Ack immediately; process after (Twilio retries on non-2xx / slow responses).
  res.type('text/xml').send('<Response></Response>');

  try {
    // (2) Delivery-status callback.
    const status = mapStatus(params.MessageStatus || params.SmsStatus);
    if ((params.MessageStatus || params.SmsStatus) && status && params.MessageSid) {
      await messages.updateDeliveryStatusByExternalId(params.MessageSid, status);
      return;
    }

    const from = normalizePhone(params.From);
    const body = (params.Body ?? '').trim();
    if (!from) return;

    // (1) Global opt-out / opt-in keywords.
    const word = body.replace(/[^a-z]/gi, '');
    if (STOP_RE.test(word)) { await smsOptOutRepository.optOut(from, 'stop_keyword'); logger.info(`Twilio: SMS opt-out recorded for ${from}`); return; }
    if (START_RE.test(word)) { await smsOptOutRepository.optIn(from, 'start_keyword'); logger.info(`Twilio: SMS opt-in recorded for ${from}`); return; }

    if (!body) return;

    // (3) Ads lead loop first — if this phone belongs to an ad lead, AI auto-answers (when the
    // campaign has it enabled).
    const lead = await leads.findByPhone(from);
    if (lead) {
      await leadAutoAnswerService.handleInbound(lead.id, body, 'sms', params.MessageSid ?? null);
      return;
    }

    // (4) Not an ad lead → regular-customer SMS conversation loop (Phase 1 Slice 2C). Routes by the
    // number the customer texted (To→shop). No-op unless ENABLE_CUSTOMER_SMS is on. Skipped cleanly
    // ('no_shop') until the shop has its own dedicated number (D2).
    const outcome = await customerSmsInboundService.handleInbound(params.To, from, body);
    if (outcome !== 'routed') {
      logger.info('Twilio: inbound SMS not routed to a customer conversation', { outcome });
    }
  } catch (err) {
    logger.error('Twilio webhook processing failed', err);
  }
}
