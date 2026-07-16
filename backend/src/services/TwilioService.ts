// backend/src/services/TwilioService.ts
//
// Shared Twilio SMS transport for the whole platform (ads lead loop, notifications, marketing).
// Talks to Twilio's REST API directly over axios + Basic auth — the same "no vendor SDK" approach
// the codebase uses for Meta's Graph API and Resend, so there's no new dependency.
//
// This is the low-level sender ONLY: it does not know about leads, notifications, or consent. Callers
// resolve the recipient + check the shared SMS opt-out list (SmsOptOutRepository) BEFORE calling send.
// Gated by TWILIO_SMS_ENABLED; when off (or unconfigured) send is a no-op returning 'failed'/'disabled'.

import axios from 'axios';
import crypto from 'crypto';
import { logger } from '../utils/logger';

const sid = () => (process.env.TWILIO_ACCOUNT_SID || '').trim();
const authToken = () => (process.env.TWILIO_AUTH_TOKEN || '').trim();
const fromNumber = () => (process.env.TWILIO_SMS_FROM || '').trim();

export interface SmsSendResult {
  /** 'sent' = Twilio accepted it (not a delivery guarantee — a status webhook confirms delivered/failed). */
  status: 'sent' | 'failed' | 'disabled';
  /** Twilio message SID (MMxx…) — the key a delivery-status callback references. */
  sid?: string;
  error?: string;
}

export class TwilioService {
  /** Master gate: SMS is off by default (needs creds + a number + a paid/registered account to go wide). */
  enabled(): boolean {
    return process.env.TWILIO_SMS_ENABLED === 'true';
  }

  /** Credentials + a from-number are all present. */
  isReady(): boolean {
    return !!(sid() && authToken() && fromNumber());
  }

  /** Send one SMS to an E.164 number. Best-effort — never throws; returns a status the caller records.
   *  `statusCallback` (optional) is the public URL Twilio POSTs delivery updates to.
   *  `from` (optional) overrides the shared TWILIO_SMS_FROM — used to send from a shop's own
   *  dedicated number (per-shop-number, D2). Defaults to the shared number. */
  async sendSms(
    to: string,
    body: string,
    statusCallback?: string,
    from?: string
  ): Promise<SmsSendResult> {
    if (!this.enabled()) return { status: 'disabled' };
    const fromResolved = (from || fromNumber()).trim();
    if (!(sid() && authToken() && fromResolved)) {
      logger.warn('TwilioService.sendSms: TWILIO_SMS_ENABLED but creds/from-number missing');
      return { status: 'failed', error: 'not_configured' };
    }
    try {
      const form = new URLSearchParams({ To: to, From: fromResolved, Body: body });
      if (statusCallback) form.set('StatusCallback', statusCallback);
      const res = await axios.post(
        `https://api.twilio.com/2010-04-01/Accounts/${sid()}/Messages.json`,
        form.toString(),
        {
          auth: { username: sid(), password: authToken() },
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 15000,
        }
      );
      return { status: 'sent', sid: res.data?.sid };
    } catch (err: any) {
      const e = err?.response?.data;
      logger.error('TwilioService.sendSms failed', { to, code: e?.code, error: e?.message || err?.message });
      return { status: 'failed', error: e?.message || err?.message };
    }
  }

  /** Verify a Twilio webhook's X-Twilio-Signature (HMAC-SHA1 of the full URL + sorted POST params,
   *  keyed by the auth token, base64). Node crypto only — no SDK. Returns true when it matches. */
  verifyWebhookSignature(url: string, params: Record<string, string>, signature: string | undefined): boolean {
    if (!signature || !authToken()) return false;
    const data = url + Object.keys(params).sort().map((k) => k + params[k]).join('');
    const expected = crypto.createHmac('sha1', authToken()).update(Buffer.from(data, 'utf-8')).digest('base64');
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  }
}

export const twilioService = new TwilioService();
