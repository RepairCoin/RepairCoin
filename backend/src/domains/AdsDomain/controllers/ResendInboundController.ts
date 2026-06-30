// backend/src/domains/AdsDomain/controllers/ResendInboundController.ts
//
// Public Resend INBOUND email webhook (lead replies → app). Verifies the Svix signature (reusing the
// engagement webhook's verifier, with its own secret RESEND_INBOUND_WEBHOOK_SECRET), acks fast, then
// hands the payload to InboundEmailService. req.body is a raw Buffer (express.raw in app.ts).
// See docs/tasks/strategy/ads-system/ads-inbound-email-scope.md.

import { Request, Response } from 'express';
import { logger } from '../../../utils/logger';
import { verifyResendSignature } from '../services/ResendWebhookService';
import { inboundEmailService } from '../services/InboundEmailService';

// POST /webhooks/resend-inbound — verified inbound lead email.
export async function receiveResendInbound(req: Request, res: Response): Promise<void> {
  const secret = process.env.RESEND_INBOUND_WEBHOOK_SECRET;
  if (!secret) {
    logger.warn('Resend inbound webhook received but RESEND_INBOUND_WEBHOOK_SECRET not configured — rejecting');
    res.sendStatus(503);
    return;
  }
  const rawBody: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}));
  const ok = verifyResendSignature(
    rawBody,
    {
      id: req.header('svix-id') ?? undefined,
      timestamp: req.header('svix-timestamp') ?? undefined,
      signature: req.header('svix-signature') ?? undefined,
    },
    secret
  );
  if (!ok) {
    logger.warn('Resend inbound webhook signature verification failed');
    res.sendStatus(401);
    return;
  }

  // Ack fast (Resend retries on non-2xx), then process.
  res.sendStatus(200);

  let payload: any;
  try { payload = JSON.parse(rawBody.toString('utf8')); }
  catch { logger.error('Resend inbound webhook: body is not valid JSON'); return; }

  try {
    const r = await inboundEmailService.handle(payload);
    if (r.outcome.startsWith('ignored')) {
      logger.info(`InboundEmail: ${r.outcome}`, { leadId: r.leadId });
    }
  } catch (err) {
    logger.error('Resend inbound webhook: processing failed', err);
  }
}
