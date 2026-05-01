/**
 * Merged token feature types
 * Combined from: redeem-token, buy-token, gift-token, reward-token, history
 */

import type { CustomerTier, CustomerData } from "@/shared/interfaces/customer.interface";
import { RepairType } from "../hooks/useShopRewards";

export type { CustomerTier, CustomerData, RepairType };

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

export interface CustomerRedemptionData {
  address: string;
  tier: CustomerTier;
  balance: number;
  lifetimeEarnings: number;
  // Cross-shop redemption fields
  isHomeShop: boolean; // True if customer has earned RCN at this shop
  maxRedeemable: number; // Maximum amount customer can redeem at this shop
  crossShopLimit: number; // 20% limit for cross-shop redemptions
}

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

export interface CreateRedemptionSessionRequest {
  customerAddress: string;
  shopId: string;
  amount: number;
}

export type SessionStatus = "idle" | "waiting" | "processing" | "completed";

export interface RedemptionCallbacks {
  onSessionCreated?: (session: RedemptionSession) => void;
  onSessionApproved?: (session: RedemptionSession) => void;
  onSessionRejected?: (session: RedemptionSession) => void;
  onSessionExpired?: (session: RedemptionSession) => void;
  onRedemptionComplete?: (data: any) => void;
  onError?: (error: Error) => void;
}

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

// ─── Reward Token Types ──────────────────────────────────────────────────────

export interface RepairOption {
  type: RepairType;
  label: string;
  rcn: number;
  description: string;
}

export interface PromoCode {
  id: string;
  code: string;
  name?: string;
  bonus_type: "fixed" | "percentage";
  bonus_value: number;
  is_active?: boolean;
  total_usage_limit?: number;
  times_used?: number;
  max_bonus?: number;
  valid_from?: string;
  valid_until?: string;
  start_date?: string;
  end_date?: string;
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
