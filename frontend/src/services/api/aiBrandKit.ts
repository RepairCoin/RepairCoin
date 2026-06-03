// frontend/src/services/api/aiBrandKit.ts
//
// Client for the per-shop Brand Kit (AI Image Generation Phase 3). Colors +
// tone + logo the AI applies to every generated image. GET/PUT /api/ai/brand-kit
// are shop-scoped via the JWT (no shopId param).

import apiClient from "./client";

export interface BrandKit {
  logoUrl: string | null;
  primaryColorHex: string | null;
  secondaryColorHex: string | null;
  toneNotes: string | null;
}

/** The shop's brand kit (all-null when unset). */
export const getBrandKit = async (): Promise<BrandKit> => {
  const response = await apiClient.get("/ai/brand-kit");
  // Axios interceptor pre-unwraps response.data; the `.data.data` form covers
  // an interceptor-bypass edge case (same pattern as the other ai services).
  return (response.data.data || response.data) as BrandKit;
};

/** Create or replace the shop's brand kit (full replace). */
export const updateBrandKit = async (update: BrandKit): Promise<BrandKit> => {
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
