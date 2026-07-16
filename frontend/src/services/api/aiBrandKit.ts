// frontend/src/services/api/aiBrandKit.ts
//
// Client for the per-shop Brand Kit (AI Image Generation Phase 3). Colors +
// tone + logo the AI applies to every generated image. GET/PUT /api/ai/brand-kit
// are shop-scoped via the JWT (no shopId param).

import apiClient from "./client";

export interface BrandKit {
  /** Effective logo the AI uses (override ?? shop profile logo) — for preview. */
  logoUrl: string | null;
  /** Optional AI override (null = use the shop logo). */
  logoOverrideUrl: string | null;
  /** The shop's canonical logo, managed under Settings → Shop Profile. */
  shopLogoUrl: string | null;
  /** The shop's banner/header image (shops.banner_url). */
  shopBannerUrl: string | null;
  primaryColorHex: string | null;
  secondaryColorHex: string | null;
  toneNotes: string | null;
  /** Branding Studio profile (collected by the wizard). All nullable. */
  marketingStyle: string | null;
  brandVoice: string | null;
  headline: string | null;
  brandPersonality: string | null;
  industryStyle: string | null;
  /** Curated Google-font pairing (Phase 4). */
  headingFont: string | null;
  bodyFont: string | null;
  /** When the Branding Studio onboarding was finished/skipped. null = not done
   *  (the wizard auto-opens on first dashboard load). */
  onboardingCompletedAt: string | null;
}

/** Writable brand-kit fields. `logoUrl` is the OPTIONAL AI override
 *  (null = use the shop's profile logo) — NOT the shop's public logo. */
export interface BrandKitUpdate {
  logoUrl: string | null;
  primaryColorHex: string | null;
  secondaryColorHex: string | null;
  toneNotes: string | null;
  marketingStyle?: string | null;
  brandVoice?: string | null;
  headline?: string | null;
  brandPersonality?: string | null;
  industryStyle?: string | null;
  headingFont?: string | null;
  bodyFont?: string | null;
}

/** The shop's brand kit (all-null when unset). */
export const getBrandKit = async (): Promise<BrandKit> => {
  const response = await apiClient.get("/ai/brand-kit");
  // Axios interceptor pre-unwraps response.data; the `.data.data` form covers
  // an interceptor-bypass edge case (same pattern as the other ai services).
  return (response.data.data || response.data) as BrandKit;
};

/** Create or replace the shop's brand kit (full replace). */
export const updateBrandKit = async (
  update: BrandKitUpdate
): Promise<BrandKit> => {
  const response = await apiClient.put("/ai/brand-kit", update);
  return (response.data.data || response.data) as BrandKit;
};

export interface LogoColorSuggestion {
  primaryColorHex: string | null;
  secondaryColorHex: string | null;
  description: string | null;
}

/** Phase 4 vision — extract a suggested brand palette from a logo image URL. */
export const analyzeLogo = async (
  logoUrl: string
): Promise<LogoColorSuggestion> => {
  const response = await apiClient.post("/ai/brand-kit/analyze-logo", {
    logoUrl,
  });
  return (response.data.data || response.data) as LogoColorSuggestion;
};

/** The fuller brand-profile read behind the Branding Studio "AI Brand Analysis"
 *  step — colors plus personality/industry/tone and a suggested style + headline.
 *  Pass no logoUrl to analyze the shop's effective logo. Any field may be null. */
export interface BrandProfileSuggestion {
  primaryColorHex: string | null;
  secondaryColorHex: string | null;
  description: string | null;
  brandPersonality: string | null;
  industryStyle: string | null;
  recommendedTone: string | null;
  marketingStyle: string | null;
  headline: string | null;
}

export const analyzeBrand = async (
  logoUrl?: string
): Promise<BrandProfileSuggestion> => {
  const response = await apiClient.post(
    "/ai/brand-kit/analyze-brand",
    { logoUrl: logoUrl ?? undefined },
    { timeout: 120000 }
  );
  return (response.data.data || response.data) as BrandProfileSuggestion;
};

/** Branding Studio — stamp onboarding as finished/skipped (idempotent). */
export const completeBrandOnboarding = async (): Promise<BrandKit> => {
  const response = await apiClient.post("/ai/brand-kit/complete-onboarding");
  return (response.data.data || response.data) as BrandKit;
};

/* ------------------------- Brand templates (Phase 4) ------------------------ */

export type TemplateKind = "social_post" | "social_story" | "poster";

export interface BrandTemplate {
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

/** Curated Google-font pairing per marketing style — mirrors the backend
 *  fontPairForStyle so the style guide/wizard can preview without a round-trip. */
export const FONT_PAIRS: Record<string, { heading: string; body: string }> = {
  "Professional & Corporate": { heading: "Montserrat", body: "Source Sans 3" },
  "Modern & Tech": { heading: "Space Grotesk", body: "Inter" },
  "Friendly & Local": { heading: "Poppins", body: "Nunito" },
  "Premium & Luxury": { heading: "Playfair Display", body: "Lato" },
};
export const fontPairForStyle = (style: string | null) =>
  (style && FONT_PAIRS[style]) || { heading: "Poppins", body: "Inter" };

/** The four marketing styles (single source for the wizard + settings select). */
export const MARKETING_STYLE_OPTIONS = [
  "Professional & Corporate",
  "Modern & Tech",
  "Friendly & Local",
  "Premium & Luxury",
];

/** Generate brand templates on demand (defaults to all kinds). Throws with the
 *  server message on a gate (403 = AI images off, 429 = budget exhausted). */
export const generateBrandTemplates = async (
  kinds?: TemplateKind[],
  prompt?: string
): Promise<GenerateTemplateResult[]> => {
  // gpt-image-1 is slow (~20-80s each) and "generate all" runs up to 3 in series,
  // so override the 30s axios default (backend allows 240s for these paths).
  // `prompt` lets the shop steer the content (optional).
  const response = await apiClient.post(
    "/ai/brand-kit/templates/generate",
    { kinds, prompt },
    { timeout: 240000 }
  );
  const data = (response.data.data || response.data) as { results: GenerateTemplateResult[] };
  return data.results;
};

/** List the shop's generated templates (newest first). */
export const listBrandTemplates = async (): Promise<BrandTemplate[]> => {
  const response = await apiClient.get("/ai/brand-kit/templates");
  return (response.data.data || response.data) as BrandTemplate[];
};

/** Hard-delete one generated template (removes the image from storage + the row).
 *  Shop-scoped server-side. Throws on failure (e.g. 404 if not the shop's own). */
export const deleteBrandTemplate = async (id: number): Promise<void> => {
  await apiClient.delete(`/ai/brand-kit/templates/${id}`);
};

/** Generate a shop banner (header) with AI; returns the image URL. The caller
 *  persists it as the shop banner (shops.banner_url) via updateShopProfile.
 *  Throws with the server message on a gate (403 AI off / 429 budget). */
export const generateShopBanner = async (prompt?: string): Promise<string> => {
  // A wide gpt-image-1 banner has been observed up to ~80s — well past the 30s
  // axios default (backend allows 240s for this path). `prompt` steers the content.
  const response = await apiClient.post(
    "/ai/brand-kit/generate-banner",
    { prompt },
    { timeout: 240000 }
  );
  const data = (response.data.data || response.data) as { url: string };
  return data.url;
};
