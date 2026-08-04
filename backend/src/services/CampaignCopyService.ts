// backend/src/services/CampaignCopyService.ts
//
// P2 of ai-campaign-in-workflow.md — writes a campaign from a one-line brief.
//
// ONE call produces the subject, the body AND the image brief together. The alternative — write the
// copy, then call again to describe an image for it — spends twice for something the model can do in
// a single pass while it still has the campaign's intent in front of it, and risks an image that
// illustrates a different campaign than the one that was written.
//
// Mirrors AutoMessageContentService for the AI plumbing (spend cap, brand kit, date context, cheap
// model) but produces EMAIL-shaped copy: a subject line and paragraphs, not a 2–4 sentence in-app
// message. It does not persist anything — CampaignDraftService turns this into a campaign.

import { logger } from '../utils/logger';
import { AnthropicClient } from '../domains/AIAgentDomain/services/AnthropicClient';
import { SpendCapEnforcer } from '../domains/AIAgentDomain/services/SpendCapEnforcer';
import { brandKitService } from '../domains/AIAgentDomain/services/BrandKitService';
import { buildDateContextBlock } from '../domains/AIAgentDomain/services/dateContext';
import { shopRepository } from '../repositories';
import { cheapModel } from '../config/aiModels';
import { statesUnaskedOffer } from './aiCopyGuards';

const MAX_SUBJECT = 200;
const MAX_BODY = 8000;
const MAX_IMAGE_PROMPT = 1000;

const SYSTEM = `You write ONE marketing email for a repair/service shop, and a brief for its banner image.

Return ONLY valid JSON, no prose and no markdown fences:
{"subject": "...", "body": "...", "imagePrompt": "..."}

Rules:
- subject: one line, ≤120 characters, specific rather than clever. It is also used as the email's headline.
- body: 2–4 short paragraphs separated by BLANK LINES. Plain text. Warm and direct.
- Do NOT write an unsubscribe footer, a sign-off block, or a "[Click here]" placeholder — the template adds the footer and the shop adds real buttons.
- NEVER state a discount, price, percentage or offer the shop did not ask for. If tempted, describe the benefit in words instead.
- imagePrompt: describe a photographic banner image for this campaign in one sentence. No text, words or logos in the image — the template overlays branding. Describe a scene, not a poster.
- Match the shop's brand voice if given.`;

export interface CampaignCopyInput {
  /** What the shop typed. May be empty — trigger and audience alone are enough to write from. */
  brief?: string | null;
  /** The workflow's shape. Present here and absent in the chat, which has to ask for it. */
  triggerType?: 'schedule' | 'event' | null;
  eventType?: string | null;
  targetAudience?: string | null;
  /** The workflow's name, used as an intent hint. */
  name?: string | null;
}

export interface CampaignCopy {
  subject: string;
  body: string;
  imagePrompt: string;
}

