// backend/src/domains/AdsDomain/services/InboundEmailService.ts
//
// Inbound email (lead replies → app). Resolves a Resend inbound email back to its lead via the
// per-lead reply token in the to-address, cleans the reply (strips quoted history/signature), and
// hands it to LeadAutoAnswerService (which auto-answers when the campaign's AI agent is on). Mandatory
// loop/abuse safety: ignore auto-replies/bounces, dedupe on Message-ID, rate-limit auto-answers per
// lead, and never auto-answer the shop's own mail. Gated by ADS_INBOUND_EMAIL_ENABLED.
//
// ⚠️ The Resend inbound payload field paths are parsed defensively — VERIFY against a real Resend
// inbound delivery before relying on this (the scope's P0 verify task).
// See docs/tasks/strategy/ads-system/ads-inbound-email-scope.md.

import axios from 'axios';
import { logger } from '../../../utils/logger';
import { shopRepository } from '../../../repositories';
import { NotificationRepository } from '../../../repositories/NotificationRepository';
import { LeadRepository } from '../repositories/LeadRepository';
import { CampaignRepository } from '../repositories/CampaignRepository';
import { LeadMessageRepository } from '../repositories/LeadMessageRepository';
import { leadAutoAnswerService } from './LeadAutoAnswerService';
import { tokenFromAddress } from './inboundEmailConfig';

const MAX_AUTOANSWERS_PER_HOUR = (() => {
  const n = parseInt(process.env.ADS_INBOUND_MAX_AUTOANSWERS_PER_HOUR || '5', 10);
  return Number.isFinite(n) && n > 0 ? n : 5;
})();

export type InboundOutcome =
  | 'handled' | 'recorded' | 'ignored_no_token' | 'ignored_unknown_token'
  | 'ignored_auto_mail' | 'ignored_duplicate' | 'ignored_empty';

// --- PURE helpers (defensive parsing of the inbound payload) ---

/** Lowercased header map from either an object map or an array of {name,value}. */
export function normalizeHeaders(payload: any): Record<string, string> {
  const raw = payload?.data?.headers ?? payload?.headers ?? {};
  const out: Record<string, string> = {};
  if (Array.isArray(raw)) {
    for (const h of raw) if (h?.name) out[String(h.name).toLowerCase()] = String(h.value ?? '');
  } else if (raw && typeof raw === 'object') {
    for (const k of Object.keys(raw)) out[k.toLowerCase()] = String((raw as any)[k] ?? '');
  }
  return out;
}

/** All recipient addresses (to + cc), as strings — handles string | string[] | {address}. */
export function recipientsOf(payload: any): string[] {
  const d = payload?.data ?? payload ?? {};
  const collect = (v: any): string[] => {
    if (!v) return [];
    if (Array.isArray(v)) return v.flatMap(collect);
    if (typeof v === 'object') return v.address ? [String(v.address)] : [];
    return String(v).split(',').map((s) => s.trim());
  };
  return [...collect(d.to), ...collect(d.cc)].filter(Boolean);
}

export function senderEmail(payload: any): string | null {
  const f = payload?.data?.from ?? payload?.from;
  if (!f) return null;
  const s = typeof f === 'object' ? (f.address ?? '') : String(f);
  const m = s.match(/<([^>]+)>/);
  return (m ? m[1] : s).trim().toLowerCase() || null;
}

/** Machine-generated mail (auto-reply / OOO / bulk / bounce) — never auto-answer these. */
export function isMachineMail(headers: Record<string, string>): boolean {
  const autoSub = (headers['auto-submitted'] || '').toLowerCase();
  if (autoSub && autoSub !== 'no') return true;
  const prec = (headers['precedence'] || '').toLowerCase();
  if (['bulk', 'auto_reply', 'list', 'junk'].includes(prec)) return true;
  if (headers['x-autoreply'] || headers['x-autorespond']) return true;
  if ((headers['return-path'] || '').trim() === '<>') return true; // bounce
  return false;
}

/** Strip quoted history + signature, returning just the new reply text (heuristic). */
export function stripQuotedReply(text: string): string {
  const lines = (text || '').replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  for (const line of lines) {
    if (/^\s*On .+wrote:\s*$/.test(line)) break;            // "On <date>, X wrote:"
    if (/^\s*-{3,}\s*Original Message\s*-{3,}/i.test(line)) break;
    if (/^\s*_{5,}\s*$/.test(line)) break;                  // Outlook divider
    if (/^--\s*$/.test(line)) break;                        // signature delimiter
    if (out.length > 0 && /^\s*From:\s.+/.test(line)) break; // quoted/forwarded header block
    if (/^\s*>/.test(line)) continue;                       // drop quoted lines
    out.push(line);
  }
  return out.join('\n').trim();
}

