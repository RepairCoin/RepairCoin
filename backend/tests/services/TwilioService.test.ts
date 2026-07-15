// Shared Twilio SMS core: env gating, E.164 helpers, and X-Twilio-Signature verification (the security
// gate on the inbound webhook). No network — sendSms is only exercised for its disabled/unconfigured guards.
process.env.SKIP_DB_CONNECTION_TESTS = 'true';

import crypto from 'crypto';
import { TwilioService } from '../../src/services/TwilioService';
import { normalizePhone, isE164 } from '../../src/utils/phone';

describe('phone util', () => {
  it('normalizes to E.164 (US default for bare 10-digit)', () => {
    expect(normalizePhone('(555) 123-4567')).toBe('+15551234567');
    expect(normalizePhone('+63 917 000 0001')).toBe('+639170000001');
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone(null)).toBeNull();
  });
  it('validates E.164 shape', () => {
    expect(isE164('+15551234567')).toBe(true);
    expect(isE164('5551234567')).toBe(false);
    expect(isE164('+1')).toBe(false);
  });
});

describe('TwilioService gating', () => {
  const svc = new TwilioService();
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; });

  it('enabled() only when the flag is exactly "true"', () => {
    process.env.TWILIO_SMS_ENABLED = 'true';
    expect(svc.enabled()).toBe(true);
    process.env.TWILIO_SMS_ENABLED = 'false';
    expect(svc.enabled()).toBe(false);
  });

  it('isReady() needs sid + token + from-number', () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC123';
    process.env.TWILIO_AUTH_TOKEN = 'tok';
    delete process.env.TWILIO_SMS_FROM;
    expect(svc.isReady()).toBe(false);
    process.env.TWILIO_SMS_FROM = '+15551234567';
    expect(svc.isReady()).toBe(true);
  });

  it('sendSms is a no-op ("disabled") when the master flag is off', async () => {
    process.env.TWILIO_SMS_ENABLED = 'false';
    await expect(svc.sendSms('+15551234567', 'hi')).resolves.toEqual({ status: 'disabled' });
  });
});

describe('TwilioService.verifyWebhookSignature', () => {
  const svc = new TwilioService();
  const TOKEN = 'test_auth_token';
  beforeEach(() => { process.env.TWILIO_AUTH_TOKEN = TOKEN; });

  // Twilio's algorithm: HMAC-SHA1 of (url + sorted params concatenated as key+value), keyed by auth token, base64.
  function sign(url: string, params: Record<string, string>): string {
    const data = url + Object.keys(params).sort().map((k) => k + params[k]).join('');
    return crypto.createHmac('sha1', TOKEN).update(Buffer.from(data, 'utf-8')).digest('base64');
  }

  it('accepts a correctly signed request', () => {
    const url = 'https://api.example.com/webhooks/twilio';
    const params = { From: '+15551234567', Body: 'STOP', MessageSid: 'SM1' };
    expect(svc.verifyWebhookSignature(url, params, sign(url, params))).toBe(true);
  });

  it('rejects a tampered body / wrong signature / missing signature', () => {
    const url = 'https://api.example.com/webhooks/twilio';
    const params = { From: '+15551234567', Body: 'STOP' };
    const good = sign(url, params);
    expect(svc.verifyWebhookSignature(url, { ...params, Body: 'START' }, good)).toBe(false);
    expect(svc.verifyWebhookSignature(url, params, 'deadbeef')).toBe(false);
    expect(svc.verifyWebhookSignature(url, params, undefined)).toBe(false);
  });
});
