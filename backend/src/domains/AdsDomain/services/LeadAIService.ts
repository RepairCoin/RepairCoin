// backend/src/domains/AdsDomain/services/LeadAIService.ts
//
// Ads System Stage 3 (Option C) — AI-DRAFTED lead outreach. Given a captured ad
// lead, drafts the FIRST outreach message the shop/admin can send. Self-contained:
// it does NOT touch the wallet-keyed conversations system (ad leads have no wallet)
// — it just returns suggested copy. Spend-capped per shop (lazily provisions a
// default budget). Uses Haiku (cheap; a short draft). See docs/.../ads-system/.

import { logger } from '../../../utils/logger';
import { AnthropicClient } from '../../AIAgentDomain/services/AnthropicClient';
import { SpendCapEnforcer } from '../../AIAgentDomain/services/SpendCapEnforcer';
import { BrandKitService } from '../../AIAgentDomain/services/BrandKitService';
import { shopRepository } from '../../../repositories';
import { LeadRepository } from '../repositories/LeadRepository';
import { CampaignRepository } from '../repositories/CampaignRepository';
import { ClaudeModel } from '../../AIAgentDomain/types';

const DRAFT_MODEL: ClaudeModel = 'claude-haiku-4-5-20251001';

const SYSTEM_PROMPT =
  'You help a local service business write the FIRST outreach message to a new ' +
  'lead who responded to one of its ads. Write a short, warm, professional ' +
  'opening (2-3 sentences) that: greets the lead by name if known; acknowledges ' +
  'they showed interest (no hard-sell, no pressure); and invites them to reply ' +
  'with what they need or to book. Rules: plain text only, NO markdown, NO ' +
  'placeholders or brackets, ready to send exactly as written. Match the brand ' +
  "voice if one is given. Output ONLY the message text.";

export interface DraftResult {
  draft: string;
  costUsd: number;
}

export class LeadAIService {
  constructor(
    private readonly anthropic = new AnthropicClient(),
    private readonly spendCap = new SpendCapEnforcer(),
    private readonly brandKit = new BrandKitService(),
    private readonly leads = new LeadRepository(),
    private readonly campaigns = new CampaignRepository()
  ) {}

  /** Draft an outreach message for a lead. Throws { status } on a gate. */
  async draftOutreach(leadId: string): Promise<DraftResult> {
    const lead = await this.leads.findById(leadId);
    if (!lead) throw Object.assign(new Error('Lead not found'), { status: 404 });

    const campaign = await this.campaigns.findById(lead.campaignId);
    const shopId = campaign?.shopId;
    if (!shopId) throw Object.assign(new Error('Lead campaign/shop not found'), { status: 404 });

    const spend = await this.spendCap.canSpend(shopId);
    if (!spend.allowed) {
      throw Object.assign(new Error('Monthly AI budget exhausted. Try again next month.'), { status: 429 });
    }

    const [shop, kit] = await Promise.all([
      shopRepository.getShop(shopId).catch(() => null),
      this.brandKit.getBrandKit(shopId).catch(() => null),
    ]);
    const shopName = (shop as any)?.name || 'the shop';
    const voice = kit?.brandVoice || kit?.toneNotes || 'friendly and professional';
    const industry = kit?.industryStyle || 'local service business';

    const userMsg =
      `Business: ${shopName} (${industry}).\n` +
      `Campaign: ${campaign?.name || 'an ad'}.\n` +
      `Lead name: ${lead.name || 'unknown'}.\n` +
      `Brand voice: ${voice}.\n` +
      `Write the outreach message.`;

    try {
      const resp = await this.anthropic.complete({
        systemPrompt: [{ text: SYSTEM_PROMPT, cache: true }],
        messages: [{ role: 'user', content: userMsg }],
        model: DRAFT_MODEL,
        maxTokens: 300,
      });
      await this.spendCap.recordSpend(shopId, resp.costUsd);
      return { draft: resp.text.trim(), costUsd: resp.costUsd };
    } catch (err) {
      logger.error('LeadAIService.draftOutreach failed', err);
      throw Object.assign(new Error("Couldn't draft a reply right now. Please try again."), { status: 503 });
    }
  }
}

export const leadAIService = new LeadAIService();
