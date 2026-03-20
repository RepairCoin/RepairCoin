import apiClient from './client';

// Types
export interface BlockedCustomer {
  id: string;
  shopId: string;
  customerId: string;
  customerWalletAddress: string;
  customerName: string;
  customerEmail?: string;
  reason: string;
  blockedAt: string;
  blockedBy: string;
}

export interface BlockCustomerData {
  customerWalletAddress: string;
  reason: string;
}

export interface ReportIssueData {
  category: 'spam' | 'fraud' | 'inappropriate_review' | 'harassment' | 'other';
  description: string;
  relatedEntityType?: 'customer' | 'review' | 'order';
  relatedEntityId?: string;
  severity: 'low' | 'medium' | 'high';
}

export interface Report {
  id: string;
  shopId: string;
  category: string;
  description: string;
  severity: string;
  status: 'pending' | 'investigating' | 'resolved' | 'dismissed';
  createdAt: string;
  resolvedAt?: string;
}

export interface FlaggedReview {
  id: string;
  reviewId: string;
  shopId: string;
  reason: string;
  status: 'pending' | 'approved' | 'removed';
  flaggedAt: string;
}

// Block Customer Management
export const getBlockedCustomers = async (shopId: string): Promise<BlockedCustomer[]> => {
  try {
    const response = await apiClient.get<BlockedCustomer[]>(`/shops/${shopId}/moderation/blocked-customers`);
    return response.data || [];
  } catch (error) {
    console.error('Error fetching blocked customers:', error);
    throw error;
  }
};

export const blockCustomer = async (shopId: string, data: BlockCustomerData): Promise<BlockedCustomer> => {
  try {
    const response = await apiClient.post<BlockedCustomer>(`/shops/${shopId}/moderation/block-customer`, data);
    return response.data;
  } catch (error) {
    console.error('Error blocking customer:', error);
    throw error;
  }
};

export const unblockCustomer = async (shopId: string, customerWalletAddress: string): Promise<void> => {
  try {
    await apiClient.delete(`/shops/${shopId}/moderation/blocked-customers/${customerWalletAddress}`);
  } catch (error) {
    console.error('Error unblocking customer:', error);
    throw error;
  }
};

// Report Management
export const submitReport = async (shopId: string, data: ReportIssueData): Promise<Report> => {
  try {
    const response = await apiClient.post<Report>(`/shops/${shopId}/moderation/reports`, data);
    return response.data;
  } catch (error) {
    console.error('Error submitting report:', error);
    throw error;
  }
};

export const getReports = async (shopId: string): Promise<Report[]> => {
  try {
    const response = await apiClient.get<Report[]>(`/shops/${shopId}/moderation/reports`);
    return response.data || [];
  } catch (error) {
    console.error('Error fetching reports:', error);
    throw error;
  }
};

// Review Moderation
export const flagReview = async (shopId: string, reviewId: string, reason: string): Promise<FlaggedReview> => {
  try {
    const response = await apiClient.post<FlaggedReview>(`/shops/${shopId}/moderation/flag-review`, {
      reviewId,
      reason,
    });
    return response.data;
  } catch (error) {
    console.error('Error flagging review:', error);
    throw error;
  }
};

export const getFlaggedReviews = async (shopId: string): Promise<FlaggedReview[]> => {
  try {
    const response = await apiClient.get<FlaggedReview[]>(`/shops/${shopId}/moderation/flagged-reviews`);
    return response.data || [];
  } catch (error) {
    console.error('Error fetching flagged reviews:', error);
    throw error;
  }
};
