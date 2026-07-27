// backend/src/domains/AdsDomain/services/GoogleAdsCreativeService.ts
//
// Google RSA copy generation (Slice 3, BE-3b). Produces Responsive Search Ad copy — distinct
// headlines (≤30 chars) + descriptions (≤90) + keyword ideas — from the campaign brief, via the AI
// (spend-capped, brand-voiced), with a deterministic fallback so a build never fails on copy. Char
// limits + minimums are enforced here so the ad always satisfies Google's RSA requirements.

import { AnthropicClient } from '../../AIAgentDomain/services/AnthropicClient';
import { SpendCapEnforcer } from '../../AIAgentDomain/services/SpendCapEnforcer';
import { BrandKitService } from '../../AIAgentDomain/services/BrandKitService';
import { ChatMessage, ClaudeModel } from '../../AIAgentDomain/types';
import { cheapModel } from '../../../config/aiModels';
import { shopRepository } from '../../../repositories';
import { AiCostRepository } from '../repositories/AiCostRepository';
import { logger } from '../../../utils/logger';

const MODEL: ClaudeModel = cheapModel();
const clip = (s: string, n: number): string => (s.length <= n ? s : s.slice(0, n).trim());
const uniq = (arr: string[]): string[] => Array.from(new Set(arr.map((s) => s.trim()).filter(Boolean)));

export interface RsaCopy { headlines: string[]; descriptions: string[]; keywords: string[]; }

export class GoogleAdsCreativeService {
  constructor(
    private readonly anthropic = new AnthropicClient(),
    private readonly spendCap = new SpendCapEnforcer(),
    private readonly brandKit = new BrandKitService(),
    private readonly aiCosts = new AiCostRepository()
  ) {}

  /** RSA copy for a shop's campaign. AI-generated (spend-capped) with a safe fallback. Always returns
   *  ≥3 headlines (≤30) + ≥2 descriptions (≤90) so the RSA is valid. */
  async generateRsaCopy(
    shopId: string,
    input: { offer?: string | null; serviceNames?: string[]; campaignId?: string }
  ): Promise<RsaCopy> {
    const shop = await shopRepository.getShop(shopId).catch(() => null);
    const shopName = (shop as any)?.name || 'our shop';
    const services = (input.serviceNames || []).slice(0, 5);
    const fallback = this.fallback(shopName, input.offer, services);

    const spend = await this.spendCap.canSpend(shopId).catch(() => ({ allowed: false } as any));
    if (!spend.allowed) return fallback;

    const kit = await this.brandKit.getBrandKit(shopId).catch(() => null);
    const voice = kit?.brandVoice || kit?.toneNotes || 'friendly and professional';
    const prompt =
      `Write Google Search ad copy for ${shopName}, a local service business` +
      (services.length ? ` (services: ${services.join(', ')})` : '') + '.' +
      (input.offer ? ` Feature this offer: ${input.offer}.` : '') +
      ` Brand voice: ${voice}. Output ONLY JSON: {"headlines":[10 distinct strings, EACH <=30 chars],` +
      `"descriptions":[4 distinct strings, EACH <=90 chars],"keywords":[8 short search phrases]}.` +
      ` Headlines punchy + benefit-led; plain text, no emojis; NEVER exceed the character limits.`;

    try {
      const messages: ChatMessage[] = [{ role: 'user', content: 'Generate the ad copy JSON.' }];
      const resp = await this.anthropic.complete({
        systemPrompt: [{ text: prompt, cache: false }],
        messages, model: MODEL, maxTokens: 600,
      });
      const parsed = JSON.parse(this.extractJson(resp.text));
      let headlines = uniq((parsed.headlines || []).map((s: any) => clip(String(s), 30)));
      let descriptions = uniq((parsed.descriptions || []).map((s: any) => clip(String(s), 90)));
      let keywords = uniq((parsed.keywords || []).map((s: any) => clip(String(s), 80)));

      // Ads-AI is COGS (ad_ai_costs), not the shop's included AI allowance — don't drain the shop pool (T3.3).
      if (input.campaignId) {
        this.aiCosts.record({ campaignId: input.campaignId, costCents: resp.costUsd * 100, kind: 'creative_copy', model: resp.model })
          .catch((e) => logger.error('GoogleAdsCreativeService: failed to record AI cost', e));
      }

      // Enforce RSA minimums (pad from fallback if the model under-delivered).
      if (headlines.length < 3) headlines = uniq([...headlines, ...fallback.headlines]);
      if (descriptions.length < 2) descriptions = uniq([...descriptions, ...fallback.descriptions]);
      if (keywords.length < 1) keywords = fallback.keywords;
      return { headlines: headlines.slice(0, 15), descriptions: descriptions.slice(0, 4), keywords: keywords.slice(0, 15) };
    } catch (e: any) {
      logger.warn(`GoogleAdsCreativeService.generateRsaCopy fell back: ${e?.message || e}`);
      return fallback;
    }
  }

  /** Deterministic, char-safe RSA copy — always valid, used when AI is unavailable/over-budget. */
  private fallback(shopName: string, offer?: string | null, services: string[] = []): RsaCopy {
    const headlines = uniq([
      clip(shopName, 30),
      offer ? clip(offer, 30) : 'Trusted Local Service',
      services[0] ? clip(services[0], 30) : 'Quality You Can Trust',
      'Book Online Today',
      'Fast, Friendly Service',
      services[1] ? clip(services[1], 30) : 'Get Started Now',
    ]);
    const descriptions = uniq([
      clip(`${shopName} — ${offer || 'quality local service'}. Book online in minutes.`, 90),
      clip('Trusted, friendly, professional service. Get started today.', 90),
    ]);
    const keywords = uniq([shopName.toLowerCase(), ...services.map((s) => s.toLowerCase()), 'local service near me']);
    return { headlines, descriptions, keywords };
  }

  private extractJson(text: string): string {
    const m = text.match(/\{[\s\S]*\}/);
    return m ? m[0] : text;
  }
}

export const googleAdsCreativeService = new GoogleAdsCreativeService();
