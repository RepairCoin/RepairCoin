export type CustomerTier = "GOLD" | "SILVER" | "BRONZE";

export interface CustomerRedemptionData {
  address: string;
  tier: CustomerTier;
  balance: number;
  lifetimeEarnings: number;
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
