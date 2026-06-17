// Pure tests for the Phase-2 ad-copy parser. The LLM + image generation IO is exercised
// manually (costs money + needs a Meta test ad account).

import { parseAdCopy } from '../../src/domains/AdsDomain/services/adCopyParse';

describe('parseAdCopy', () => {
  it('parses clean JSON', () => {
    const r = parseAdCopy('{"headline":"Fix it fast","primaryText":"Book your repair today."}', 'fallback');
    expect(r.headline).toBe('Fix it fast');
    expect(r.primaryText).toBe('Book your repair today.');
  });

  it('tolerates prose around the JSON', () => {
    const r = parseAdCopy('Sure! Here is the copy:\n{"headline":"Save 20%","primaryText":"Limited time."} Hope it helps.', 'fb');
    expect(r.headline).toBe('Save 20%');
    expect(r.primaryText).toBe('Limited time.');
  });

  it('truncates over-long fields to the Meta-friendly caps', () => {
    const longHead = 'x'.repeat(80);
    const longBody = 'y'.repeat(200);
    const r = parseAdCopy(`{"headline":"${longHead}","primaryText":"${longBody}"}`, 'fb');
    expect(r.headline.length).toBe(40);
    expect(r.primaryText.length).toBe(125);
  });

  it('falls back when JSON is missing or malformed', () => {
    expect(parseAdCopy('no json here', 'My Offer')).toEqual({ headline: 'My Offer', primaryText: 'My Offer' });
    expect(parseAdCopy('{broken', 'My Offer').headline).toBe('My Offer');
  });

  it('falls back per-field when a key is empty', () => {
    const r = parseAdCopy('{"headline":"","primaryText":"Real text"}', 'Fallback');
    expect(r.headline).toBe('Fallback');
    expect(r.primaryText).toBe('Real text');
  });
});
