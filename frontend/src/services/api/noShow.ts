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

// ==================== DISPUTE API ====================

export interface DisputeEntry extends NoShowHistoryEntry {
  disputeResolvedBy?: string;
  disputeResolutionNotes?: string;
  serviceName?: string;
  shopName?: string;
  customerName?: string;
  customerEmail?: string;
}

export interface DisputeListResponse {
  disputes: DisputeEntry[];
  total: number;
  pendingCount: number;
}

export interface AdminDisputeStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

export interface AdminDisputeListResponse {
  disputes: DisputeEntry[];
  stats: AdminDisputeStats;
}

/**
 * Customer submits a dispute for a no-show record
 */
export const submitDispute = async (
  orderId: string,
  reason: string
): Promise<{ dispute: DisputeEntry; autoApproved: boolean; message: string }> => {
  const response = await apiClient.post(`/services/orders/${orderId}/dispute`, { reason });
  return {
    dispute: response.data.data,
    autoApproved: response.data.autoApproved,
    message: response.data.message
  };
};

/**
 * Get dispute status for an order
 */
export const getDisputeStatus = async (orderId: string): Promise<DisputeEntry> => {
  const response = await apiClient.get(`/services/orders/${orderId}/dispute`);
  return response.data.data;
};

/**
 * Get all disputes for a shop
 */
export const getShopDisputes = async (
  shopId: string,
  status?: 'pending' | 'approved' | 'rejected' | 'all',
  limit?: number,
  offset?: number
): Promise<DisputeListResponse> => {
  const response = await apiClient.get(`/services/shops/${shopId}/disputes`, {
    params: { status, limit, offset }
  });
  return response.data.data;
};

/**
 * Shop approves a dispute
 */
export const approveDispute = async (
  shopId: string,
  disputeId: string,
  resolutionNotes?: string
): Promise<DisputeEntry> => {
  const response = await apiClient.put(`/services/shops/${shopId}/disputes/${disputeId}/approve`, {
    resolutionNotes
  });
  return response.data.data;
};

/**
 * Shop rejects a dispute
 */
export const rejectDispute = async (
  shopId: string,
  disputeId: string,
  resolutionNotes: string
): Promise<DisputeEntry> => {
  const response = await apiClient.put(`/services/shops/${shopId}/disputes/${disputeId}/reject`, {
    resolutionNotes
  });
  return response.data.data;
};

/**
 * Admin: Get all disputes across platform
 */
export const getAdminDisputes = async (
  status?: 'pending' | 'approved' | 'rejected' | 'all',
  shopId?: string,
  limit?: number,
  offset?: number
): Promise<AdminDisputeListResponse> => {
  const response = await apiClient.get(`/services/admin/disputes`, {
    params: { status, shopId, limit, offset }
  });
  return response.data.data;
};

/**
 * Admin: Resolve a dispute (arbitration)
 */
export const adminResolveDispute = async (
  disputeId: string,
  resolution: 'approved' | 'rejected',
  resolutionNotes: string
): Promise<DisputeEntry> => {
  const response = await apiClient.put(`/services/admin/disputes/${disputeId}/resolve`, {
    resolution,
    resolutionNotes
  });
  return response.data.data;
};
