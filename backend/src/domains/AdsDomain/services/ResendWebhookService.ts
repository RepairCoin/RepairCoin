// backend/src/domains/AdsDomain/services/ResendWebhookService.ts
//
// Lead follow-up — Phase 4. Verifies + parses Resend email webhooks (delivered / opened / clicked /
// bounced / complained) so the lead's email activity gets real engagement data. Resend signs
// webhooks with Svix; we verify the HMAC here with node crypto (no svix dependency).
// See docs/tasks/strategy/ads-system/ads-lead-followup-tracking-plan.md.

import crypto from 'crypto';

// Tolerance for the signed timestamp (replay protection). Svix default is 5 minutes.
const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

/**
 * Verify a Svix-signed Resend webhook. `secret` is the `whsec_...` signing secret from the Resend
 * dashboard. Returns true only when a provided signature matches and the timestamp is within
 * tolerance. Mirrors Svix's scheme: HMAC-SHA256 over `${id}.${timestamp}.${body}`, base64.
 */
export function verifyResendSignature(
  rawBody: Buffer,
  headers: { id?: string; timestamp?: string; signature?: string },
  secret: string
): boolean {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature || !secret) return false;

  // Replay protection: reject stale/future timestamps.
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > TIMESTAMP_TOLERANCE_SECONDS) return false;

  // Secret is `whsec_<base64>`; the HMAC key is the decoded bytes.
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const signedContent = `${id}.${timestamp}.${rawBody.toString('utf8')}`;
  const expected = crypto.createHmac('sha256', key).update(signedContent).digest('base64');

  // The header is a space-separated list of `v1,<sig>` entries; any match passes.
  for (const part of signature.split(' ')) {
    const sig = part.includes(',') ? part.split(',')[1] : part;
    if (!sig) continue;
    try {
      const a = Buffer.from(sig);
      const b = Buffer.from(expected);
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
    } catch {
      // length mismatch / bad base64 — treat as no match
    }
  }
  return false;
}

export interface ResendEvent {
  /** Resend message id — matches ad_lead_activities.meta.messageId. */
  messageId: string | null;
  /** Patch to shallow-merge into the activity's meta (engagement flags + timestamps). */
  patch: Record<string, any> | null;
}

/**
 * Map a Resend webhook payload to a meta patch for the email activity. Unknown/irrelevant event
 * types return a null patch (caller skips). `created_at`/event time is recorded per-event.
 */
export function parseResendEvent(payload: any): ResendEvent {
  const type: string = payload?.type || '';
  const data = payload?.data || {};
  const messageId: string | null = data?.email_id || null;
  const at: string = payload?.created_at || data?.created_at || new Date().toISOString();

  let patch: Record<string, any> | null = null;
  switch (type) {
    case 'email.delivered':
      patch = { delivered: true, deliveredAt: at };
      break;
    case 'email.opened':
      patch = { opened: true, openedAt: at };
      break;
    case 'email.clicked':
      patch = { clicked: true, clickedAt: at };
      if (data?.click?.link) patch.clickedUrl = data.click.link;
      break;
    case 'email.bounced':
      patch = { bounced: true, bouncedAt: at };
      break;
    case 'email.complained':
      patch = { complained: true, complainedAt: at };
      break;
    // email.sent / email.delivery_delayed and others: no engagement signal worth recording.
    default:
      patch = null;
  }
  return { messageId, patch };
}
