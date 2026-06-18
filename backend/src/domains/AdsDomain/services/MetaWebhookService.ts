// backend/src/domains/AdsDomain/services/MetaWebhookService.ts
//
// Ads System Stage 4 — Meta Lead Ads webhook helpers. Two PURE, unit-tested
// functions: verify the X-Hub-Signature-256 HMAC (so forged posts are rejected)
// and parse leadgen events out of Meta's webhook envelope. The live Graph-API
// fetch of the full lead fields (name/phone/email by leadgen_id) is the part that
// needs a registered Meta App + page token — see MetaService (scaffold).

import crypto from 'crypto';

export interface MetaLeadEvent {
  leadgenId: string;
  formId?: string;
  adId?: string;
  campaignId?: string;  // Meta campaign id → maps to ad_campaigns.meta_campaign_id
  createdTime?: number;
}

/** Verify Meta's `X-Hub-Signature-256: sha256=<hex>` against the raw body using
 *  the app secret. Constant-time compare. Returns false on any missing input. */
export function verifyMetaSignature(
  rawBody: Buffer | string,
  signatureHeader: string | undefined,
  appSecret: string | undefined
): boolean {
  if (!signatureHeader || !appSecret) return false;
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(body).digest('hex');
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Parse + verify a Meta `signed_request` (deauthorize / data-deletion callbacks).
 *  Format: `<base64url(hmac)>.<base64url(json)>`; HMAC-SHA256 of the payload string with the
 *  app secret. Returns the decoded payload (incl. `user_id`) or null on any failure. */
export function parseSignedRequest(signedRequest: string | undefined, appSecret: string | undefined): any | null {
  if (!signedRequest || !appSecret || !signedRequest.includes('.')) return null;
  const [encodedSig, payload] = signedRequest.split('.');
  if (!encodedSig || !payload) return null;
  const b64 = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  try {
    const expected = crypto.createHmac('sha256', appSecret).update(payload).digest();
    const sig = b64(encodedSig);
    if (sig.length !== expected.length || !crypto.timingSafeEqual(sig, expected)) return null;
    return JSON.parse(b64(payload).toString('utf8'));
  } catch {
    return null;
  }
}

/** Pull leadgen events from a Meta webhook payload (object='page'). Tolerant of
 *  missing fields — only events with a leadgen_id are returned. */
export function parseLeadEvents(payload: any): MetaLeadEvent[] {
  const out: MetaLeadEvent[] = [];
  const entries = Array.isArray(payload?.entry) ? payload.entry : [];
  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      if (change?.field !== 'leadgen') continue;
      const v = change?.value ?? {};
      if (!v.leadgen_id) continue;
      out.push({
        leadgenId: String(v.leadgen_id),
        formId: v.form_id ? String(v.form_id) : undefined,
        adId: v.ad_id ? String(v.ad_id) : undefined,
        campaignId: v.campaign_id ? String(v.campaign_id) : undefined,
        createdTime: typeof v.created_time === 'number' ? v.created_time : undefined,
      });
    }
  }
  return out;
}
