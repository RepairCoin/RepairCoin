// frontend/src/services/api/welcomeRcn.ts
//
// Shop-side "Welcome RCN on claim" settings. The one-time RCN reward a shop grants when an
// imported/migrated customer (e.g. from Square) claims their account — the win-back conversion
// incentive. Shop-funded + opt-in; off-chain credit. Backed by /api/shops/welcome-rcn.
// `featureEnabled` reflects the platform kill-switch (ENABLE_WELCOME_RCN); when false the
// shop's toggle has no effect and the UI says so.

import apiClient from './client';

export interface WelcomeRcnSettings {
  featureEnabled: boolean;
  enabled: boolean;
  amount: number | null; // per-shop override; null = use defaultAmount
  defaultAmount: number;
  effectiveAmount: number;
}

export const getWelcomeRcnSettings = async (): Promise<WelcomeRcnSettings> => {
  const res = await apiClient.get('/shops/welcome-rcn');
  return res.data.data ?? res.data;
};

export const updateWelcomeRcnSettings = async (input: {
  enabled?: boolean;
  amount?: number | null;
}): Promise<WelcomeRcnSettings> => {
  const res = await apiClient.put('/shops/welcome-rcn', input);
  return res.data.data ?? res.data;
};
