// backend/src/domains/AdsDomain/services/AdCreativeService.ts
//
// Stage-4 push Phase 2 — AUTO-CREATIVE (no manual inputs). Generates the ad's image and copy
// from the request brief + brand kit: image via the shared ImageGenerationService (gpt-image-1,
// brand-kit-grounded, spend-capped, logo-stamped, stored on DO Spaces) and copy via Anthropic
// (Haiku, spend-capped). Returns the assembled creative; the admin can swap/edit it in the
// Phase-5 review state (decision #2: AI default + shop photos as swaps). PURE copy parsing is
// split out for unit tests; the IO (LLM + image) is exercised manually.

import { logger } from '../../../utils/logger';
import { getSharedPool } from '../../../utils/database-pool';
import { AnthropicClient } from '../../AIAgentDomain/services/AnthropicClient';
import { SpendCapEnforcer } from '../../AIAgentDomain/services/SpendCapEnforcer';
import { BrandKitService } from '../../AIAgentDomain/services/BrandKitService';
import { imageGenerationService, ImageGenerationService } from '../../AIAgentDomain/services/ImageGenerationService';
import { shopRepository } from '../../../repositories';
import { ClaudeModel } from '../../AIAgentDomain/types';
import { AdCampaignRequest } from '../repositories/CampaignRequestRepository';
import { AiCostRepository } from '../repositories/AiCostRepository';
import { parseAdCopy, truncateAtWord } from './adCopyParse';

export { parseAdCopy };

const COPY_MODEL: ClaudeModel = 'claude-haiku-4-5-20251001';

const COPY_SYSTEM =
  'You write short Facebook/Instagram ad copy for a local service business. ' +
  'Output ONLY JSON: {"headline": "...", "primaryText": "..."}. ' +
  'headline ≤ 40 chars, punchy. primaryText ≤ 125 chars, warm, one clear call to action. ' +
  'If services are named, weave a service name into the headline when it fits the 40-char limit; ' +
  'otherwise keep the headline benefit-focused and name the services in primaryText. ' +
  'Keep both within the limits and end on a COMPLETE word — never trail off mid-word or on a comma. ' +
  'Match the brand voice if given. Plain text, no markdown, no placeholders/brackets, no hashtags.';

