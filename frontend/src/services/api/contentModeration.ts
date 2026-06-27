// frontend/src/services/api/contentModeration.ts
//
// AI Content Moderation (Admin AI #5) — flag inappropriate listings/reviews.

import apiClient from "./client";

export interface FlaggedContent {
  type: "service" | "review";
  id: string;
  shopId: string | null;
  snippet: string;
  categories: string[];
}

export interface ContentModerationResult {
  generatedAt: string;
  scannedServices: number;
  scannedReviews: number;
  flagged: FlaggedContent[];
}

export async function scanContent(
  refresh = false
): Promise<ContentModerationResult | null> {
  const res = await apiClient.get<{ data?: ContentModerationResult }>(
    "/admin/content-moderation/scan",
    { params: refresh ? { refresh: "true" } : {} }
  );
  return res.data ?? null;
}

export async function deactivateFlaggedService(serviceId: string): Promise<void> {
  await apiClient.post(`/admin/content-moderation/service/${serviceId}/deactivate`);
}
