// backend/src/services/CampaignDraftService.ts
//
// "Given a subject, a body and maybe an image, what does the campaign look like?"
//
// Extracted from proposeCampaignDraft (the assistant's campaign tool), which was the only place that
// knew how to turn AI copy into a persisted campaign with the designContent blocks the email renderer
// expects. The workflow builder now needs the same answer, and copying it would leave two definitions
// of what an AI-written campaign looks like — they would drift the first time a block type changes,
// and the divergence would only show up in a customer's inbox.
//
// Deliberately narrow. It does NOT decide the copy, resolve an audience, attach rewards, or send.
// Those differ by caller: the assistant negotiates them across a conversation, the workflow builder
// derives them from the rule. What is genuinely common is the shape of the campaign itself.

import { MarketingService } from './MarketingService';
import type { MarketingCampaign } from '../repositories/MarketingCampaignRepository';

export interface CampaignDraftInput {
  shopId: string;
  /** Internal name — what the shop sees in its campaign list, not what the customer reads. */
  name: string;
  subject: string;
  body: string;
  /** Banner across the top. Absent when image generation was refused or not requested. */
  imageUrl?: string | null;
  audienceType: string;
  audienceFilters?: Record<string, unknown>;
  deliveryMethod?: 'email' | 'in_app' | 'both';
  createdBySource?: 'manual' | 'ai_agent';
}

/**
 * Paragraphs split on blank lines, headline from the subject.
 *
 * Mirrors what the shop is told the campaign says: the headline is the subject line, so the preview
 * and the email agree with the copy that was reviewed.
 */
export function bodyToBlocks(subject: string, body: string): Array<Record<string, unknown>> {
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const blocks: Array<Record<string, unknown>> = [
    {
      type: 'headline',
      content: subject,
      style: { fontSize: '24px', fontWeight: 'bold', textAlign: 'center' },
    },
  ];
  for (const para of paragraphs) {
    blocks.push({
      type: 'text',
      content: para,
      style: { fontSize: '14px', textAlign: 'left', color: '#444' },
    });
  }
  return blocks;
}

export function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n - 1).trimEnd()}…`;
}

/** The designContent shape the email renderer expects, including the banner when there is one. */
export function buildDesignContent(
  subject: string,
  body: string,
  imageUrl?: string | null,
  audienceType?: string
): Record<string, unknown> {
  const blocks = bodyToBlocks(subject, body);

  if (imageUrl) {
    // Above the headline — MarketingService.renderBlock draws an 'image' block as the banner.
    blocks.unshift({ type: 'image', src: imageUrl, style: { maxWidth: '100%' } });
  }

  // Imported win-back needs a REAL button. A model only writes text, so "[Claim Your Account]" in the
  // body is dead literal text; without an actual button the recipient has no way to act on it.
  if (audienceType === 'imported_winback') {
    blocks.push({
      type: 'button',
      content: 'Claim Your Account',
      url: '/customer',
      style: { backgroundColor: '#eab308', textColor: '#000' },
    });
  }

  return {
    header: { enabled: true, showLogo: true, backgroundColor: '#1a1a2e' },
    blocks,
    // Compliance link — the sender renders an unsubscribe from this.
    footer: { showSocial: false, showUnsubscribe: true },
  };
}

export class CampaignDraftService {
  constructor(private readonly marketing: MarketingService = new MarketingService()) {}

  /** Persist a DRAFT campaign built from copy. Never sends — sending is always a separate decision. */
  async createFromCopy(input: CampaignDraftInput): Promise<MarketingCampaign> {
    return this.marketing.createCampaign({
      shopId: input.shopId,
      name: input.name,
      campaignType: 'custom',
      subject: input.subject,
      previewText: truncate(input.body.replace(/\s+/g, ' '), 150),
      designContent: buildDesignContent(
        input.subject,
        input.body,
        input.imageUrl,
        input.audienceType
      ),
      audienceType: input.audienceType as never,
      audienceFilters: input.audienceFilters ?? {},
      deliveryMethod: input.deliveryMethod ?? 'email',
      createdBySource: input.createdBySource ?? 'ai_agent',
    } as never);
  }
}

export const campaignDraftService = new CampaignDraftService();
