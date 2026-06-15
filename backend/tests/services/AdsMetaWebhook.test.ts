// backend/tests/services/AdsMetaWebhook.test.ts
//
// Ads System Stage 4 — pure tests for the Meta webhook helpers (no DB / no Meta).

import crypto from 'crypto';
import { verifyMetaSignature, parseLeadEvents } from '../../src/domains/AdsDomain/services/MetaWebhookService';

const sign = (body: string, secret: string) =>
  'sha256=' + crypto.createHmac('sha256', secret).update(Buffer.from(body)).digest('hex');

describe('verifyMetaSignature', () => {
  const secret = 'app_secret_123';
  const body = JSON.stringify({ object: 'page', entry: [] });

  it('accepts a correctly-signed body', () => {
    expect(verifyMetaSignature(body, sign(body, secret), secret)).toBe(true);
  });
  it('rejects a tampered body', () => {
    const goodSig = sign(body, secret);
    expect(verifyMetaSignature(body + 'x', goodSig, secret)).toBe(false);
  });
  it('rejects a wrong secret', () => {
    expect(verifyMetaSignature(body, sign(body, 'other'), secret)).toBe(false);
  });
  it('returns false on missing signature or secret', () => {
    expect(verifyMetaSignature(body, undefined, secret)).toBe(false);
    expect(verifyMetaSignature(body, sign(body, secret), undefined)).toBe(false);
  });
});

describe('parseLeadEvents', () => {
  it('extracts leadgen events with their ids', () => {
    const payload = {
      object: 'page',
      entry: [{
        id: 'page1',
        changes: [{
          field: 'leadgen',
          value: { leadgen_id: '99887766', form_id: 'f1', ad_id: 'a1', campaign_id: 'c1', created_time: 1718000000 },
        }],
      }],
    };
    const ev = parseLeadEvents(payload);
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ leadgenId: '99887766', campaignId: 'c1', adId: 'a1' });
  });

  it('ignores non-leadgen changes and events without a leadgen_id', () => {
    const payload = {
      entry: [{ changes: [
        { field: 'feed', value: {} },
        { field: 'leadgen', value: { form_id: 'f1' } }, // no leadgen_id
        { field: 'leadgen', value: { leadgen_id: '1' } },
      ] }],
    };
    expect(parseLeadEvents(payload)).toHaveLength(1);
  });

  it('is tolerant of a malformed payload', () => {
    expect(parseLeadEvents(null)).toEqual([]);
    expect(parseLeadEvents({})).toEqual([]);
    expect(parseLeadEvents({ entry: 'nope' })).toEqual([]);
  });
});
