import { BaseResponse } from "./base.interface";

export interface RedemptionSessionData {
  sessionId: string;
  expiresAt: string;
  qrCode?: string;
}

export interface CreateRedemptionSessionRequest {
  customerAddress: string;
  shopId: string;
  amount: number;
}

export interface RedemptionSession {
  sessionId: string;
  customerAddress: string;
  shopId: string;
  amount?: number;
  maxAmount?: number;
  status:
    | "pending"
    | "approved"
    | "rejected"
    | "processing"
    | "completed"
    | "expired"
    | "used";
  qrCode?: string;
  expiresAt: string;
  createdAt: string;
  approvedAt?: string;
  usedAt?: string;
  updatedAt: string;
  metadata?: {
    cancelledByShop?: boolean;
  };
}

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

export interface CreateRedemptionSessionResponse extends BaseResponse<RedemptionSessionData> {}
export interface RedemptionSessionStatusResponse extends BaseResponse<RedemptionSession> {}
export interface MyRedemptionSessionsResponse {
  success: boolean;
  sessions: RedemptionSession[];
  pendingCount: number;
}
export interface GiftTokenResponse extends BaseResponse<GiftTokenData> {}
export interface ValidateTransferResponse extends BaseResponse<ValidateTransferData> {}
export interface TransferHistoryResponse extends BaseResponse<TransferHistoryData> {}
export interface BalanceResponse extends BaseResponse<BalanceData> {}
