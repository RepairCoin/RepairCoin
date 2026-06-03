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

/** Fields a shop may set via PUT /api/ai/brand-kit. All optional → a full
 *  replace where an omitted/empty field is stored as NULL (the form always
 *  sends its current values). */
export interface BrandKitUpdate {
  logoUrl?: string | null;
  primaryColorHex?: string | null;
  secondaryColorHex?: string | null;
  toneNotes?: string | null;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const MAX_TONE_CHARS = 500;
const MAX_LOGO_URL_CHARS = 2048;

/**
 * Pure validator for a brand-kit update — exported for unit tests. Normalizes
 * empties to null; rejects malformed hex / over-long fields. Returns the
 * cleaned BrandKitUpdate or an error string.
 */
export function validateBrandKitUpdate(
  body: unknown
): { value?: BrandKitUpdate; error?: string } {
  if (!body || typeof body !== "object") {
    return { error: "Request body is required" };
  }
  const b = body as Record<string, unknown>;
  const out: BrandKitUpdate = {};

  const asStr = (v: unknown): string | null => {
    if (typeof v !== "string") return null;
    const t = v.trim();
    return t.length === 0 ? null : t;
  };

  for (const key of ["primaryColorHex", "secondaryColorHex"] as const) {
    const v = asStr(b[key]);
    if (v && !HEX_RE.test(v)) {
      return { error: `${key} must be a hex color like #FFCC00` };
    }
    out[key] = v;
  }

  const tone = asStr(b.toneNotes);
  if (tone && tone.length > MAX_TONE_CHARS) {
    return { error: `toneNotes exceeds ${MAX_TONE_CHARS} characters` };
  }
  out.toneNotes = tone;

  const logo = asStr(b.logoUrl);
  if (logo && logo.length > MAX_LOGO_URL_CHARS) {
    return { error: "logoUrl is too long" };
  }
  out.logoUrl = logo;

  return { value: out };
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
   * Create or replace a shop's brand kit (full upsert — the settings form
   * always sends its current values; omitted fields become NULL). Returns the
   * stored kit. Throws on DB error (controller maps to 503).
   */
  async upsertBrandKit(shopId: string, update: BrandKitUpdate): Promise<BrandKit> {
    const r = await this.pool.query<{
      logo_url: string | null;
      primary_color_hex: string | null;
      secondary_color_hex: string | null;
      tone_notes: string | null;
    }>(
      `INSERT INTO shop_brand_kits
         (shop_id, logo_url, primary_color_hex, secondary_color_hex, tone_notes, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (shop_id) DO UPDATE SET
         logo_url            = EXCLUDED.logo_url,
         primary_color_hex   = EXCLUDED.primary_color_hex,
         secondary_color_hex = EXCLUDED.secondary_color_hex,
         tone_notes          = EXCLUDED.tone_notes,
         updated_at          = now()
       RETURNING logo_url, primary_color_hex, secondary_color_hex, tone_notes`,
      [
        shopId,
        update.logoUrl ?? null,
        update.primaryColorHex ?? null,
        update.secondaryColorHex ?? null,
        update.toneNotes ?? null,
      ]
    );
    const row = r.rows[0];
    return {
      logoUrl: row.logo_url,
      primaryColorHex: row.primary_color_hex,
      secondaryColorHex: row.secondary_color_hex,
      toneNotes: row.tone_notes,
    };
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
