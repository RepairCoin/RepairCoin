// backend/src/domains/messaging/controllers/CustomerConsentController.ts
//
// Customer-facing SMS/WhatsApp opt-in consent. Backs the compliant "SMS Notifications" toggle in
// the customer's notification preferences (Twilio toll-free verification, reason code 30498 — the
// opt-in must be explicit and recorded, not implied). Consent is phone-keyed, so we resolve the
// authenticated customer's phone from their profile; the frontend never sends the number.
//
// See docs/tasks/strategy/twilio-tollfree-verification-compliance.md.

import { Request, Response } from 'express';
import { customerConsentService } from '../services/CustomerConsentService';
import { CustomerRepository } from '../../../repositories/CustomerRepository';
import type { ConsentChannel } from '../../../repositories/CustomerConsentRepository';
import { logger } from '../../../utils/logger';

const customerRepo = new CustomerRepository();
const CONSENT_SOURCE = 'notification_preferences';

const isChannel = (c: unknown): c is ConsentChannel => c === 'sms' || c === 'whatsapp';

/** The authenticated customer's phone (E.164 as stored), or null if they have none on file. */
async function resolvePhone(req: Request): Promise<string | null> {
  const address = (req as any).user?.address?.toLowerCase();
  if (!address) return null;
  const customer = await customerRepo.getCustomer(address);
  const phone = customer?.phone?.trim();
  return phone ? phone : null;
}

// GET /api/messages/consent?channel=sms — current opt-in state (drives the toggle's initial value).
export async function getMyConsent(req: Request, res: Response): Promise<void> {
  try {
    const channel = (req.query.channel as string) ?? 'sms';
    if (!isChannel(channel)) {
      res.status(400).json({ success: false, error: 'channel must be sms or whatsapp' });
      return;
    }
    const phone = await resolvePhone(req);
    if (!phone) {
      // No phone on file → can't have SMS consent. Not an error; the UI prompts to add a number.
      res.json({ success: true, data: { granted: false, hasPhone: false } });
      return;
    }
    const granted = await customerConsentService.hasConsent(phone, channel);
    res.json({ success: true, data: { granted, hasPhone: true } });
  } catch (err) {
    logger.error('CustomerConsentController.getMyConsent failed', err);
    res.status(500).json({ success: false, error: 'Failed to load consent' });
  }
}

// POST /api/messages/consent { channel, granted } — record an explicit opt-in / opt-out.
export async function setMyConsent(req: Request, res: Response): Promise<void> {
  try {
    const { channel, granted } = (req.body ?? {}) as { channel?: unknown; granted?: unknown };
    if (!isChannel(channel)) {
      res.status(400).json({ success: false, error: 'channel must be sms or whatsapp' });
      return;
    }
    if (typeof granted !== 'boolean') {
      res.status(400).json({ success: false, error: '`granted` (boolean) is required' });
      return;
    }
    const phone = await resolvePhone(req);
    if (!phone) {
      // Can't opt in without a number to send to. 400 so the UI can prompt "add a phone first".
      res.status(400).json({
        success: false,
        error: 'no_phone',
        message: 'Add a phone number to your profile before enabling SMS.',
      });
      return;
    }
    if (granted) await customerConsentService.grantExplicit(phone, channel, CONSENT_SOURCE);
    else await customerConsentService.revoke(phone, channel, CONSENT_SOURCE);
    res.json({ success: true, data: { granted } });
  } catch (err) {
    logger.error('CustomerConsentController.setMyConsent failed', err);
    res.status(500).json({ success: false, error: 'Failed to update consent' });
  }
}
