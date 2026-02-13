// frontend/src/services/api/noShow.ts
import apiClient from './client';

export interface CustomerNoShowStatus {
  customerAddress: string;
  noShowCount: number;
  tier: 'normal' | 'warning' | 'caution' | 'deposit_required' | 'suspended';
  depositRequired: boolean;
  lastNoShowAt?: string;
  bookingSuspendedUntil?: string;
  successfulAppointmentsSinceTier3: number;
  canBook: boolean;
  requiresDeposit: boolean;
  minimumAdvanceHours: number;
  restrictions: string[];
}

export interface NoShowHistoryEntry {
  id: string;
  customerAddress: string;
  orderId: string;
  serviceId: string;
  shopId: string;
  scheduledTime: string;
  markedNoShowAt: string;
  markedBy?: string;
  notes?: string;
  gracePeriodMinutes: number;
  customerTierAtTime?: string;
  disputed: boolean;
  disputeStatus?: 'pending' | 'approved' | 'rejected';
  disputeReason?: string;
  disputeSubmittedAt?: string;
  disputeResolvedAt?: string;
  createdAt: string;
}

/**
 * Get customer's no-show status for a specific shop
 */
export const getCustomerNoShowStatus = async (
  customerAddress: string,
  shopId: string
): Promise<CustomerNoShowStatus> => {
  const response = await apiClient.get(`/customers/${customerAddress}/no-show-status`, {
    params: { shopId }
  });
  return response.data.data;
};

/**
 * Get customer's overall no-show status (shop-agnostic)
 * This endpoint does not require a shopId and returns the customer's global tier
 * Perfect for dashboard and settings pages
 */
export const getOverallCustomerNoShowStatus = async (
  customerAddress: string
): Promise<CustomerNoShowStatus> => {
  const response = await apiClient.get(`/customers/${customerAddress}/overall-no-show-status`);
  return response.data.data;
};

/**
 * Get customer's no-show history
 */
export const getCustomerNoShowHistory = async (
  customerAddress: string,
  limit: number = 10
): Promise<NoShowHistoryEntry[]> => {
  const response = await apiClient.get(`/customers/${customerAddress}/no-show-history`, {
    params: { limit }
  });
  return response.data.data.history;
};

/**
 * Get tier color for UI display
 */
export const getTierColor = (tier: CustomerNoShowStatus['tier']): string => {
  const colors = {
    normal: 'bg-green-500',
    warning: 'bg-yellow-500',
    caution: 'bg-orange-500',
    deposit_required: 'bg-red-500',
    suspended: 'bg-gray-500'
  };
  return colors[tier];
};

/**
 * Get tier label for display
 */
export const getTierLabel = (tier: CustomerNoShowStatus['tier']): string => {
  const labels = {
    normal: 'Good Standing',
    warning: 'Warning',
    caution: 'Caution',
    deposit_required: 'Deposit Required',
    suspended: 'Suspended'
  };
  return labels[tier];
};

/**
 * Get tier icon
 */
export const getTierIcon = (tier: CustomerNoShowStatus['tier']): string => {
  const icons = {
    normal: '✓',
    warning: '⚠️',
    caution: '⚠️',
    deposit_required: '🚨',
    suspended: '🛑'
  };
  return icons[tier];
};

// ==================== SHOP POLICY API ====================

export interface NoShowPolicy {
  shopId: string;
  enabled: boolean;
  gracePeriodMinutes: number;
  minimumCancellationHours: number;
  autoDetectionEnabled: boolean;
  autoDetectionDelayHours: number;

  // Penalty Tiers
  cautionThreshold: number;
  cautionAdvanceBookingHours: number;
  depositThreshold: number;
  depositAmount: number;
  depositAdvanceBookingHours: number;
  depositResetAfterSuccessful: number;
  maxRcnRedemptionPercent: number;
  suspensionThreshold: number;
  suspensionDurationDays: number;

  // Notifications
  sendEmailTier1: boolean;
  sendEmailTier2: boolean;
  sendEmailTier3: boolean;
  sendEmailTier4: boolean;
  sendSmsTier2: boolean;
  sendSmsTier3: boolean;
  sendSmsTier4: boolean;
  sendPushNotifications: boolean;

  // Disputes
  allowDisputes: boolean;
  disputeWindowDays: number;
  autoApproveFirstOffense: boolean;
  requireShopReview: boolean;
}

/**
 * Get shop's no-show policy configuration
 */
export const getShopNoShowPolicy = async (shopId: string): Promise<NoShowPolicy> => {
  const response = await apiClient.get(`/services/shops/${shopId}/no-show-policy`);
  return response.data.data;
};

/**
 * Update shop's no-show policy configuration
 */
export const updateShopNoShowPolicy = async (
  shopId: string,
  policy: Partial<NoShowPolicy>
): Promise<NoShowPolicy> => {
  const response = await apiClient.put(`/services/shops/${shopId}/no-show-policy`, policy);
  return response.data.data;
};
