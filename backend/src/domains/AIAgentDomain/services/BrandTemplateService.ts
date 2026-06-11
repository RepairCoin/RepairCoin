// backend/src/domains/AIAgentDomain/services/BrandTemplateService.ts
//
// Branding Studio Phase 4 — on-demand brand templates. Generates marketing
// graphics (social post / story / poster) for a shop by delegating to the
// existing ImageGenerationService (gpt-image-1 → real logo overlay → DO Spaces →
// spend/audit). This service only adds: the per-template prompt + size, a curated
// typography pairing, and persistence of the resulting asset rows.
//
// Generation is gated upstream by ImageGenerationService (ai_images_enabled
// kill-switch + spend cap). We surface those outcomes verbatim. Cost is real —
// one gpt-image-1 image per template — so callers trigger this on demand, never
// silently in a loop.

import { Pool } from "pg";
import { getSharedPool } from "../../../utils/database-pool";
import { logger } from "../../../utils/logger";
import {
  ImageGenerationService,
  imageGenerationService,
} from "./ImageGenerationService";
import { BrandKit, BrandKitService } from "./BrandKitService";
import type { ImageSize } from "../../../services/openai/OpenAIImageClient";

export type TemplateKind = "social_post" | "social_story" | "poster";
export const TEMPLATE_KINDS: TemplateKind[] = ["social_post", "social_story", "poster"];

// Curated Google-Font pairings (heading / body) per marketing style. Data-only —
// the AI renders the image; these drive the style-guide + front-end previews.
const FONT_PAIRS: Record<string, { heading: string; body: string }> = {
  "Professional & Corporate": { heading: "Montserrat", body: "Source Sans 3" },
  "Modern & Tech": { heading: "Space Grotesk", body: "Inter" },
  "Friendly & Local": { heading: "Poppins", body: "Nunito" },
  "Premium & Luxury": { heading: "Playfair Display", body: "Lato" },
};
const DEFAULT_FONT_PAIR = { heading: "Poppins", body: "Inter" };

/** The curated heading/body pairing for a marketing style (or a sane default). */
export function fontPairForStyle(marketingStyle: string | null): {
  heading: string;
  body: string;
} {
  return (marketingStyle && FONT_PAIRS[marketingStyle]) || DEFAULT_FONT_PAIR;
}

interface TemplateSpec {
  kind: TemplateKind;
  size: ImageSize;
  label: string;
  /** Format/layout guidance; brand colors+tone are injected by buildBrandedPrompt. */
  format: string;
}

const TEMPLATE_SPECS: Record<TemplateKind, TemplateSpec> = {
  social_post: {
    kind: "social_post",
    size: "1024x1024",
    label: "Social post",
    format:
      "a square 1:1 social media post graphic, Instagram/Facebook ready, " +
      "eye-catching with a clear focal point and room for a short headline",
  },
  social_story: {
    kind: "social_story",
    size: "1024x1536",
    label: "Social story",
    format:
      "a vertical 9:16 social media story/reel graphic, full-bleed mobile " +
      "format, bold and thumb-stopping with the headline in the upper third",
  },
  poster: {
    kind: "poster",
    size: "1536x1024",
    label: "Poster",
    format:
      "a landscape promotional poster suitable for print and in-store display, " +
      "clean and professional with a strong headline and clear hierarchy",
  },
};

export interface TemplateAsset {
  id: number;
  kind: TemplateKind;
  templateKey: string;
  url: string;
  size: string | null;
  costUsd: number;
  createdAt: string;
}

export interface GenerateTemplateResult {
  kind: TemplateKind;
  ok: boolean;
  status: number;
  url?: string;
  error?: string;
  costUsd?: number;
}

export class BrandTemplateService {
  constructor(
    private readonly pool: Pool = getSharedPool(),
    private readonly imageGen: ImageGenerationService = imageGenerationService,
    private readonly brandKit: BrandKitService = new BrandKitService()
  ) {}

  /** Build the marketing prompt for one template from the shop's brand profile.
   *  Brand colors + tone are layered in later by buildBrandedPrompt, so here we
   *  describe the FORMAT + content (headline, business, style). */
  private buildPrompt(
    spec: TemplateSpec,
    kit: BrandKit | null,
    shopName: string,
    userPrompt?: string
  ): string {
    const headline = kit?.headline?.trim() || "";
    const style = kit?.marketingStyle?.trim() || "modern, professional";
    const industry = kit?.industryStyle?.trim() || "local repair & service business";
    const ask = (userPrompt || "").trim().slice(0, 500);
    const bits = [`Design ${spec.format} for "${shopName}", a ${industry}.`];
    // The shop's own instruction is the PRIMARY content driver when provided —
    // the brand profile only sets style/colors/logo, so a bad industry guess no
    // longer dictates the subject.
    if (ask) {
      bits.push(`Subject and content (MOST IMPORTANT — follow this closely): ${ask}.`);
    }
    bits.push(`Visual style: ${style}.`);
    if (headline) {
      bits.push(
        `If you include any text, use only this short headline, spelled EXACTLY: "${headline}". Keep text minimal and large.`
      );
    } else if (!ask) {
      bits.push("Keep any text minimal; favor a clean graphic with space for a logo.");
    }
    bits.push(
      "Leave an uncluttered corner for a logo. No lorem ipsum, no gibberish text, no watermark."
    );
    return bits.join(" ");
  }