export interface AdCreativeContent {
  imageUrl: string;
  headline: string;
  primaryText: string;
  linkUrl: string;
  /** The image prompt actually used (auto-derived, or the admin's custom description). */
  imagePrompt: string;
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
    private readonly images: ImageGenerationService = imageGenerationService,
    private readonly aiCosts = new AiCostRepository()
  ) {}

  /** The shop's promoted services with the detail the creative needs to be ABOUT the service
   *  (not just the shop's generic industry): name + category + a short description. Active only,
   *  top 3 by price. Empty array if none/unavailable. Best-effort. */
  private async promotedServices(
    ids: string[] | null | undefined
  ): Promise<Array<{ name: string; category: string | null; description: string | null }>> {
    if (!ids?.length) return [];
    try {
      const res = await getSharedPool().query(
        `SELECT service_name, category, description FROM shop_services
          WHERE service_id = ANY($1) AND active = true
          ORDER BY price_usd DESC NULLS LAST LIMIT 3`,
        [ids]
      );
      return res.rows
        .filter((r) => r.service_name)
        .map((r) => ({
          name: r.service_name as string,
          category: r.category ? String(r.category).replace(/_/g, ' ') : null,
          description: r.description ? String(r.description).slice(0, 160) : null,
        }));
    } catch (err) {
      logger.error('AdCreativeService: promoted service lookup failed', err);
      return [];
    }
  }

  /** Build the AI creative for a campaign. Throws if the image can't be generated
   *  (e.g. ai_images_enabled off) so the push rolls back with a clear reason.
   *  `opts.imagePrompt` lets an admin describe the image (regenerate flow) — otherwise we
   *  auto-derive it from the brand kit + offer. */
  async build(
    shopId: string,
    request: AdCampaignRequest,
    campaignName: string,
    opts: { imagePrompt?: string; landingUrl?: string; campaignId?: string } = {}
  ): Promise<AdCreativeContent> {
    const [shop, kit] = await Promise.all([
      shopRepository.getShop(shopId).catch(() => null),
      this.brandKit.getBrandKit(shopId).catch(() => null),
    ]);
    const shopName = (shop as any)?.name || 'the shop';
    const industry = kit?.industryStyle || 'local service business';
    const voice = kit?.brandVoice || kit?.toneNotes || 'friendly and professional';
    const offer = request.offer || (request.goal ? request.goal.replace(/_/g, ' ') : 'our services');
    // The specific services the shop chose to promote. These DRIVE the creative's subject
    // (what the ad is actually about) — the brand kit only sets the STYLE (colors/logo/voice).
    // Without this, a café-branded shop promoting a tech service got café imagery (the generic
    // industry dominated). Best-effort.
    const services = await this.promotedServices(request.promoteServiceIds);
    // Copy context: name + what it actually is (category + short description) so the model
    // doesn't reinterpret the name to fit the brand (e.g. "I Robot" → barista training).
    const serviceContext = services
      .map((s) => [s.name, s.category && `a ${s.category} service`, s.description].filter(Boolean).join(' — '))
      .join('; ');
    // Meta requires a valid public landing URL. Prefer our own campaign landing page (closes the
    // click→lead loop + shows the promoted services), then the shop's website, then a configured
    // default — never a junk/localhost value (error 2061006). The landing URL is rejected locally
    // (localhost), so dev falls back to the shop site; staging/prod set ADS_LANDING_BASE_URL.
    const linkUrl = publicUrl(opts.landingUrl)
      || publicUrl((shop as any)?.website)
      || publicUrl(process.env.META_DEFAULT_LINK_URL)
      || publicUrl(process.env.FRONTEND_URL)
      || 'https://repaircoin.ai';

    // --- Copy (best-effort; spend-capped; falls back to the offer) ---
    let headline = truncateAtWord(offer, 40);
    let primaryText = truncateAtWord(`Visit ${shopName} today — ${offer}`, 125);
    try {
      const spend = await this.spendCap.canSpend(shopId);
      if (spend.allowed) {
        const resp = await this.anthropic.complete({
          systemPrompt: [{ text: COPY_SYSTEM, cache: true }],
          messages: [{ role: 'user', content:
            `Business: ${shopName} (${industry}). Brand voice: ${voice}. Offer/goal: ${offer}. ` +
            (serviceContext
              ? `The ad is ABOUT these services — write about what they actually are, do NOT reinterpret the names to fit the business type: ${serviceContext}. `
              : '') +
            `Campaign: ${campaignName}. Write the ad copy JSON.` }],
          model: COPY_MODEL,
          maxTokens: 200,
        });
        await this.spendCap.recordSpend(shopId, resp.costUsd);
        // Q6 — log copy COGS to the per-campaign ledger so True Margin reflects it (best-effort).
        if (opts.campaignId) {
          void this.aiCosts.record({ campaignId: opts.campaignId, costCents: (resp.costUsd || 0) * 100, kind: 'creative_copy', model: COPY_MODEL })
            .catch((e) => logger.warn('AdCreativeService: copy cost ledger failed', e));
        }
        const parsed = parseAdCopy(resp.text, offer);
        headline = parsed.headline;
        primaryText = parsed.primaryText;
      }
    } catch (err) {
      logger.error('AdCreativeService: copy generation failed — using fallback', err);
    }

    // --- Image (AI default; gated by ai_images_enabled, spend-capped inside generate) ---
    // An admin-supplied description (regenerate) takes precedence. Otherwise the SUBJECT is the
    // promoted service(s) — what the ad is selling — NOT the shop's generic industry (which only
    // sets style via the brand kit's colors/logo, applied inside ImageGenerationService). This is
    // what stops a café-branded shop's tech-service ad from rendering coffee.
    const imageSubject = services.length
      ? `Show the subject of this offer: ${services
          .map((s) => [s.name, s.category && `(${s.category})`, s.description].filter(Boolean).join(' '))
          .join('; ')}.`
      : `Theme: ${offer}.`;
    const prompt =
      opts.imagePrompt?.trim() ||
      `Professional, eye-catching social media ad image for ${shopName}. ${imageSubject} ` +
      `Depict what the service actually is; clean, vibrant, photographic; leave space for a small logo. No text in the image.`;
    const img = await this.images.generate(shopId, { prompt, useCase: 'ads', dimensions: '1536x1024' });
    if (!img.ok || !img.imageUrl) {
      throw new Error(`creative_image_failed: ${img.error || 'image generation unavailable'}`);
    }
    // Q6 — log the gpt-image-1 COGS to the per-campaign ledger so True Margin isn't understated
    // (the dominant creative cost; was only in the shop AI budget before). Best-effort.
    if (opts.campaignId && img.costUsd) {
      void this.aiCosts.record({ campaignId: opts.campaignId, costCents: img.costUsd * 100, kind: 'creative_image', model: 'gpt-image-1' })
        .catch((e) => logger.warn('AdCreativeService: image cost ledger failed', e));
    }

    return { imageUrl: img.imageUrl, headline, primaryText, linkUrl, imagePrompt: prompt };
  }
}

export const adCreativeService = new AdCreativeService();
