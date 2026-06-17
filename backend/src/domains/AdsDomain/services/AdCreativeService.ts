// backend/src/domains/AdsDomain/services/AdCreativeService.ts
//
// Stage-4 push Phase 2 — AUTO-CREATIVE (no manual inputs). Generates the ad's image and copy
// from the request brief + brand kit: image via the shared ImageGenerationService (gpt-image-1,
// brand-kit-grounded, spend-capped, logo-stamped, stored on DO Spaces) and copy via Anthropic
// (Haiku, spend-capped). Returns the assembled creative; the admin can swap/edit it in the
// Phase-5 review state (decision #2: AI default + shop photos as swaps). PURE copy parsing is
// split out for unit tests; the IO (LLM + image) is exercised manually.

import { logger } from '../../../utils/logger';
import { AnthropicClient } from '../../AIAgentDomain/services/AnthropicClient';
import { SpendCapEnforcer } from '../../AIAgentDomain/services/SpendCapEnforcer';
import { BrandKitService } from '../../AIAgentDomain/services/BrandKitService';
import { imageGenerationService, ImageGenerationService } from '../../AIAgentDomain/services/ImageGenerationService';
import { shopRepository } from '../../../repositories';
import { ClaudeModel } from '../../AIAgentDomain/types';
import { AdCampaignRequest } from '../repositories/CampaignRequestRepository';
import { parseAdCopy } from './adCopyParse';

export { parseAdCopy };

const COPY_MODEL: ClaudeModel = 'claude-haiku-4-5-20251001';

const COPY_SYSTEM =
  'You write short Facebook/Instagram ad copy for a local service business. ' +
  'Output ONLY JSON: {"headline": "...", "primaryText": "..."}. ' +
  'headline ≤ 40 chars, punchy. primaryText ≤ 125 chars, warm, one clear call to action. ' +
  'Match the brand voice if given. Plain text, no markdown, no placeholders/brackets, no hashtags.';

export interface AdCreativeContent {
  imageUrl: string;
  headline: string;
  primaryText: string;
  linkUrl: string;
}

/** A valid PUBLIC http(s) URL, or null. Rejects junk like "a" and non-public hosts
 *  (localhost / no-dot) so Meta doesn't reject the ad link (error 2061006). */
export function publicUrl(candidate?: string | null): string | null {
  if (!candidate) return null;
  try {
    const u = new URL(candidate.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (!u.hostname.includes('.') || u.hostname === 'localhost') return null;
    return u.toString();
  } catch {
    return null;
  }
}

export class AdCreativeService {
  constructor(
    private readonly anthropic = new AnthropicClient(),
    private readonly spendCap = new SpendCapEnforcer(),
    private readonly brandKit = new BrandKitService(),
    private readonly images: ImageGenerationService = imageGenerationService
  ) {}

  /** Build the AI creative for a campaign. Throws if the image can't be generated
   *  (e.g. ai_images_enabled off) so the push rolls back with a clear reason. */
  async build(shopId: string, request: AdCampaignRequest, campaignName: string): Promise<AdCreativeContent> {
    const [shop, kit] = await Promise.all([
      shopRepository.getShop(shopId).catch(() => null),
      this.brandKit.getBrandKit(shopId).catch(() => null),
    ]);
    const shopName = (shop as any)?.name || 'the shop';
    const industry = kit?.industryStyle || 'local service business';
    const voice = kit?.brandVoice || kit?.toneNotes || 'friendly and professional';
    const offer = request.offer || (request.goal ? request.goal.replace(/_/g, ' ') : 'our services');
    // Meta requires a valid public landing URL. Prefer the shop's website, then a configured
    // default, falling back to the brand site — never a junk/localhost value (error 2061006).
    const linkUrl = publicUrl((shop as any)?.website)
      || publicUrl(process.env.META_DEFAULT_LINK_URL)
      || publicUrl(process.env.FRONTEND_URL)
      || 'https://repaircoin.ai';

    // --- Copy (best-effort; spend-capped; falls back to the offer) ---
    let headline = offer.slice(0, 40);
    let primaryText = `Visit ${shopName} today — ${offer}`.slice(0, 125);
    try {
      const spend = await this.spendCap.canSpend(shopId);
      if (spend.allowed) {
        const resp = await this.anthropic.complete({
          systemPrompt: [{ text: COPY_SYSTEM, cache: true }],
          messages: [{ role: 'user', content:
            `Business: ${shopName} (${industry}). Brand voice: ${voice}. Offer/goal: ${offer}. ` +
            `Campaign: ${campaignName}. Write the ad copy JSON.` }],
          model: COPY_MODEL,
          maxTokens: 200,
        });
        await this.spendCap.recordSpend(shopId, resp.costUsd);
        const parsed = parseAdCopy(resp.text, offer);
        headline = parsed.headline;
        primaryText = parsed.primaryText;
      }
    } catch (err) {
      logger.error('AdCreativeService: copy generation failed — using fallback', err);
    }

    // --- Image (AI default; gated by ai_images_enabled, spend-capped inside generate) ---
    const prompt =
      `Professional, eye-catching social media ad image for ${shopName}, a ${industry}. ` +
      `Theme: ${offer}. Clean, vibrant, photographic; leave space for a small logo. No text in the image.`;
    const img = await this.images.generate(shopId, { prompt, useCase: 'ads', dimensions: '1536x1024' });
    if (!img.ok || !img.imageUrl) {
      throw new Error(`creative_image_failed: ${img.error || 'image generation unavailable'}`);
    }

    return { imageUrl: img.imageUrl, headline, primaryText, linkUrl };
  }
}

export const adCreativeService = new AdCreativeService();
