// backend/src/domains/AIAgentDomain/services/BrandKitService.ts
//
// Per-shop brand kit (AI Image Generation, G2 Option A): the shop's colors +
// tone, injected into every generation prompt so output looks ON-BRAND rather
// than generic AI art. See implementation.md §6.
//
// Phase 1 ships the READ + prompt injection; the shop_brand_kits TABLE and its
// settings UI land in Phase 3. So getBrandKit() is deliberately defensive — it
// returns null when the table or row doesn't exist yet, and buildBrandedPrompt
// no-ops on null. That keeps Phase 1 shippable standalone; once Phase 3 lands
// the table + data, brand colors start applying automatically with no Phase 1
// change.
//
// NOTE: the actual logo is NOT injected here (the model can't place a real
// logo). The logo is composited deterministically in Phase 7 (LogoOverlayService).

import { Pool } from "pg";
import { getSharedPool } from "../../../utils/database-pool";
import { logger } from "../../../utils/logger";

export interface BrandKit {
  logoUrl: string | null;
  primaryColorHex: string | null;
  secondaryColorHex: string | null;
  toneNotes: string | null;
}

export class BrandKitService {
  constructor(private readonly pool: Pool = getSharedPool()) {}

  /** Read a shop's brand kit. Returns null if unset OR the table doesn't
   *  exist yet (Phase 3 creates it) — never throws into the gen path. */
  async getBrandKit(shopId: string): Promise<BrandKit | null> {
    try {
      const r = await this.pool.query<{
        logo_url: string | null;
        primary_color_hex: string | null;
        secondary_color_hex: string | null;
        tone_notes: string | null;
      }>(
        `SELECT logo_url, primary_color_hex, secondary_color_hex, tone_notes
           FROM shop_brand_kits
          WHERE shop_id = $1`,
        [shopId]
      );
      const row = r.rows[0];
      if (!row) return null;
      return {
        logoUrl: row.logo_url,
        primaryColorHex: row.primary_color_hex,
        secondaryColorHex: row.secondary_color_hex,
        toneNotes: row.tone_notes,
      };
    } catch (err) {
      // Table absent (pre-Phase-3) or transient DB error → treat as "no kit".
      // Brand guidance is an enhancement, never a hard dependency of gen.
      logger.warn("BrandKitService.getBrandKit unavailable — generating without brand guidance", {
        shopId,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * Prepend deterministic brand guardrails to the raw prompt. Colors + tone
   * only (logo is Phase 7). Returns the raw prompt unchanged when no kit /
   * no usable fields, so generation always works.
   */
  buildBrandedPrompt(rawPrompt: string, kit: BrandKit | null): string {
    if (!kit) return rawPrompt;
    const bits: string[] = [];
    if (kit.primaryColorHex) bits.push(`primary color ${kit.primaryColorHex}`);
    if (kit.secondaryColorHex) bits.push(`secondary color ${kit.secondaryColorHex}`);
    if (kit.toneNotes) bits.push(`tone: ${kit.toneNotes.trim()}`);
    if (bits.length === 0) return rawPrompt;
    return `Brand guidance — ${bits.join("; ")}. Apply these to the image. --- ${rawPrompt}`;
  }
}

export const brandKitService = new BrandKitService();
