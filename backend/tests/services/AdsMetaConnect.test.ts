// Pure-logic tests for the Connect-Meta flow (Phase 1): signed OAuth state + token crypto.
// The Graph calls + controller IO are verified manually against a dev Meta App (no creds in CI).

import crypto from 'crypto';
import { encryptToken, decryptToken, tokenCryptoConfigured } from '../../src/utils/tokenCrypto';
import { signState, verifyState } from '../../src/domains/AdsDomain/services/metaOAuthState';
import { parseSignedRequest } from '../../src/domains/AdsDomain/services/MetaWebhookService';

// Build a Meta-style signed_request: base64url(hmac).base64url(json)
function makeSignedRequest(payloadObj: any, appSecret: string): string {
  const b64url = (b: Buffer) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const payload = b64url(Buffer.from(JSON.stringify(payloadObj)));
  const sig = b64url(crypto.createHmac('sha256', appSecret).update(payload).digest());
  return `${sig}.${payload}`;
}

beforeAll(() => {
  process.env.META_TOKEN_ENCRYPTION_KEY = 'unit-test-meta-encryption-key-1234567890';
  process.env.META_OAUTH_STATE_SECRET = 'unit-test-oauth-state-secret-abcdefghij';
});

describe('tokenCrypto', () => {
  it('round-trips a token (encrypt → decrypt)', () => {
    const secret = 'EAAGm0PX4ZCpsBO_long_lived_token_value';
    const cipher = encryptToken(secret);
    expect(cipher).not.toEqual(secret);
    expect(decryptToken(cipher)).toEqual(secret);
  });

  it('produces different ciphertext each call (random IV/salt) but decrypts the same', () => {
    const a = encryptToken('same-token');
    const b = encryptToken('same-token');
    expect(a).not.toEqual(b);
    expect(decryptToken(a)).toEqual('same-token');
    expect(decryptToken(b)).toEqual('same-token');
  });

  it('reports configured when the key is present', () => {
    expect(tokenCryptoConfigured()).toBe(true);
  });

  it('throws on garbage ciphertext', () => {
    expect(() => decryptToken('not-real-ciphertext')).toThrow();
  });
});

describe('metaOAuthState', () => {
  it('signs and verifies, recovering the shopId', () => {
    const state = signState('peanut');
    const payload = verifyState(state);
    expect(payload?.shopId).toBe('peanut');
  });

  it('rejects a tampered state', () => {
    const state = signState('peanut');
    const tampered = state.slice(0, -2) + (state.endsWith('aa') ? 'bb' : 'aa');
    expect(verifyState(tampered)).toBeNull();
  });

  it('rejects a forged body with a bad signature', () => {
    const forged = Buffer.from(JSON.stringify({ shopId: 'attacker', nonce: 'x', ts: Date.now() }))
      .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') + '.deadbeef';
    expect(verifyState(forged)).toBeNull();
  });

  it('rejects an expired state (older than the TTL)', () => {
    const old = Date.now() - 11 * 60 * 1000; // 11 min ago (TTL is 10)
    const state = signState('peanut', old);
    expect(verifyState(state)).toBeNull();
  });

  it('accepts a fresh state within the TTL', () => {
    const recent = Date.now() - 5 * 60 * 1000;
    const state = signState('peanut', recent);
    expect(verifyState(state)?.shopId).toBe('peanut');
  });

  it('returns null for undefined / malformed input', () => {
    expect(verifyState(undefined)).toBeNull();
    expect(verifyState('no-dot-here')).toBeNull();
  });

  it('produces unique nonces per call', () => {
    const p1 = verifyState(signState('peanut'));
    const p2 = verifyState(signState('peanut'));
    expect(p1?.nonce).not.toEqual(p2?.nonce);
  });
});

describe('parseSignedRequest (deauthorize / data-deletion)', () => {
  const SECRET = 'app-secret-xyz';

  it('parses + verifies a valid signed_request and returns the user_id', () => {
    const sr = makeSignedRequest({ user_id: '123456', algorithm: 'HMAC-SHA256' }, SECRET);
    expect(parseSignedRequest(sr, SECRET)?.user_id).toBe('123456');
  });

  it('rejects a signed_request signed with the wrong secret', () => {
    const sr = makeSignedRequest({ user_id: '123456' }, 'wrong-secret');
    expect(parseSignedRequest(sr, SECRET)).toBeNull();
  });

  it('returns null for missing input or missing secret', () => {
    expect(parseSignedRequest(undefined, SECRET)).toBeNull();
    expect(parseSignedRequest(makeSignedRequest({ user_id: '1' }, SECRET), undefined)).toBeNull();
    expect(parseSignedRequest('no-dot', SECRET)).toBeNull();
  });
});
