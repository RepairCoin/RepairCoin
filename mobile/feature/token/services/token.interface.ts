/**
 * Merged token feature types
 * Combined from: redeem-token, buy-token, gift-token, reward-token, history
 */

import { CustomerTier } from "@/feature/customer/profile/types";
import { BaseResponse } from "@/shared/interfaces/base.interface";
import { RedemptionSession } from "@/feature/shop/services/shop.interface";

// ─── Redeem Token Types ──────────────────────────────────────────────────────

/**
 * Cross-shop redemption limits
 * - Home shop (where customer earned RCN): 100% redemption allowed
 * - Other shops: max 20% of lifetime earnings
 */
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

export type SessionStatus = "idle" | "waiting" | "processing" | "completed";

export interface HowItWorksItem {
  icon: string;
  title: string;
  desc: string;
}

// ─── Buy Token Types ─────────────────────────────────────────────────────────

/** Response from Stripe checkout session creation */
export interface StripeCheckoutResponse {
  data: {
    checkoutUrl: string;
    sessionId: string;
    purchaseId: string;
    amount: number;
    totalCost: number;
  };
}

// ─── Gift Token Types ────────────────────────────────────────────────────────

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

// ─── History Types ───────────────────────────────────────────────────────────

// Shop filters
export type StatusFilter = "all" | "pending" | "completed" | "failed";

// Customer filters
export type TransactionFilter = "all" | "earned" | "redeemed" | "gifts";

// Common filters
export type DateFilter = "all" | "today" | "week" | "month";
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
  paymentMethod: string;
  totalCost: number;
  status: string;
  completedAt?: string;
};
export type Props = CustomerTransactionProps | ShopTransactionProps;

// ─── API Data Types (from shared) ───────────────────────────────────────────

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

// ─── API Response Types ─────────────────────────────────────────────────────

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
