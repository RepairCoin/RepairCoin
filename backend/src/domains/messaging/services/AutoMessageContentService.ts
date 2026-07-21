// backend/src/domains/messaging/services/AutoMessageContentService.ts
//
// AI Campaigns (Advanced) Phase 2 — AI-drafts the message body for a shop Auto-Message rule.
// Today shops hand-write a static {{variable}} template; this lets the AI write it from the rule's context
// (trigger/audience/goal) + the shop's brand voice. A short one-shot generation, mirroring AdCreativeService
// for the AI call and MarketingChatController for the shared-allowance spend wiring.
//
// Business-tier: the endpoint is gated by requireTierRollout('aiCampaignsAdvanced') at the route.
// Spend-capped against the shop's monthly AI allowance (recordSpend feeds the overage meter).

import { logger } from '../../../utils/logger';
import { AnthropicClient } from '../../AIAgentDomain/services/AnthropicClient';
import { SpendCapEnforcer } from '../../AIAgentDomain/services/SpendCapEnforcer';
import { brandKitService } from '../../AIAgentDomain/services/BrandKitService';
import { buildDateContextBlock } from '../../AIAgentDomain/services/dateContext';
import { shopRepository } from '../../../repositories';
import { cheapModel } from '../../../config/aiModels';

// The ONLY placeholders the scheduler substitutes at send time (AutoMessageSchedulerService.resolveTemplate).
// The model is told it MAY use these — anything else stays literal, so we don't invent unsupported tokens.
const SUPPORTED_VARS = '{{customerName}}, {{shopName}}, {{rcnBalance}}, {{lastServiceName}}, {{lastVisitDate}}';

const MAX_LEN = 2000; // matches the messageTemplate DB/UI cap

const SYSTEM = `You write ONE short automated message a repair/service shop sends to its customers. Output ONLY the message text — no preamble, no quotes, no markdown, no subject line, no sign-off block.

Rules:
- Warm, professional, concise (2–4 short sentences). It's an SMS/in-app style message, not an email.
- You MAY use these placeholders where natural, and ONLY these: ${SUPPORTED_VARS}. They're substituted per customer at send time. Do NOT invent other {{tokens}} or leave literal brackets like [name].
- Match the shop's brand voice if given.
- NEVER promise a discount, offer, price, or policy the shop didn't state. No emojis unless it fits a casual brand voice.
- Plain text only. No markdown, no bullet lists, no tables.`;

export interface GenerateAutoMessageInput {
  triggerType: 'schedule' | 'event';
  scheduleType?: string | null;
  eventType?: string | null;
  targetAudience?: string | null;
  name?: string | null;
  /** Optional free-text goal from the shop ("win back lapsed customers with a friendly nudge"). */
  prompt?: string | null;
}

export class AutoMessageContentService {
  constructor(
    private readonly anthropic = new AnthropicClient(),
    private readonly spendCap = new SpendCapEnforcer(),
    private readonly brandKit = brandKitService
  ) {}

  /** Returns { messageTemplate } — AI-drafted body for the rule. Throws { status } on a hard failure. */
  async generate(shopId: string, input: GenerateAutoMessageInput): Promise<{ messageTemplate: string }> {
    const spend = await this.spendCap.canSpend(shopId);
    if (!spend.allowed) {
      throw Object.assign(new Error('AI budget reached for this month — try again next cycle or upgrade.'), { status: 429 });
    }

    const [shop, kit] = await Promise.all([
      shopRepository.getShop(shopId).catch(() => null),
      this.brandKit.getBrandKit(shopId).catch(() => null),
    ]);
    const shopName = (shop as any)?.name || 'our shop';
    const voice = kit?.brandVoice || kit?.toneNotes || 'friendly and professional';
    const industry = kit?.industryStyle ? ` The shop is in: ${kit.industryStyle}.` : '';

    const userMessage =
      `Shop: ${shopName}. Brand voice: ${voice}.${industry}\n` +
      `Write the automated message for this rule:\n` +
      `- Trigger: ${this.describeTrigger(input)}\n` +
      `- Audience: ${this.describeAudience(input.targetAudience)}\n` +
      (input.name ? `- Rule name (intent hint): ${input.name}\n` : '') +
      (input.prompt ? `- What the shop wants it to say: ${input.prompt}\n` : '') +
      `\nReturn only the message text.`;

    try {
      const resp = await this.anthropic.complete({
        systemPrompt: [
          { text: SYSTEM, cache: true },
          { text: buildDateContextBlock(), cache: false }, // keep copy in-season; non-cached per house rule
        ],
        messages: [{ role: 'user', content: userMessage }],
        model: cheapModel(), // short one-shot — the cheap tier is plenty
        maxTokens: 400,
      });

      // Best-effort spend accounting (feeds the monthly allowance + overage meter).
      await this.spendCap.recordSpend(shopId, resp.costUsd).catch(() => undefined);

      const text = (resp.text || '').trim().slice(0, MAX_LEN);
      if (!text) {
        throw Object.assign(new Error('AI returned an empty message — please try again.'), { status: 502 });
      }
      return { messageTemplate: text };
    } catch (err: any) {
      if (err?.status) throw err;
      logger.error('AutoMessageContentService.generate failed', { shopId, error: err?.message });
      throw Object.assign(new Error('Could not generate a message right now — please try again.'), { status: 502 });
    }
  }

  private describeTrigger(i: GenerateAutoMessageInput): string {
    if (i.triggerType === 'event') {
      const map: Record<string, string> = {
        booking_completed: 'after a customer completes a booking (thank-you / review ask / rebook nudge)',
        booking_cancelled: 'after a customer cancels a booking (gentle win-back / offer to rebook)',
        first_visit: 'after a customer’s first visit (welcome them, set expectations)',
        inactive_30_days: 'when a customer has been inactive ~30 days (friendly win-back)',
      };
      return map[i.eventType || ''] || `on event: ${i.eventType || 'unspecified'}`;
    }
    return `on a ${i.scheduleType || 'recurring'} schedule (a periodic touch — keep it fresh, not spammy)`;
  }

  private describeAudience(a?: string | null): string {
    const map: Record<string, string> = {
      all: 'all customers',
      active: 'recently active customers',
      inactive_30d: 'customers inactive ~30 days',
      has_balance: 'customers who hold RCN balance',
      completed_booking: 'customers who completed a booking',
    };
    return map[a || 'all'] || 'all customers';
  }
}

export const autoMessageContentService = new AutoMessageContentService();
