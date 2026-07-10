// backend/src/domains/AdsDomain/services/inboundEmailConfig.ts
//
// Inbound email (lead replies → app) — shared config + per-lead reply addressing. When enabled,
// AI-agent campaigns send with reply-to = `${reply_token}@${replyDomain}` (a receiving domain WE
// control) so the customer's reply hits our inbound webhook instead of the shop's inbox. All gated
// behind ADS_INBOUND_EMAIL_ENABLED (default off) — until on, sends keep reply-to = the shop inbox.
// See docs/tasks/strategy/ads-system/ads-inbound-email-scope.md.

const DEFAULT_REPLY_DOMAIN = 'reply.fixflow.ai';

export function isInboundEmailEnabled(): boolean {
  return process.env.ADS_INBOUND_EMAIL_ENABLED === 'true';
}

/** The receiving (sub)domain configured for Resend inbound. */
export function replyDomain(): string {
  return (process.env.RESEND_REPLY_DOMAIN || DEFAULT_REPLY_DOMAIN).toLowerCase();
}

/** Per-lead reply-to address: `<token>@reply.fixflow.ai`. */
export function replyAddressFor(token: string): string {
  return `${token}@${replyDomain()}`;
}

/**
 * PURE — extract the reply token from a recipient address. Handles `Name <addr>` form and a `+suffix`.
 * Returns null when the address isn't on our receiving domain (so foreign mail is ignored). Testable.
 */
export function tokenFromAddress(addr: string | null | undefined): string | null {
  if (!addr) return null;
  const angle = addr.match(/<([^>]+)>/); // "Shop <abc@reply.fixflow.ai>" → abc@reply.fixflow.ai
  const email = (angle ? angle[1] : addr).trim().toLowerCase();
  const at = email.indexOf('@');
  if (at <= 0) return null;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (domain !== replyDomain()) return null;
  const token = local.split('+')[0];
  return token || null;
}
