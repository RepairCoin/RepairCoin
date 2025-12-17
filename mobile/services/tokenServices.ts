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

// Gift Token / Transfer Interfaces
export interface GiftTokenRequest {
  fromAddress: string;
  toAddress: string;
  amount: number;
  message?: string;
  transactionHash: string;
}

export interface GiftTokenData {
  transferId: string;
  fromAddress: string;
  toAddress: string;
  amount: number;
  message?: string;
  transactionHash: string;
  timestamp: string;
  recipientWasNew: boolean;
}

export interface GiftTokenResponse {
  data: GiftTokenData;
  success: boolean;
}

export interface ValidateTransferRequest {
  fromAddress: string;
  toAddress: string;
  amount: number;
}

export interface ValidateTransferData {
  valid: boolean;
  message: string;
  senderBalance?: number;
  recipientExists?: boolean;
}

export interface ValidateTransferResponse {
  data: ValidateTransferData;
  success: boolean;
}

export interface TransferRecord {
  id: string;
  type: "transfer_in" | "transfer_out";
  amount: number;
  direction: "sent" | "received";
  otherParty: string;
  message?: string;
  transactionHash: string;
  timestamp: string;
  status: string;
}

export interface TransferHistoryData {
  transfers: TransferRecord[];
  total: number;
  limit: number;
  offset: number;
}

export interface TransferHistoryResponse {
  data: TransferHistoryData;
  success: boolean;
}

// Gift Token / Transfer Functions
export const transferToken = async (
  payload: GiftTokenRequest
): Promise<GiftTokenResponse> => {
  try {
    return await apiClient.post<GiftTokenResponse>("/tokens/transfer", payload);
  } catch (error: any) {
    console.error("Failed to transfer token:", error.message);
    throw error;
  }
};

export const validateTransfer = async (
  payload: ValidateTransferRequest
): Promise<ValidateTransferResponse> => {
  try {
    return await apiClient.post<ValidateTransferResponse>("/tokens/validate-transfer", payload);
  } catch (error: any) {
    console.error("Failed to validate transfer:", error.message);
    throw error;
  }
};

export const getTransferHistory = async (
  address: string,
  options?: { limit?: number; offset?: number }
): Promise<TransferHistoryResponse> => {
  try {
    const params = new URLSearchParams();
    if (options?.limit) params.append("limit", options.limit.toString());
    if (options?.offset) params.append("offset", options.offset.toString());

    const queryString = params.toString() ? `?${params.toString()}` : "";
    return await apiClient.get<TransferHistoryResponse>(
      `/tokens/transfer-history/${address}${queryString}`
    );
  } catch (error: any) {
    console.error("Failed to get transfer history:", error.message);
    throw error;
  }
};  