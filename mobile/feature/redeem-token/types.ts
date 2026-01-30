export type CustomerTier = "GOLD" | "SILVER" | "BRONZE";

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
