import { BaseResponse } from "@/shared/interfaces/base.interface";

export type SessionStatus = "idle" | "waiting" | "processing" | "completed";
export type Props = CustomerTransactionProps | ShopTransactionProps;
export type StatusFilter = "all" | "pending" | "completed" | "failed";
export type TransactionFilter = "all" | "earned" | "redeemed" | "gifts";
export type DateFilter = "all" | "today" | "week" | "month";
export type ShopTransactionType = "reward" | "redemption" | "purchase";
export type ShopTransactionTypeFilter = "all" | ShopTransactionType;
export type CustomerTransactionProps = {
  variant: "customer";
  type: string;
  amount: number;
  shopName?: string;
  description: string;
  createdAt: string;
};
export type ShopTransactionProps = {
  variant: "shop";
  amount: number;
  createdAt: string;
  status: string;
  // reward | redemption | purchase (falls back to the raw type for anything else)
  type?: string;
  customerAddress?: string | null;
  customerName?: string | null;
  repairAmount?: number | null;
  isTierBonus?: boolean;
  failureReason?: string | null;
  // purchase-only fields
  paymentMethod?: string;
  totalCost?: number;
  completedAt?: string;
};

export interface RedemptionSession {
  sessionId: string;
  customerAddress: string;
  shopId: string;
  amount?: number;
  maxAmount?: number;
  status: "pending" | "approved" | "rejected" | "processing" | "completed" | "expired" | "used";
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  usedAt?: string;
  qrCode?: string;
  metadata?: {
    cancelledByShop?: boolean;
  };
}

export interface RedemptionCallbacks {
  onSessionCreated?: (session: RedemptionSession) => void;
  onSessionApproved?: (session: RedemptionSession) => void;
  onSessionRejected?: (session: RedemptionSession) => void;
  onSessionExpired?: (session: RedemptionSession) => void;
  onRedemptionComplete?: (data: any) => void;
  onError?: (error: Error) => void;
}

export interface CrossShopBalance {
  totalRedeemableBalance: number;
  crossShopLimit: number; // 20% of lifetime earnings
  availableForCrossShop: number;
  homeShopBalance: number; // 80% that can only be used at earning shops
}

export interface CreateRedemptionSessionRequest {
  customerAddress: string;
  shopId: string;
  amount: number;
}

export interface VerifyRedemptionRequest {
  customerAddress: string;
  shopId: string;
  amount: number;
}

// Authoritative redemption verification returned by the backend.
// Mirrors the data the web app uses to render the home/cross-shop badge.
export interface RedemptionVerification {
  canRedeem: boolean;
  message?: string;
  isHomeShop: boolean;
  maxRedeemable: number;
  crossShopLimit: number;
  availableBalance: number;
}

export interface HowItWorksItem {
  icon: string;
  title: string;
  desc: string;
}

export interface StripeCheckoutResponse {
  data: {
    checkoutUrl: string;
    sessionId: string;
    purchaseId: string;
    amount: number;
    totalCost: number;
  };
}

export interface ValidationResult {
  valid: boolean;
  recipientExists?: boolean;
}

export interface GiftTokenFormData {
  recipientAddress: string;
  amount: string;
  message: string;
}

export interface TransferParams {
  fromAddress: string;
  toAddress: string;
  amount: number;
  message?: string;
  transactionHash: string;
}

export interface ValidateTransferParams {
  fromAddress: string;
  toAddress: string;
  amount: number;
}

export interface RedemptionSessionData {
  sessionId: string;
  expiresAt: string;
  qrCode: string;
}

export interface GiftTokenRequest {
  fromAddress: string;
  toAddress: string;
  amount: number;
  message: string;
  transactionHash: string;
}

export interface GiftTokenData {
  transferId: string;
  fromAddress: string;
  toAddress: string;
  amount: number;
  message: string;
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
  senderBalance: number;
  recipientExists: boolean;
}

export interface TransferRecord {
  id: string;
  type: string;
  amount: number;
  direction: string;
  otherParty: string;
  message: string;
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

export interface MyRedemptionSessionsResponse {
  success: boolean;
  sessions: RedemptionSession[];
  pendingCount: number;
}

export interface ApprovalRequest {
  sessionId: string;
  signature: string;
  transactionHash?: string;
}

export interface PurchaseHistoryData {
  amount: number,
  completedAt: string,
  createdAt: string,
  id: number,
  paymentMethod: string,
  paymentReference: string,
  pricePerRcn: null,
  shopId: string,
  status: string,
  totalCost: number
}

export interface PurchaseHistory {
  purchases: PurchaseHistoryData[];
  total: number;
  totalPages: number;
}

// Unified shop transaction (rewards issued, redemptions processed, RCN purchases)
export interface ShopTransactionData {
  id: number | string;
  type: string; // reward | redemption | purchase
  amount: number;
  customerAddress: string | null;
  customerName: string | null;
  repairAmount?: number | null;
  status: string;
  createdAt: string;
  failureReason?: string | null;
  is_tier_bonus?: boolean;
  // purchase-only
  totalCost?: number;
  paymentMethod?: string;
  paymentReference?: string;
}

export interface ShopTransactionHistory {
  transactions: ShopTransactionData[];
  total: number;
  totalPages: number;
  page: number;
}

export interface ShopTransactionHistoryResponse
  extends BaseResponse<ShopTransactionHistory> {}

export interface PurchaseHistoryResponse extends BaseResponse<PurchaseHistory> {}
export interface CreateRedemptionSessionResponse extends BaseResponse<RedemptionSessionData> {}
export interface RedemptionSessionStatusResponse extends BaseResponse<RedemptionSession> {}
export interface GiftTokenResponse extends BaseResponse<GiftTokenData> {}
export interface ValidateTransferResponse extends BaseResponse<ValidateTransferData> {}
export interface TransferHistoryResponse extends BaseResponse<TransferHistoryData> {}
export interface BalanceResponse extends BaseResponse<BalanceData> {}
