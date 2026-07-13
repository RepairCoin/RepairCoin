// Ads SMS adapter: LeadChannelSender.deliver('sms', …) → Twilio, gated by ADS_LEAD_TRANSPORT_ENABLED
// + ADS_SMS_ENABLED + TWILIO_SMS_ENABLED, and suppressed for globally opted-out numbers.
process.env.SKIP_DB_CONNECTION_TESTS = 'true';

import { LeadChannelSender } from '../../src/domains/AdsDomain/services/LeadChannelSender';

function build(overrides: { twilioEnabled?: boolean; optedOut?: boolean; sendStatus?: 'sent' | 'failed' | 'disabled' } = {}) {
  const sent: any[] = [];
  const sms = {
    enabled: () => overrides.twilioEnabled ?? true,
    sendSms: async (to: string, body: string, cb?: string) => { sent.push({ to, body, cb }); return { status: overrides.sendStatus ?? 'sent', sid: 'SM1' }; },
  };
  const optOuts = { isOptedOut: async () => overrides.optedOut ?? false };
  // Only the last two constructor args (sms, optOuts) matter here; the rest are unused for SMS.
  const svc = new LeadChannelSender({} as any, {} as any, {} as any, {} as any, sms as any, optOuts as any);
  return { svc, sent };
}

const lead = { phone: '(555) 123-4567', email: null };
const saved = { ...process.env };
afterEach(() => { process.env = { ...saved }; });

describe("LeadChannelSender.deliver('sms')", () => {
  it("queues when ADS_SMS_ENABLED is off (even with transport on)", async () => {
    process.env.ADS_LEAD_TRANSPORT_ENABLED = 'true';
    process.env.ADS_SMS_ENABLED = 'false';
    const { svc, sent } = build();
    expect(await svc.deliver('sms', lead as any, 'hi')).toBe('queued');
    expect(sent).toHaveLength(0);
  });

  it("suppresses (records, does NOT send) when the number has globally opted out", async () => {
    process.env.ADS_LEAD_TRANSPORT_ENABLED = 'true';
    process.env.ADS_SMS_ENABLED = 'true';
    const { svc, sent } = build({ optedOut: true });
    expect(await svc.deliver('sms', lead as any, 'hi')).toBe('recorded');
    expect(sent).toHaveLength(0); // never handed to Twilio
  });

  it("sends via Twilio (E.164 normalized) when enabled + not opted out", async () => {
    process.env.ADS_LEAD_TRANSPORT_ENABLED = 'true';
    process.env.ADS_SMS_ENABLED = 'true';
    const { svc, sent } = build({ sendStatus: 'sent' });
    expect(await svc.deliver('sms', lead as any, 'your quote is $99')).toBe('sent');
    expect(sent[0].to).toBe('+15551234567'); // normalized before send
    expect(sent[0].body).toBe('your quote is $99');
  });

  it("returns 'failed' when Twilio rejects", async () => {
    process.env.ADS_LEAD_TRANSPORT_ENABLED = 'true';
    process.env.ADS_SMS_ENABLED = 'true';
    const { svc } = build({ sendStatus: 'failed' });
    expect(await svc.deliver('sms', lead as any, 'hi')).toBe('failed');
  });

  it("records (does not send) when the master transport flag is off", async () => {
    process.env.ADS_LEAD_TRANSPORT_ENABLED = 'false';
    process.env.ADS_SMS_ENABLED = 'true';
    const { svc, sent } = build();
    expect(await svc.deliver('sms', lead as any, 'hi')).toBe('recorded');
    expect(sent).toHaveLength(0);
  });
});