  private async shopName(shopId: string): Promise<string> {
    try {
      const r = await this.pool.query<{ name: string | null }>(
        `SELECT name FROM shops WHERE shop_id = $1`,
        [shopId]
      );
      return r.rows[0]?.name?.trim() || "Your Shop";
    } catch {
      return "Your Shop";
    }
  }

  /** Generate ONE template. Delegates to ImageGenerationService (kill-switch +
   *  spend cap + logo overlay + storage + audit). Records an asset row on success.
   *  Never throws for an expected gate (returns ok:false + the upstream status). */
  async generateTemplate(
    shopId: string,
    kind: TemplateKind,
    userPrompt?: string
  ): Promise<GenerateTemplateResult> {
    const spec = TEMPLATE_SPECS[kind];
    if (!spec) return { kind, ok: false, status: 400, error: "Unknown template kind" };

    const kit = await this.brandKit.getBrandKit(shopId);
    const name = await this.shopName(shopId);
    const prompt = this.buildPrompt(spec, kit, name, userPrompt);

    const outcome = await this.imageGen.generate(shopId, {
      prompt,
      dimensions: spec.size,
      useCase: `brand_template:${kind}`,
      overlayLogo: true,
    });

    if (!outcome.ok || !outcome.imageUrl) {
      return { kind, ok: false, status: outcome.status, error: outcome.error };
    }

    try {
      await this.pool.query(
        `INSERT INTO brand_template_assets (shop_id, kind, template_key, url, size, cost_usd)
         VALUES ($1, $2, 'default', $3, $4, $5)`,
        [shopId, kind, outcome.imageUrl, outcome.dimensions ?? spec.size, outcome.costUsd ?? 0]
      );
    } catch (err) {
      logger.error("BrandTemplateService: failed to record asset", err);
      // The image exists + spend was recorded by ImageGenerationService; a missing
      // ledger row is a soft failure — still return the URL so the shop sees it.
    }

    return { kind, ok: true, status: 200, url: outcome.imageUrl, costUsd: outcome.costUsd };
  }

  /** Generate a wide SHOP BANNER (header image). Unlike templates, this isn't a
   *  marketing asset — it becomes the shop's banner (shops.banner_url), persisted
   *  by the caller. Returns the generated image URL (or a gate outcome). */
  async generateBanner(
    shopId: string,
    userPrompt?: string
  ): Promise<{ ok: boolean; status: number; url?: string; error?: string; costUsd?: number }> {
    const kit = await this.brandKit.getBrandKit(shopId);
    const name = await this.shopName(shopId);
    const style = kit?.marketingStyle?.trim() || "modern, professional";
    const industry = kit?.industryStyle?.trim() || "local repair & service business";
    const ask = (userPrompt || "").trim().slice(0, 500);
    const subject = ask
      ? `Subject and content (MOST IMPORTANT — follow this closely): ${ask}. `
      : `Clean, professional storefront-header feel with a clear focal area and calm space where a name/tagline could sit. `;
    const prompt =
      `Design a wide landscape header/banner image for "${name}", a ${industry}. ` +
      subject +
      `Visual style: ${style}. Keep any text minimal; no lorem ipsum, no ` +
      `gibberish, no watermark.`;

    const outcome = await this.imageGen.generate(shopId, {
      prompt,
      dimensions: "1536x1024", // landscape banner
      useCase: "shop_banner",
      overlayLogo: true,
    });

    if (!outcome.ok || !outcome.imageUrl) {
      return { ok: false, status: outcome.status, error: outcome.error };
    }
    return { ok: true, status: 200, url: outcome.imageUrl, costUsd: outcome.costUsd };
  }

  /** Generate a set of templates (sequential — each is a real, paid image). */
  async generateSet(
    shopId: string,
    kinds: TemplateKind[] = TEMPLATE_KINDS,
    userPrompt?: string
  ): Promise<GenerateTemplateResult[]> {
    const wanted = kinds.filter((k) => TEMPLATE_KINDS.includes(k));
    const results: GenerateTemplateResult[] = [];
    for (const kind of wanted) {
      const r = await this.generateTemplate(shopId, kind, userPrompt);
      results.push(r);
      // Stop early on a hard gate (disabled / budget) — no point re-hitting it.
      if (!r.ok && (r.status === 403 || r.status === 429)) break;
    }
    return results;
  }

  /** All generated templates for a shop, newest first. */
  async listTemplates(shopId: string): Promise<TemplateAsset[]> {
    const r = await this.pool.query<{
      id: string;
      kind: TemplateKind;
      template_key: string;
      url: string;
      size: string | null;
      cost_usd: string | null;
      created_at: Date;
    }>(
      `SELECT id, kind, template_key, url, size, cost_usd, created_at
         FROM brand_template_assets
        WHERE shop_id = $1
        ORDER BY created_at DESC
        LIMIT 50`,
      [shopId]
    );
    return r.rows.map((row) => ({
      id: Number(row.id),
      kind: row.kind,
      templateKey: row.template_key,
      url: row.url,
      size: row.size,
      costUsd: row.cost_usd ? Number(row.cost_usd) : 0,
      createdAt: row.created_at.toISOString(),
    }));
  }
}

export const brandTemplateService = new BrandTemplateService();