/** Models wrap JSON in fences often enough that not handling it would be a self-inflicted failure. */
function parseJsonBlock(raw: string): Record<string, unknown> | null {
  const text = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export class CampaignCopyService {
  constructor(
    private readonly anthropic = new AnthropicClient(),
    private readonly spendCap = new SpendCapEnforcer(),
    private readonly brandKit = brandKitService
  ) {}

  async generate(shopId: string, input: CampaignCopyInput): Promise<CampaignCopy> {
    const spend = await this.spendCap.canSpend(shopId);
    if (!spend.allowed) {
      throw Object.assign(
        new Error('AI budget reached for this month — try again next cycle or upgrade.'),
        { status: 429 }
      );
    }

    const [shop, kit] = await Promise.all([
      shopRepository.getShop(shopId).catch(() => null),
      this.brandKit.getBrandKit(shopId).catch(() => null),
    ]);
    const shopName = (shop as { name?: string } | null)?.name || 'our shop';
    const voice = kit?.brandVoice || kit?.toneNotes || 'friendly and professional';
    const industry = kit?.industryStyle ? ` The shop is in: ${kit.industryStyle}.` : '';

    const userMessage =
      `Shop: ${shopName}. Brand voice: ${voice}.${industry}\n` +
      `Write the campaign for this automation:\n` +
      `- Sends: ${this.describeTrigger(input)}\n` +
      `- Audience: ${this.describeAudience(input.targetAudience)}\n` +
      (input.name ? `- Workflow name (intent hint): ${input.name}\n` : '') +
      (input.brief ? `- What the shop wants it to say: ${input.brief}\n` : '') +
      `\nReturn only the JSON object.`;

    let resp;
    try {
      resp = await this.anthropic.complete({
        systemPrompt: [
          { text: SYSTEM, cache: true },
          { text: buildDateContextBlock(), cache: false }, // keeps copy in-season; never cached
        ],
        messages: [{ role: 'user', content: userMessage }],
        model: cheapModel(),
        maxTokens: 1200,
      });
    } catch (err: unknown) {
      logger.error('CampaignCopyService.generate failed', {
        shopId,
        error: (err as Error)?.message,
      });
      throw Object.assign(new Error('Could not write the campaign right now — please try again.'), {
        status: 502,
      });
    }

    // Best-effort, and after the call either way — the spend happened whether or not we can parse it.
    await this.spendCap.recordSpend(shopId, resp.costUsd).catch(() => undefined);

    const parsed = parseJsonBlock(resp.text || '');
    const subject = String(parsed?.subject ?? '').trim().slice(0, MAX_SUBJECT);
    const body = String(parsed?.body ?? '').trim().slice(0, MAX_BODY);
    const imagePrompt = String(parsed?.imagePrompt ?? '').trim().slice(0, MAX_IMAGE_PROMPT);

    if (!subject || !body) {
      logger.error('CampaignCopyService got no usable copy back', {
        shopId,
        raw: (resp.text || '').slice(0, 300),
      });
      throw Object.assign(new Error('The AI did not return a usable campaign — please try again.'), {
        status: 502,
      });
    }

    // Same rule as an automated in-app message, and the exposure is larger: this goes by email to a
    // whole audience. Refusing costs a regeneration; sending a discount nobody approved costs more.
    const offer = statesUnaskedOffer(`${subject}\n${body}`, input.brief ?? undefined);
    if (offer) {
      logger.warn('CampaignCopyService rejected its own copy', { shopId, reason: offer });
      throw Object.assign(
        new Error(`The AI wrote something that ${offer}. Try again, or say what offer you want.`),
        { status: 422 }
      );
    }

    return { subject, body, imagePrompt };
  }

  private describeTrigger(i: CampaignCopyInput): string {
    if (i.triggerType === 'event') {
      const map: Record<string, string> = {
        booking_completed: 'after a customer completes a booking',
        booking_cancelled: 'after a customer cancels a booking',
        first_visit: 'after a first visit',
        inactive_30_days: 'to customers who have not been back in about a month (a win-back)',
        low_bookings: 'when the shop is having a slow week (fill the schedule)',
        no_show: 'after a customer misses an appointment',
        review_received: 'after a customer leaves a review',
        low_rating: 'after an unhappy review (1–2 stars)',
        payment_failed: 'after a payment fails',
      };
      return map[i.eventType || ''] || `on event: ${i.eventType || 'unspecified'}`;
    }
    return 'on a recurring schedule — keep it fresh, not spammy';
  }

  private describeAudience(a?: string | null): string {
    const map: Record<string, string> = {
      all: 'all customers',
      active: 'recently active customers',
      inactive_30d: 'customers inactive about 30 days',
      has_balance: 'customers holding an RCN balance',
      completed_booking: 'customers who completed a booking',
    };
    return map[a || 'all'] || 'all customers';
  }
}

export const campaignCopyService = new CampaignCopyService();
