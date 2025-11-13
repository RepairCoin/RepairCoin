import apiClient from "@/utilities/axios";

// Interfaces
export interface BalanceData {
  availableBalance: number;
  lifetimeEarned: number;
  totalRedeemed: number;
  earningHistory?: {
    fromRepairs: number;
    fromReferrals: number;
    fromBonuses: number;
    fromTierBonuses: number;
  };
  homeShop?: string;
}

export interface BalanceResponse {
  data: BalanceData;
  success: boolean;
}

export interface RedemptionSession {
  sessionId: string;
  customerAddress?: string;
  shopId: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  qrCode?: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface RedemptionData {
  pendingCount: number;
  sessions: RedemptionSession[];
  success: boolean;
}

export interface RedemptionSessionsResponse {
  pendingCount: number;
  sessions: RedemptionSession[];
  success: boolean;
}

export const fetchTokenBalance = async (
  address: string
): Promise<BalanceResponse | null> => {
  try {
    return await apiClient.get<BalanceResponse>(`/tokens/balance/${address}`);
  } catch (error) {
    console.error("Failed to get tokens balance:", error);
    throw error;
  }
};

export const fetchMyRedemptionSessions = async (): Promise<RedemptionSessionsResponse> => {
  try {
    return await apiClient.get<RedemptionSessionsResponse>('/tokens/redemption-session/my-sessions');
  } catch (error) {
    console.error("Failed to fetch redemption sessions:", error);
    throw error;
  }
};

export const approvalRedemptionSession = async (
  sessionId: string,
  signature: string
) => {
  try {
    return await apiClient.post(`/tokens/redemption-session/approve`, {
      sessionId,
      signature,
    });
  } catch (error) {
    console.error("Failed to approve redemption session:", error);
    throw error;
  }
};

export const rejectRedemptionSession = async (
  sessionId: string,
) => {
  try {
    return await apiClient.post(`/tokens/redemption-session/reject`, { sessionId });
  } catch (error) {
    console.error("Failed to reject redemption session:", error);
    throw error;
  }
};  