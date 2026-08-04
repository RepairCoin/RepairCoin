// backend/src/services/AiCampaignService.ts
//
// P3 of ai-campaign-in-workflow.md — a brief in, a draft campaign out.
//
// Three steps, each already owned by something else: write the copy and the image brief
// (CampaignCopyService, one call), render the banner (ImageGenerationService, which carries every
// gate), persist it in the shape the email renderer expects (CampaignDraftService). This only
// sequences them and decides what to do when the middle one is refused.
//
// It NEVER sends. A campaign made here is a draft, and the workflow that uses it only ever sends
// copies of it — so nothing reaches a customer until the shop previews it and publishes the workflow.

import { logger } from '../utils/logger';
import { campaignCopyService, type CampaignCopyInput } from './CampaignCopyService';
import { campaignDraftService } from './CampaignDraftService';
import { ImageGenerationService } from '../domains/AIAgentDomain/services/ImageGenerationService';
import type { MarketingCampaign } from '../repositories/MarketingCampaignRepository';

export interface AiCampaignInput extends CampaignCopyInput {
  /** Internal name for the shop's campaign list. Defaults from the workflow's name. */
  name?: string | null;
}

export interface AiCampaignResult {
  campaign: MarketingCampaign;
  /** Set when the campaign was created WITHOUT a banner, and why. Shown to the shop, not swallowed. */
  imageSkipped?: string;
}

/**
 * The audience an AI-made campaign starts with.
 *
 * Deliberately NOT derived from the workflow's Target Audience, because a campaign action does not
 * have one — the campaign resolves its own audience, which is why that field is hidden for it. And
 * the two vocabularies do not line up: the workflow thinks in `inactive_30d` / `has_balance`, the
 * campaign in `top_spenders` / `frequent_visitors` / `imported_winback`. Inventing a mapping between
 * them would be guessing at who the shop meant.
 *
 * So it starts at everyone and the shop narrows it in the designer, which is one click away and open
 * for exactly this kind of correction.
 */
const DEFAULT_AUDIENCE = 'all_customers';

export class AiCampaignService {
  constructor(
    private readonly copy = campaignCopyService,
    private readonly drafts = campaignDraftService,
    private readonly images = new ImageGenerationService()
  ) {}

  async createDraft(shopId: string, input: AiCampaignInput): Promise<AiCampaignResult> {
    // Throws on budget exhausted (429) or unusable output (502/422) — the caller relays it. There is
    // nothing to salvage without copy, so this is the one step with no degraded path.
    const copy = await this.copy.generate(shopId, input);

    // Image refusal is ORDINARY, not exceptional: the ai_images_enabled kill-switch is off for some
    // shops, the spend cap is monthly, and a prompt can be flagged. The service reports that as
    // `ok: false` with a reason rather than throwing, which is what makes degrading possible.
    // Losing the copy we already paid for because the picture was declined would be the wrong trade.
    let imageUrl: string | null = null;
    let imageSkipped: string | undefined;

    if (copy.imagePrompt) {
      try {
        const outcome = await this.images.generate(shopId, {
          prompt: copy.imagePrompt,
          useCase: 'campaign_banner',
        });
        if (outcome.ok && outcome.imageUrl) {
          imageUrl = outcome.imageUrl;
        } else {
          imageSkipped = outcome.error || 'The banner image could not be generated.';
        }
      } catch (err) {
        // A thrown error here is infrastructure, not policy — still not a reason to lose the copy.
        imageSkipped = 'The banner image could not be generated.';
        logger.error('AiCampaignService: image generation threw', {
          shopId,
          error: (err as Error)?.message,
        });
      }
    } else {
      imageSkipped = 'No image brief was written for this campaign.';
    }

    const campaign = await this.drafts.createFromCopy({
      shopId,
      name: (input.name || copy.subject).slice(0, 120),
      subject: copy.subject,
      body: copy.body,
      imageUrl,
      audienceType: DEFAULT_AUDIENCE,
      createdBySource: 'ai_agent',
    });

    logger.info('AiCampaignService created a draft campaign', {
      shopId,
      campaignId: campaign.id,
      withImage: !!imageUrl,
      imageSkipped,
    });

    return { campaign, imageSkipped };
  }
}

export const aiCampaignService = new AiCampaignService();
