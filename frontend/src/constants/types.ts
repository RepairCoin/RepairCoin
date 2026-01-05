// User and Authentication Types
export interface User {
  address: string;
  role: 'admin' | 'shop' | 'customer';
  isActive?: boolean;
  createdAt?: string;
  suspended?: boolean;
  suspendedAt?: string;
  suspensionReason?: string;
}

export interface AuthToken {
  token: string;
  expiresIn?: number;
  refreshToken?: string;
  user?: {
    id: string;
    address: string;
    walletAddress?: string;
    name?: string;
    role: string;
    tier?: string;
    active?: boolean;
    suspended?: boolean;
    suspendedAt?: string;
    suspensionReason?: string;
    createdAt?: string;
    shopId?: string;
    shopName?: string;
    email?: string;
    verified?: boolean;
  };
}

// Customer Types
export interface Customer {
  id?: number;
  address: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  referralCode?: string;
  referredBy?: string;
  tier: 'BRONZE' | 'SILVER' | 'GOLD';
  lifetimeEarnings: number;
  availableBalance?: number;
  currentBalance?: number;
  homeShopId?: string;
  homeShopName?: string;
  isActive: boolean;
  joinDate?: string;
  lastEarnedDate?: string;
  lastEarnedAmount?: number;
  referralCount?: number;
  suspensionReason?: string;
  suspensionDate?: string;
  dailyEarnings?: number;
  monthlyEarnings?: number;
  totalRedemptions?: number;
}

// Shop Types
export interface Shop {
  id: string;
  walletAddress: string;
  ownerFirstName?: string;
  ownerLastName?: string;
  ownerPhone?: string;
  ownerEmail?: string;
  companyName: string;
  companySize?: string;
  monthlyRevenue?: string;
  role?: string;
  websiteUrl?: string;
  streetAddress?: string;
  city?: string;
  country?: string;
  isVerified: boolean;
  isActive: boolean;
  joinDate?: string;
  rcnBalance?: number;
  purchasedRcnBalance?: number;
  totalCustomers?: number;
  totalTransactions?: number;
  totalRcnIssued?: number;
  totalRcnRedeemed?: number;
  crossShopEnabled?: boolean;
  referralSource?: string;
  verificationDate?: string;
  verifiedBy?: string;
  suspensionReason?: string;
  suspensionDate?: string;
}

// Transaction Types
export interface Transaction {
  id: string | number;
  type: 'earned' | 'redeemed' | 'bonus' | 'referral' | 'mint' | 'purchase' | 'redemption';
  amount: number;
  shopId?: string;
  shopName?: string;
  customerAddress?: string;
  customerName?: string;
  description?: string;
  date?: string;
  createdAt?: string;
  status?: 'completed' | 'pending' | 'failed';
  txHash?: string;
  details?: any;
}

// Referral Types
export interface ReferralData {
  code: string;
  totalReferrals: number;
  pendingRewards: number;
  earnedRewards: number;
  referrals: Referral[];
}

export interface Referral {
  id?: number;
  referrerAddress: string;
  referredAddress: string;
  referralCode: string;
  status: 'pending' | 'completed';
  rewardAmount?: number;
  completedAt?: string;
  createdAt: string;
}

// Balance Types
export interface BalanceData {
  totalEarned: number;
  availableBalance: number;
  homeShopBalance: number;
  crossShopBalance: number;
  pendingRewards: number;
  marketBalance?: number;
  onChainBalance?: number;
  breakdown: {
    repairs: number;
    referrals: number;
    bonuses: number;
  };
}

// Tier Bonus Types
export interface TierBonus {
  tier: 'BRONZE' | 'SILVER' | 'GOLD';
  bonusAmount: number;
  description: string;
}

export interface TierBonusPreview {
  baseReward: number;
  tierBonus: number;
  totalReward: number;
  currentTier: 'BRONZE' | 'SILVER' | 'GOLD';
  nextTier?: 'SILVER' | 'GOLD';
  progressToNext?: number;
}