function htmlToText(html: string | null | undefined): string {
  return (html || '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>(?=)/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

export class InboundEmailService {
  constructor(
    private readonly leads = new LeadRepository(),
    private readonly campaigns = new CampaignRepository(),
    private readonly messages = new LeadMessageRepository(),
    private readonly notifications = new NotificationRepository(),
    private readonly autoAnswer = leadAutoAnswerService
  ) {}

  /** Process one inbound email payload. Non-throwing; returns the outcome for logging. */
  async handle(payload: any): Promise<{ outcome: InboundOutcome; leadId?: string }> {
    // 1. Resolve the lead from the reply-token in any recipient address.
    const token = recipientsOf(payload).map(tokenFromAddress).find(Boolean) || null;
    if (!token) return { outcome: 'ignored_no_token' };
    const lead = await this.leads.findByReplyToken(token);
    if (!lead) return { outcome: 'ignored_unknown_token' };

    // 1b. Resend's `email.received` webhook is metadata-only (no body/headers/attachments — keeps the
    //     serverless payload small). Fetch the text/html/headers by email_id before parsing.
    await this.hydrateContent(payload);

    // 2. Safety: drop machine mail (auto-replies / OOO / bounces).
    const headers = normalizeHeaders(payload);
    if (isMachineMail(headers)) return { outcome: 'ignored_auto_mail', leadId: lead.id };

    // 3. Dedupe on Resend's stable received-email id (falls back to Message-ID) for re-delivered webhooks.
    const externalId = payload?.data?.email_id || headers['message-id'] || payload?.data?.message_id || null;
    if (externalId && (await this.messages.existsByExternalId(lead.id, externalId))) {
      return { outcome: 'ignored_duplicate', leadId: lead.id };
    }

    // 4. Clean the reply body.
    const raw = (payload?.data?.text ?? payload?.text ?? '') || htmlToText(payload?.data?.html ?? payload?.html);
    const clean = stripQuotedReply(String(raw));
    if (!clean) return { outcome: 'ignored_empty', leadId: lead.id };

    // 5. Decide auto-answer vs record-only: never auto-answer the shop's own mail, and rate-limit loops.
    const campaign = await this.campaigns.findById(lead.campaignId).catch(() => null);
    const shop = campaign?.shopId ? await shopRepository.getShop(campaign.shopId).catch(() => null) : null;
    const shopEmail = ((shop as any)?.email || '').toLowerCase();
    const from = senderEmail(payload);
    const fromShop = !!shopEmail && from === shopEmail;
    const recentAi = await this.messages.countByAuthorSince(lead.id, 'ai', 60);
    const overLimit = recentAi >= MAX_AUTOANSWERS_PER_HOUR;

    if (fromShop || overLimit) {
      await this.autoAnswer.recordInbound(lead.id, clean, 'email', externalId);
      logger.info(`InboundEmail: recorded without auto-answer (${fromShop ? 'from_shop' : 'rate_limited'})`, { leadId: lead.id });
      return { outcome: 'recorded', leadId: lead.id };
    }

    await this.autoAnswer.handleInbound(lead.id, clean, 'email', externalId);
    if (campaign?.shopId) void this.notifyShop(campaign.shopId, lead.name, lead.id).catch(() => undefined);
    return { outcome: 'handled', leadId: lead.id };
  }

  /** Fetch the inbound email's body + headers from Resend's Received-emails API and merge them into
   *  payload.data. The `email.received` webhook only carries metadata, so without this the body is empty.
   *  Non-throwing: on any failure the caller falls through to `ignored_empty` (better than crashing). */
  private async hydrateContent(payload: any): Promise<void> {
    const d = payload?.data;
    if (!d?.email_id) return;
    const hasBody = (d.text && String(d.text).trim()) || (d.html && String(d.html).trim());
    if (hasBody) return; // already inline (defensive — tests / future payloads may include it)
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) { logger.warn('InboundEmail: RESEND_API_KEY not set — cannot fetch inbound email body'); return; }
    try {
      const res = await axios.get(`https://api.resend.com/emails/receiving/${encodeURIComponent(d.email_id)}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 15000,
      });
      const c = res.data || {};
      if (c.text != null) d.text = c.text;
      if (c.html != null) d.html = c.html;
      if (c.headers && !d.headers) d.headers = c.headers;
    } catch (err: any) {
      logger.error('InboundEmail: failed to fetch received email content', { emailId: d.email_id, error: err?.response?.data || err?.message });
    }
  }

  private async notifyShop(shopId: string, leadName: string | null, leadId: string): Promise<void> {
    const shop = await shopRepository.getShop(shopId).catch(() => null);
    const receiver = (shop as any)?.walletAddress || (shop as any)?.wallet_address;
    if (!receiver) return;
    await this.notifications.create({
      senderAddress: 'system',
      receiverAddress: receiver,
      notificationType: 'ad_lead_reply',
      message: `New email reply from ${leadName || 'a lead'}.`,
      metadata: { shopId, leadId },
    });
  }
}

export const inboundEmailService = new InboundEmailService();
