// backend/src/services/LogoOverlayService.ts
//
// Deterministic logo compositing for AI Image Generation (Phase 7). The shop's
// real logo is overlaid onto a generated/edited image with pixel-exact
// placement — NOT via the model (AI distorts a real logo). See
// docs/tasks/strategy/ai-image-generation/implementation.md §7.
//
// Uses `jimp` (pure-JS) rather than `sharp` — no native bindings, so it's
// deploy-safe on DigitalOcean with zero platform-binary risk. Logo compositing
// is low-volume (one per generation), so jimp's speed is a non-issue.
//
// Best-effort by design: the caller treats a failure as "skip the logo, keep
// the generated image" — a bad/missing logo must never fail the whole
// generation.

import Jimp from "jimp";
import { logger } from "../utils/logger";

export type LogoCorner =
  | "bottom-right"
  | "bottom-left"
  | "top-right"
  | "top-left";

export interface LogoOverlayOptions {
  /** Where to place the logo. Default bottom-right. */
  corner?: LogoCorner;
  /** Logo width as a fraction of the image width. Default 0.18 (18%). */
  maxWidthPct?: number;
  /** Safe margin from the edges, as a fraction of image width. Default 0.04. */
  marginPct?: number;
}

export class LogoOverlayService {
  /**
   * Composite `logoUrl` onto `imageBuffer` and return a PNG buffer. Preserves
   * the logo's aspect ratio and its transparency (PNG alpha). Throws on any
   * failure (logo download / decode / composite) — the caller falls back to
   * the un-overlaid image.
   */
  async overlay(
    imageBuffer: Buffer,
    logoUrl: string,
    opts: LogoOverlayOptions = {}
  ): Promise<Buffer> {
    const corner = opts.corner ?? "bottom-right";
    const maxWidthPct = opts.maxWidthPct ?? 0.18;
    const marginPct = opts.marginPct ?? 0.04;

    const res = await fetch(logoUrl);
    if (!res.ok) {
      throw new Error(`logo download failed (status ${res.status})`);
    }
    const logoBuffer = Buffer.from(await res.arrayBuffer());

    const image = await Jimp.read(imageBuffer);
    const logo = await Jimp.read(logoBuffer);

    const iw = image.bitmap.width;
    const ih = image.bitmap.height;

    // Resize the logo to a fraction of the image width, keeping aspect ratio.
    const targetW = Math.max(1, Math.round(iw * maxWidthPct));
    logo.resize(targetW, Jimp.AUTO);

    const margin = Math.round(iw * marginPct);
    const lw = logo.bitmap.width;
    const lh = logo.bitmap.height;

    let x: number;
    let y: number;
    switch (corner) {
      case "top-left":
        x = margin;
        y = margin;
        break;
      case "top-right":
        x = iw - lw - margin;
        y = margin;
        break;
      case "bottom-left":
        x = margin;
        y = ih - lh - margin;
        break;
      case "bottom-right":
      default:
        x = iw - lw - margin;
        y = ih - lh - margin;
        break;
    }

    image.composite(logo, x, y);
    return await image.getBufferAsync(Jimp.MIME_PNG);
  }

  /** Same as overlay() but never throws — returns the original buffer on any
   *  failure (and logs). Convenience for the generate pipeline, where the logo
   *  is an enhancement, not a hard requirement. */
  async overlaySafe(
    imageBuffer: Buffer,
    logoUrl: string,
    opts: LogoOverlayOptions = {}
  ): Promise<{ buffer: Buffer; applied: boolean }> {
    try {
      const buffer = await this.overlay(imageBuffer, logoUrl, opts);
      return { buffer, applied: true };
    } catch (err) {
      logger.warn("LogoOverlayService: skipping logo overlay", {
        error: err instanceof Error ? err.message : String(err),
      });
      return { buffer: imageBuffer, applied: false };
    }
  }
}

export const logoOverlayService = new LogoOverlayService();