// Shop Purchase Types
export interface ShopPurchase {
  id: number;
  shopId: string;
  shopName?: string;
  rcnAmount: number;
  totalCost: number;
  paymentMethod: 'crypto' | 'fiat' | 'bank_transfer';
  paymentReference?: string;
  status: 'pending' | 'completed' | 'failed';
  purchaseDate: string;
  completedAt?: string;
  txHash?: string;
}

export interface PurchaseSession {
  sessionId: string;
  shopId: string;
  rcnAmount: number;
  totalCost: number;
  expiresAt: string;
  status: 'pending' | 'completed' | 'expired';
}

// Redemption Types
export interface RedemptionSession {
  id: string;
  sessionId: string;
  shopId: string;
  shopName?: string;
  customerAddress: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  createdAt: string;
  expiresAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
}

// Admin Types
export interface AdminStats {
  totalCustomers: number;
  activeCustomers: number;
  totalShops: number;
  activeShops: number;
  verifiedShops: number;
  pendingShops: number;
  totalTransactions: number;
  totalTokensIssued: number;
  totalTokensRedeemed: number;
  platformRevenue?: number;
  activeCustomersLast30Days?: number;
  averageTransactionValue?: number;
  topPerformingShops?: Array<{
    shopId: string;
    name: string;
    totalTransactions: number;
  }>;
}

export interface TreasuryData {
  totalMinted: number;
  totalSoldToShops: number;
  totalRevenue: number;
  recentPurchases: ShopPurchase[];
}

export interface AdminAnalytics {
  overview: {
    period: string;
    metrics: {
      newCustomers: number;
      newShops: number;
      totalTransactions: number;
      totalVolume: number;
      growthRate: number;
    };
  };
  customerMetrics: {
    byTier: Record<'BRONZE' | 'SILVER' | 'GOLD', number>;
    acquisitionTrend: Array<{ date: string; count: number }>;
    retentionRate: number;
  };
  shopMetrics: {
    topShops: Array<{
      shopId: string;
      name: string;
      volume: number;
      customers: number;
    }>;
    averagePerformance: {
      rcnIssued: number;
      rcnRedeemed: number;
      customerCount: number;
    };
  };
  tokenMetrics: {
    circulation: number;
    velocity: number;
    burnRate: number;
    mintRate: number;
  };
}

// Webhook Types
export interface WebhookLog {
  id: number;
  eventType: string;
  payload: any;
  status: 'success' | 'failed' | 'pending';
  attempts: number;
  lastAttempt?: string;
  error?: string;
  createdAt: string;
}

// Cross-shop Types
export interface CrossShopVerification {
  canRedeem: boolean;
  maxRedeemable: number;
  isHomeShop: boolean;
  message?: string;
}

// Export Data Types
export interface CustomerExportData {
  profile: Customer;
  transactions: Transaction[];
  referrals: Referral[];
  earnings: BalanceData;
  exportDate: string;
  format: 'json' | 'csv' | 'pdf';
}

// Request Types
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
  orderBy?: string;
  order?: 'ASC' | 'DESC';
}

export interface FilterParams extends PaginationParams {
  search?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  type?: string;
}

// Notification Types
export interface NotificationPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  smsNotifications: boolean;
  marketingEmails?: boolean;
  transactionAlerts?: boolean;
  referralAlerts?: boolean;
}

// Appointment Reminder Notification Preferences
export interface AppointmentNotificationPreferences {
  id?: string;
  customerAddress: string;

  // Channel preferences
  emailEnabled: boolean;
  smsEnabled: boolean;
  inAppEnabled: boolean;

  // Reminder timing preferences
  reminder24hEnabled: boolean;
  reminder2hEnabled: boolean;
  reminder30mEnabled: boolean;

  // Quiet hours
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;

  createdAt?: Date;
  updatedAt?: Date;
}
