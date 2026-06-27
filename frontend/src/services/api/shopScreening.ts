// frontend/src/services/api/shopScreening.ts
//
// Shop Approval Assistant (Admin AI #3) — AI screening for a pending shop.

import apiClient from "./client";

export interface ShopScreening {
  shopId: string;
  riskLevel: "low" | "medium" | "high";
  recommendation: "approve" | "review" | "reject";
  summary: string;
  legitimacySignals: string[];
  riskFlags: string[];
  signals: Record<string, unknown>;
  generatedAt: string;
}

export async function getShopScreening(
  shopId: string,
  refresh = false
): Promise<ShopScreening | null> {
  const res = await apiClient.get<{ data?: ShopScreening }>(
    `/admin/shops/${shopId}/ai-screening`,
    { params: refresh ? { refresh: "true" } : {} }
  );
  return res.data ?? null;
}
