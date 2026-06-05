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

/** Concrete anchor positions the logo can occupy. Four corners + two centers
 *  (bottom-center / top-center) so a shop can ask for "logo at the bottom,
 *  centered". */
export type LogoPosition =
  | "bottom-right"
  | "bottom-left"
  | "top-right"
  | "top-left"
  | "bottom-center"
  | "top-center";

/** "auto" = pick the visually quietest position so the logo doesn't cover the
 *  design (crowd, faces, on-image text). Any explicit position forces that spot. */
export type LogoPlacement = LogoPosition | "auto";

// Candidate positions the "auto" picker considers. Corners first so a tie on a
// flat image resolves to bottom-right (the conventional spot).
const ALL_POSITIONS: LogoPosition[] = [
  "bottom-right",
  "bottom-left",
  "top-right",
  "top-left",
  "bottom-center",
  "top-center",
];

export interface LogoOverlayOptions {
  /** Where to place the logo. Default "auto" (content-aware quietest spot). */
  corner?: LogoPlacement;
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
    const placement = opts.corner ?? "auto";
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

    // Resolve the position. "auto" = drop the logo into the quietest spot so it
    // doesn't cover the crowd / faces / on-image text.
    const position: LogoPosition =
      placement === "auto"
        ? this.pickQuietestPosition(image, lw, lh, margin)
        : placement;

    const { x, y } = this.positionXY(position, iw, ih, lw, lh, margin);

    image.composite(logo, x, y);
    return await image.getBufferAsync(Jimp.MIME_PNG);
  }

  /** Top-left (x,y) of the logo box for a given anchor position. */
  private positionXY(
    position: LogoPosition,
    iw: number,
    ih: number,
    lw: number,
    lh: number,
    margin: number
  ): { x: number; y: number } {
    const centerX = Math.round((iw - lw) / 2);
    switch (position) {
      case "top-left":
        return { x: margin, y: margin };
      case "top-right":
        return { x: iw - lw - margin, y: margin };
      case "top-center":
        return { x: centerX, y: margin };
      case "bottom-left":
        return { x: margin, y: ih - lh - margin };
      case "bottom-center":
        return { x: centerX, y: ih - lh - margin };
      case "bottom-right":
      default:
        return { x: iw - lw - margin, y: ih - lh - margin };
    }
  }

  /**
   * Choose the position whose logo-sized region is the LEAST visually busy, so
   * the logo sits on calm background rather than over the subject or text.
   * "Busyness" = mean local luminance gradient (edge density) in that region —
   * high for crowds, faces, and text; low for sky / walls / flat color. Ties
   * break toward bottom-right (the conventional spot, first in ALL_POSITIONS).
   * Pure pixel math via jimp — no AI, no network, ~sub-millisecond.
   */
  private pickQuietestPosition(
    image: Jimp,
    lw: number,
    lh: number,
    margin: number
  ): LogoPosition {
    const iw = image.bitmap.width;
    const ih = image.bitmap.height;

    let best: LogoPosition = "bottom-right";
    let bestScore = Infinity;
    for (const position of ALL_POSITIONS) {
      const { x, y } = this.positionXY(position, iw, ih, lw, lh, margin);
      const score = this.regionDetail(image, x, y, lw, lh);
      // Strictly-less keeps the ALL_POSITIONS order as the tiebreak, so a flat
      // image stays bottom-right (first entry).
      if (score < bestScore) {
        bestScore = score;
        best = position;
      }
    }
    return best;
  }

  /** Mean per-pixel luminance gradient over [x,y,w,h] (clamped to the image).
   *  Sampled every 2px to stay cheap. Higher = busier (edges/text/detail). */
  private regionDetail(
    image: Jimp,
    x: number,
    y: number,
    w: number,
    h: number
  ): number {
    const data = image.bitmap.data; // RGBA, row-major
    const W = image.bitmap.width;
    const H = image.bitmap.height;
    const x0 = Math.max(0, x);
    const y0 = Math.max(0, y);
    const x1 = Math.min(W - 1, x + w);
    const y1 = Math.min(H - 1, y + h);
    const step = 2;

    const lum = (i: number): number =>
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

    let sum = 0;
    let count = 0;
    for (let py = y0; py < y1 - step; py += step) {
      for (let px = x0; px < x1 - step; px += step) {
        const i = (py * W + px) * 4;
        const iRight = (py * W + (px + step)) * 4;
        const iDown = ((py + step) * W + px) * 4;
        const l0 = lum(i);
        sum += Math.abs(l0 - lum(iRight)) + Math.abs(l0 - lum(iDown));
        count++;
      }
    }
    return count > 0 ? sum / count : 0;
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
