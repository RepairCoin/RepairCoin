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
  /** Effective logo the AI uses (override ?? the shop's profile logo). This is
   *  what the generator stamps and what the UI previews. */
  logoUrl: string | null;
  /** The brand-kit override (shop_brand_kits.logo_url). Null = "use the shop
   *  logo". A shop only sets this to stamp a different image (e.g. a
   *  transparent PNG) onto AI output without changing its public logo. */
  logoOverrideUrl: string | null;
  /** The shop's canonical logo (shops.logo_url) — the default, managed under
   *  Settings → Shop Profile. */
  shopLogoUrl: string | null;
  primaryColorHex: string | null;
  secondaryColorHex: string | null;
  toneNotes: string | null;
}

/** Fields a shop may set via PUT /api/ai/brand-kit. All optional → a full
 *  replace where an omitted/empty field is stored as NULL (the form always
 *  sends its current values). `logoUrl` here is the OPTIONAL AI override
 *  (shop_brand_kits.logo_url) — NOT the shop's public logo. */
export interface BrandKitUpdate {
  logoUrl?: string | null;
  primaryColorHex?: string | null;
  secondaryColorHex?: string | null;
  toneNotes?: string | null;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const MAX_TONE_CHARS = 500;
const MAX_LOGO_URL_CHARS = 2048;

// Always-on art direction so AI output reads like designed marketing, not
// generic AI art. Applied to EVERY generation (with or without a brand kit).
// Targets the real failure modes seen in output: light/yellow text on a light
// busy background (unreadable), and unbalanced layouts with large dead space.
const DESIGN_DIRECTION =
  "Design direction: this is a polished marketing graphic. Make any on-image " +
  "text large, bold, and HIGHLY LEGIBLE with strong contrast against its " +
  "background — set text over a darker region or add a semi-transparent dark " +
  "gradient/band behind it so it reads clearly. NEVER place light, white, or " +
  "yellow text directly on a light or busy background. Use a balanced, " +
  "full-frame composition with a clear focal point and NO large empty or dead " +
  "space; the headline and offer get visual priority. Keep it clean, modern, " +
  "and uncluttered.";

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

  /** Read a shop's brand kit. The logo is resolved to the EFFECTIVE logo —
   *  the brand-kit override if set, otherwise the shop's profile logo
   *  (shops.logo_url) — so a shop manages its logo in ONE place (Shop Profile)
   *  and only overrides here when it wants a different image stamped on AI
   *  output. Returns null only when the shop row itself is missing; on a DB
   *  error returns null so generation proceeds without brand guidance. */
  async getBrandKit(shopId: string): Promise<BrandKit | null> {
    try {
      const r = await this.pool.query<{
        shop_logo_url: string | null;
        override_logo_url: string | null;
        primary_color_hex: string | null;
        secondary_color_hex: string | null;
        tone_notes: string | null;
      }>(
        `SELECT s.logo_url            AS shop_logo_url,
                bk.logo_url           AS override_logo_url,
                bk.primary_color_hex,
                bk.secondary_color_hex,
                bk.tone_notes
           FROM shops s
           LEFT JOIN shop_brand_kits bk ON bk.shop_id = s.shop_id
          WHERE s.shop_id = $1`,
        [shopId]
      );
      const row = r.rows[0];
      if (!row) return null;
      const shopLogoUrl = row.shop_logo_url;
      const logoOverrideUrl = row.override_logo_url;
      return {
        logoUrl: logoOverrideUrl ?? shopLogoUrl, // effective: override wins
        logoOverrideUrl,
        shopLogoUrl,
        primaryColorHex: row.primary_color_hex,
        secondaryColorHex: row.secondary_color_hex,
        toneNotes: row.tone_notes,
      };
    } catch (err) {
      // Table absent or transient DB error → treat as "no kit". Brand guidance
      // (and logo stamping) is an enhancement, never a hard dependency of gen.
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
    // `logo_url` stored here is the OPTIONAL override (null = use the shop logo).
    await this.pool.query(
      `INSERT INTO shop_brand_kits
         (shop_id, logo_url, primary_color_hex, secondary_color_hex, tone_notes, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (shop_id) DO UPDATE SET
         logo_url            = EXCLUDED.logo_url,
         primary_color_hex   = EXCLUDED.primary_color_hex,
         secondary_color_hex = EXCLUDED.secondary_color_hex,
         tone_notes          = EXCLUDED.tone_notes,
         updated_at          = now()`,
      [
        shopId,
        update.logoUrl ?? null,
        update.primaryColorHex ?? null,
        update.secondaryColorHex ?? null,
        update.toneNotes ?? null,
      ]
    );
    // Re-read so the response carries the effective logo (override ?? shop logo)
    // and shopLogoUrl, matching what getBrandKit returns.
    const kit = await this.getBrandKit(shopId);
    if (kit) return kit;
    // Defensive: shop row missing (shouldn't happen for an authed shop).
    return {
      logoUrl: update.logoUrl ?? null,
      logoOverrideUrl: update.logoUrl ?? null,
      shopLogoUrl: null,
      primaryColorHex: update.primaryColorHex ?? null,
      secondaryColorHex: update.secondaryColorHex ?? null,
      toneNotes: update.toneNotes ?? null,
    };
  }

  /**
   * Prepend deterministic guardrails to the raw prompt: always-on design
   * direction (legibility + composition) PLUS the shop's brand colors/tone when
   * a kit exists. The design direction targets the two failure modes seen in
   * real output — low-contrast text (e.g. yellow/white over a light photo) and
   * unbalanced layouts with dead space — and reframes the brand color as an
   * ACCENT so the model stops painting body text in it. Logo is Phase 7.
   */
  buildBrandedPrompt(rawPrompt: string, kit: BrandKit | null): string {
    const bits: string[] = [];
    if (kit?.primaryColorHex) {
      bits.push(
        `primary brand color ${kit.primaryColorHex} (use as an ACCENT — shapes, bars, highlights, key words — NOT for body text over light or busy areas)`
      );
    }
    if (kit?.secondaryColorHex) {
      bits.push(`secondary brand color ${kit.secondaryColorHex}`);
    }
    if (kit?.toneNotes) bits.push(`tone: ${kit.toneNotes.trim()}`);
    const brand =
      bits.length > 0
        ? `Brand guidance — ${bits.join("; ")}. Apply these as accents. `
        : "";

    return `${DESIGN_DIRECTION} ${brand}--- ${rawPrompt}`;
  }
}

export const brandKitService = new BrandKitService();
