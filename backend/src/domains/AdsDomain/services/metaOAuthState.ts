// backend/src/domains/AdsDomain/services/metaOAuthState.ts
//
// Signed, single-use, short-TTL `state` for the Meta OAuth handshake (CSRF + binds the
// callback to the requesting shop). HMAC-SHA256 over {shopId, nonce, ts}; verified on the
// callback. Keyed off META_OAUTH_STATE_SECRET (fallback JWT_SECRET). PURE + unit-tested.

import crypto from 'crypto';
import { logger } from '../../../utils/logger';

const TTL_MS = 10 * 60 * 1000; // 10 minutes

function secret(): string {
  return process.env.META_OAUTH_STATE_SECRET || process.env.JWT_SECRET || '';
}

function b64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export interface StatePayload { shopId: string; nonce: string; ts: number; }

/** Build a signed state string: base64url(payload).hex(hmac). */
export function signState(shopId: string, now = Date.now()): string {
  const s = secret();
  if (!s) throw new Error('META_OAUTH_STATE_SECRET / JWT_SECRET not configured');
  const payload: StatePayload = { shopId, nonce: crypto.randomBytes(8).toString('hex'), ts: now };
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = crypto.createHmac('sha256', s).update(body).digest('hex');
  return `${body}.${sig}`;
}

export interface StateResult { payload?: StatePayload; reason?: string; }

/** Core verify — returns the payload OR a specific failure reason (for diagnostics/UI). */
export function verifyStateDetailed(state: string | undefined, now = Date.now()): StateResult {
  const s = secret();
  if (!s) return { reason: 'no_secret' };
  if (!state) return { reason: 'no_state' };
  if (!state.includes('.')) return { reason: 'malformed' };
  const [body, sig] = state.split('.');
  if (!body || !sig) return { reason: 'malformed' };
  const expected = crypto.createHmac('sha256', s).update(body).digest('hex');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { reason: 'bad_signature' };
  let payload: StatePayload;
  try {
    const json = Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    payload = JSON.parse(json) as StatePayload;
  } catch {
    return { reason: 'parse_error' };
  }
  if (!payload?.shopId || typeof payload.ts !== 'number') return { reason: 'bad_payload' };
  if (payload.ts > now + 60_000) return { reason: 'future_skew' };
  if (now - payload.ts > TTL_MS) return { reason: 'expired' };
  return { payload };
}

/** Verify a state string; returns the payload or null (tampered / expired / malformed). */
export function verifyState(state: string | undefined, now = Date.now()): StatePayload | null {
  const r = verifyStateDetailed(state, now);
  if (!r.payload) logger.warn(`metaOAuthState.verifyState failed: ${r.reason}`);
  return r.payload ?? null;
}
