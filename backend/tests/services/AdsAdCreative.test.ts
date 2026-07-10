// Pure tests for the Phase-2 ad-copy parser. The LLM + image generation IO is exercised
// manually (costs money + needs a Meta test ad account).

import { parseAdCopy, truncateAtWord } from '../../src/domains/AdsDomain/services/adCopyParse';

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

  it('truncates at a WORD boundary — never mid-word or on a trailing comma', () => {
    // 130 chars, ends mid-word past the 125 cap; the old .slice cut it to "…with our AQua Tech and S"
    const body =
      'Bring your device to Peanut this month. We are offering $99 repairs with our AQua Tech and Super Cyan services. Expert care, friendly';
    const r = parseAdCopy(`{"headline":"Your Laptop Deserves Better Care","primaryText":"${body}"}`, 'fb');
    expect(r.primaryText.length).toBeLessThanOrEqual(125);
    expect(r.primaryText.endsWith(' ')).toBe(false);
    expect(/[,;:\-]$/.test(r.primaryText)).toBe(false); // no dangling punctuation
    expect(r.primaryText.split(' ').pop()).not.toBe('S'); // not a dangling partial word
  });
});

describe('truncateAtWord', () => {
  it('returns the string unchanged when within the limit (minus trailing junk)', () => {
    expect(truncateAtWord('Fix it fast', 40)).toBe('Fix it fast');
    expect(truncateAtWord('Save 20%,', 40)).toBe('Save 20%');
  });
  it('backs off to the last whole word and strips trailing punctuation', () => {
    const r = truncateAtWord('We offer screen repair and battery replacement today', 30);
    expect(r.length).toBeLessThanOrEqual(30);
    expect(r.endsWith(' ')).toBe(false);
    expect(/[,;:\-]$/.test(r)).toBe(false);
    expect(r).toBe('We offer screen repair and'); // 26 chars, last whole word
  });
});
