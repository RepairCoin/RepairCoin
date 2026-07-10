import { Dimensions, PixelRatio } from "react-native";

/**
 * Responsive sizing helpers (size-matters style).
 *
 * Background — per the React Native docs (https://reactnative.dev/docs/pixelratio)
 * there is NO built-in "normalize" API. The platform already splits the problem:
 *   1. Pixel DENSITY  → RN renders dp density-correctly on its own; you only need
 *      `PixelRatio.get()` to fetch image ASSETS at the right resolution.
 *   2. Font ACCESSIBILITY scaling → `<Text>` honors the OS text-size setting
 *      automatically; `PixelRatio.getFontScale()` exposes that factor.
 *   3. Sub-pixel CRISPNESS → `PixelRatio.roundToNearestPixel()` snaps a dp value
 *      to the device's physical pixel grid (sharper than Math.round, which only
 *      snaps to a whole dp).
 *
 * What the platform does NOT solve is adapting a fixed design to different screen
 * *sizes* (small phone vs. tablet). That's the community "scale from a baseline"
 * pattern implemented below. The baseline matches the Figma design frame
 * (iPhone 15 Pro Max, 430×932 pt — the mockups export at 1290px @3x), so a value
 * like `rScale(200)` means "200pt as drawn in Figma". We round with
 * `roundToNearestPixel` (concern #3) so scaled values stay crisp.
 *
 * - `scale(n)`   → scales by screen width  (widths, horizontal gaps)
 * - `vScale(n)`  → scales by screen height (heights, vertical gaps)
 * - `mScale(n,f)`→ moderate scale: scales at a reduced rate (default factor 0.5).
 *                  Best for font sizes, radii, and padding you don't want to grow
 *                  at full rate on large screens.
 * - `r*` variants→ same, pixel-grid rounded (use these for concrete style values).
 *
 * Note: dimensions are read at module load, so values reflect the launch
 * orientation. For rotation-aware sizing use `useWindowDimensions()` in the
 * component instead.
 */

// Figma design frame: iPhone 15 Pro Max, 430×932 pt (exports at 1290px @3x).
const BASE_WIDTH = 430;
const BASE_HEIGHT = 932;

const { width, height } = Dimensions.get("window");

// Use the shorter side as "width" so landscape/tablet don't over-scale.
const shortDimension = Math.min(width, height);
const longDimension = Math.max(width, height);

export const scale = (size: number): number =>
  (shortDimension / BASE_WIDTH) * size;

export const vScale = (size: number): number =>
  (longDimension / BASE_HEIGHT) * size;

export const mScale = (size: number, factor = 0.5): number =>
  size + (scale(size) - size) * factor;

// Rounded variants — snap to the device's physical pixel grid (RN-recommended)
// instead of a whole dp, so scaled edges stay crisp on 2x/3x screens.
export const rScale = (size: number): number =>
  PixelRatio.roundToNearestPixel(scale(size));
export const rvScale = (size: number): number =>
  PixelRatio.roundToNearestPixel(vScale(size));
export const rmScale = (size: number, factor = 0.5): number =>
  PixelRatio.roundToNearestPixel(mScale(size, factor));

/**
 * Accessibility-aware font size. Multiplies a moderately-scaled size by the
 * user's OS font-scale preference. Use for text rendered outside `<Text>`
 * (e.g. canvas/SVG); normal `<Text>` already scales on its own, so prefer
 * leaving font sizes to NativeWind/`<Text>` unless you've disabled scaling.
 */
export const fontScale = (size: number, factor = 0.5): number =>
  PixelRatio.roundToNearestPixel(mScale(size, factor) * PixelRatio.getFontScale());
