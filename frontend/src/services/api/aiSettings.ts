// frontend/src/services/api/aiSettings.ts
//
// Shop-side AI Sales Agent settings. Backed by GET/PUT /api/ai/settings.
// The PUT only carries the shop-editable fields — the admin-gated fields
// (ai/follow-up enablement, budget) are read-only here.

import apiClient from './client';

export interface ShopAiSettings {
  // Admin-gated — read-only for the shop
  aiGlobalEnabled: boolean;
  aiFollowupEnabled: boolean;
  monthlyBudgetUsd: number;
  currentMonthSpendUsd: number;
  // Shop-editable
  escalationThreshold: number;
  aiFollowupDelayMinutes: number;
  humanReplyBaselineMinutes: number;
  /** Phase 6 branding — unified assistant display name; null when unset. */
  assistantName?: string | null;
}

/** Partial update — any subset; the backend skips columns that are absent. */
export interface ShopAiSettingsUpdate {
  escalationThreshold?: number;
  aiFollowupDelayMinutes?: number;
  humanReplyBaselineMinutes?: number;
  /** Trimmed name; empty/null clears it. */
  assistantName?: string | null;
}

/** Bounds the UI enforces; the backend validates the same ranges. */
export const AI_SETTINGS_BOUNDS = {
  escalationThreshold: { min: 1, max: 20 },
  aiFollowupDelayMinutes: { min: 15, max: 30 },
  humanReplyBaselineMinutes: { min: 15, max: 1440 },
} as const;

/** Fetch the requesting shop's AI settings snapshot. */
export const getShopAiSettings = async (): Promise<ShopAiSettings> => {
  const response = await apiClient.get('/ai/settings');
  return response.data.data || response.data;
};

/** Update the shop-editable AI settings. Returns the fresh full snapshot. */
export const updateShopAiSettings = async (
  update: ShopAiSettingsUpdate
): Promise<ShopAiSettings> => {
  const response = await apiClient.put('/ai/settings', update);
  return response.data.data || response.data;
};

/** Phase 6 branding — set or clear just the assistant's display name. */
export const updateAssistantName = async (
  name: string | null
): Promise<ShopAiSettings> => updateShopAiSettings({ assistantName: name });

// ---- Admin gate ----

/** One shop's AI settings as the admin gate view sees it. */
export interface AdminShopAiSettings extends ShopAiSettings {
  shopId: string;
  shopName: string;
}

/** The admin-editable gate fields — a partial update. */
export interface AdminShopAiSettingsUpdate {
  aiGlobalEnabled?: boolean;
  aiFollowupEnabled?: boolean;
  monthlyBudgetUsd?: number;
}

/** Admin-side monthly budget bounds (backend validates the same). */
export const ADMIN_BUDGET_BOUNDS = { min: 0, max: 1000 } as const;

/** List every shop's AI settings (admin only). */
export const listAdminShopAiSettings = async (): Promise<AdminShopAiSettings[]> => {
  const response = await apiClient.get('/ai/admin/shop-settings');
  return response.data.data || response.data || [];
};

/** Set the gate fields for one shop (admin only). Returns the fresh row. */
export const adminUpdateShopAiSettings = async (
  shopId: string,
  update: AdminShopAiSettingsUpdate
): Promise<AdminShopAiSettings> => {
  const response = await apiClient.put(
    `/ai/admin/shop-settings/${encodeURIComponent(shopId)}`,
    update
  );
  return response.data.data || response.data;
};
