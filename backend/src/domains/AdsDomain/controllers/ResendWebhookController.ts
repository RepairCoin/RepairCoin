// backend/src/domains/AdsDomain/controllers/ResendWebhookController.ts
//
// Public Resend email webhook (lead follow-up Phase 4). Verifies the Svix signature, then merges
// delivery/open/click/bounce/complaint events into the matching lead email activity's meta so the
// timeline shows real engagement. Acks fast (Resend retries on non-2xx), processes after.
//
// req.body is a raw Buffer for this route (express.raw registered in app.ts).

import { Request, Response } from 'express';
import { logger } from '../../../utils/logger';
import { verifyResendSignature, parseResendEvent } from '../services/ResendWebhookService';
import { AdLeadActivityRepository } from '../repositories/AdLeadActivityRepository';

const activities = new AdLeadActivityRepository();

// POST /webhooks/resend — verified email engagement events.
export async function receiveResendWebhook(req: Request, res: Response): Promise<void> {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    logger.warn('Resend webhook received but RESEND_WEBHOOK_SECRET not configured — rejecting');
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
    logger.warn('Resend webhook signature verification failed');
    res.sendStatus(401);
    return;
  }

  // Ack fast, then process (Resend retries on non-2xx).
  res.sendStatus(200);

  let payload: any;
  try { payload = JSON.parse(rawBody.toString('utf8')); }
  catch { logger.error('Resend webhook: body is not valid JSON'); return; }

  const { messageId, patch } = parseResendEvent(payload);
  if (!messageId || !patch) return; // event we don't track, or no message id
  try {
    const matched = await activities.recordEmailEvent(messageId, patch);
    if (matched === 0) {
      logger.info(`Resend webhook: ${payload?.type} for ${messageId} matched no lead activity — skipped`);
    }
  } catch (err) {
    logger.error(`Resend webhook: failed to record ${payload?.type} for ${messageId}`, err);
  }
}
