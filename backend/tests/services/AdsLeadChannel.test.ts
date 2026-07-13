// Pure unit tests for lead-channel selection (Stage 3.5). No DB / no network.

import { LeadChannelSender } from '../../src/domains/AdsDomain/services/LeadChannelSender';

const c = (o: Partial<Parameters<typeof LeadChannelSender.pickChannel>[0]> = {}) =>
  ({ phone: null, email: null, messengerId: null, whatsappId: null, ...o });

describe('LeadChannelSender.pickChannel', () => {
  // Priority: messenger > whatsapp > email > sms. Email outranks SMS even though both are wired now
  // (Twilio) — email is free per message and carries no opt-out/TCPA cost. A phone-only lead → sms.
  it('prefers messenger, then whatsapp, then email, then sms', () => {
    expect(LeadChannelSender.pickChannel(c({ messengerId: 'm1', phone: '+15551234567' }))).toBe('messenger');
    expect(LeadChannelSender.pickChannel(c({ whatsappId: 'w1', phone: '+15551234567' }))).toBe('whatsapp');
    expect(LeadChannelSender.pickChannel(c({ phone: '+15551234567', email: 'a@b.com' }))).toBe('email');
    expect(LeadChannelSender.pickChannel(c({ phone: '+15551234567' }))).toBe('sms');
    expect(LeadChannelSender.pickChannel(c({ email: 'a@b.com' }))).toBe('email');
  });

  it('falls back to manual with no contact info', () => {
    expect(LeadChannelSender.pickChannel(c())).toBe('manual');
  });

  it('transport is off by default (records, never auto-sends)', async () => {
    const sender = new LeadChannelSender();
    const prev = process.env.ADS_LEAD_TRANSPORT_ENABLED;
    delete process.env.ADS_LEAD_TRANSPORT_ENABLED;
    expect(sender.isTransportEnabled()).toBe(false);
    expect(await sender.deliver('sms', c({ phone: '+15551234567' }), 'hi')).toBe('recorded');
    if (prev !== undefined) process.env.ADS_LEAD_TRANSPORT_ENABLED = prev;
  });

  it('manual channel records even when transport is enabled', async () => {
    const sender = new LeadChannelSender();
    process.env.ADS_LEAD_TRANSPORT_ENABLED = 'true';
    expect(await sender.deliver('manual', c(), 'hi')).toBe('recorded');
    expect(await sender.deliver('sms', c({ phone: '+1' }), 'hi')).toBe('queued'); // wired, but ADS_SMS_ENABLED off → queued
    delete process.env.ADS_LEAD_TRANSPORT_ENABLED;
  });
});
