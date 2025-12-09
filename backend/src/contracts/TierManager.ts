// contracts/TierManager.ts
import { createThirdwebClient, getContract, readContract } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";

export type TierLevel = "BRONZE" | "SILVER" | "GOLD";

export interface CustomerData {
  address: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  isActive: boolean;
  lifetimeEarnings: number;
  currentBalance?: number;
  tier: TierLevel;
  lastEarnedDate: string;
  referralCount: number;
  joinDate: string; 
  fixflowCustomerId?: string;
  suspendedAt?: string | null;
  suspensionReason?: string | null;
  referralCode?: string;
  referredBy?: string | null;
  // Enhanced balance tracking for hybrid database/blockchain system
  currentRcnBalance?: number;
  pendingMintBalance?: number;
  totalRedemptions?: number;
  lastBlockchainSync?: string | null;
}

// Single TierBenefits interface with all required properties
export interface TierBenefits {
  tier: TierLevel;
  multiplier: number;
  maxDailyEarnings: number;
  maxMonthlyEarnings: number;
  specialRewards: string[];
  crossShopRedemptionLimit: number;
  engagementMultiplier: number;
  minLifetimeEarnings: number;
  specialBenefits?: string[];
}

export interface EarningLimits {
  daily: number;
  monthly: number;
  perTransaction: number;
}

export class TierManager {
  private client: any;
  private contractAddress: string;
  
  // Business rules constants
  private readonly EARNING_LIMITS: EarningLimits = {
    daily: 999999,      // No daily limit
    monthly: 999999,    // No monthly limit
    perTransaction: 25  // 25 RCN max per single transaction
  };

  private readonly TIER_THRESHOLDS = {
    BRONZE: { min: 0, max: 199 },
    SILVER: { min: 200, max: 999 },
    GOLD: { min: 1000, max: Infinity }
  };

  constructor() {
    // Use RCN-specific env vars first, fall back to legacy if needed
    const clientId = process.env.RCN_THIRDWEB_CLIENT_ID || process.env.THIRDWEB_CLIENT_ID;
    const secretKey = process.env.RCN_THIRDWEB_SECRET_KEY || process.env.THIRDWEB_SECRET_KEY;
    
    if (!clientId || !secretKey) {
      throw new Error("Missing required Thirdweb credentials");
    }
    
    this.client = createThirdwebClient({
      clientId: clientId,
      secretKey: secretKey,
    });
    
    this.contractAddress = process.env.RCN_CONTRACT_ADDRESS || process.env.REPAIRCOIN_CONTRACT_ADDRESS!;
  }

  // Calculate customer tier based on lifetime earnings
  calculateTier(lifetimeEarnings: number): TierLevel {
    if (lifetimeEarnings >= this.TIER_THRESHOLDS.GOLD.min) return "GOLD";
    if (lifetimeEarnings >= this.TIER_THRESHOLDS.SILVER.min) return "SILVER";
    return "BRONZE";
  }

  // Get tier benefits information
  getTierBenefits(tier: TierLevel): TierBenefits {
    const benefitsMap: Record<TierLevel, TierBenefits> = {
      BRONZE: {
        tier: "BRONZE",
        multiplier: 1,
        maxDailyEarnings: 50,
        maxMonthlyEarnings: 500,
        specialRewards: ["Access to seasonal promotions"],
        crossShopRedemptionLimit: 100,  // 100% - no limit
        engagementMultiplier: 1,
        minLifetimeEarnings: 0,
        specialBenefits: ["Access to seasonal promotions"]
      },
      SILVER: {
        tier: "SILVER",
        multiplier: 2,
        maxDailyEarnings: 80,
        maxMonthlyEarnings: 1000,
        specialRewards: [
          "Priority repair queue at home shop",
          "Enhanced customer support", 
          "2x daily engagement bonus"
        ],
        crossShopRedemptionLimit: 100,  // 100% - no limit
        engagementMultiplier: 2,
        minLifetimeEarnings: 200,
        specialBenefits: [
          "Priority repair queue at home shop",
          "Enhanced customer support",
          "2x daily engagement bonus"
        ]
      },
      GOLD: {
        tier: "GOLD", 
        multiplier: 3,
        maxDailyEarnings: 120,
        maxMonthlyEarnings: 1500,
        specialRewards: [
          "VIP repair status across entire network",
          "Early access to giveaways and special events",
          "Premium features access",
          "3x daily engagement bonus"
        ],
        crossShopRedemptionLimit: 100,  // 100% - no limit
        engagementMultiplier: 3,
        minLifetimeEarnings: 1000,
        specialBenefits: [
          "VIP repair status across entire network", 
          "Early access to giveaways and special events",
          "Premium features access",
          "3x daily engagement bonus"
        ]
      }
    };

    return benefitsMap[tier];
  }

  // Get redemption limit based on tier (for cross-shop usage)
  getRedemptionLimit(tier: TierLevel): number {
    return this.getTierBenefits(tier).crossShopRedemptionLimit;
  }

  // Get engagement multiplier for ad interactions
  getEngagementMultiplier(tier: TierLevel): number {
    return this.getTierBenefits(tier).engagementMultiplier;
  }

  // Check if customer can earn more tokens today (NO LIMIT - always returns true)
  canEarnToday(customer: CustomerData, tokensToEarn: number): boolean {
    // No earning limits - always return true
    return true;
  }

  // Check monthly earning limit (NO LIMIT - always returns true)
  canEarnThisMonth(customer: CustomerData, tokensToEarn: number): boolean {
    // No earning limits - always return true
    return true;
  }

  // Check if earning amount is within per-transaction limit
  isValidTransactionAmount(tokensToEarn: number): boolean {
    return tokensToEarn > 0 && tokensToEarn <= this.EARNING_LIMITS.perTransaction;
  }

  // Update customer data after earning tokens
  updateCustomerAfterEarning(customer: CustomerData, tokensEarned: number): CustomerData {
    const today = new Date().toISOString();
    
    const newLifetimeEarnings = customer.lifetimeEarnings + tokensEarned;
    const newTier = this.calculateTier(newLifetimeEarnings);
    
    return {
      ...customer,
      lifetimeEarnings: newLifetimeEarnings,
      tier: newTier,
      lastEarnedDate: today
    };
  }

  // Check if customer can redeem at another shop
  canRedeemAtShop(customer: CustomerData, redemptionAmount: number, isHomeShop: boolean): {
    canRedeem: boolean;
    message?: string;
    maxRedemption?: number;
  } {
    // No cross-shop restrictions - customers can redeem at any shop
    return { canRedeem: true };
  }

  // Get customer's current earning capacity (NO LIMITS)
  getEarningCapacity(customer: CustomerData): {
    dailyRemaining: number;
    monthlyRemaining: number;
    canEarnToday: boolean;
    canEarnThisMonth: boolean;
  } {
    // No earning limits - return unlimited capacity
    return {
      dailyRemaining: Infinity,
      monthlyRemaining: Infinity,
      canEarnToday: true,
      canEarnThisMonth: true
    };
  }

  // Calculate tier progression
  getTierProgression(customer: CustomerData): {
    currentTier: TierLevel;
    nextTier?: TierLevel;
    tokensToNextTier?: number;
    progressPercentage: number;
  } {
    const currentTier = customer.tier;
    const earnings = customer.lifetimeEarnings;
    
    if (currentTier === "GOLD") {
      return {
        currentTier,
        progressPercentage: 100
      };
    }
    
    const nextTier = currentTier === "BRONZE" ? "SILVER" : "GOLD";
    const nextTierThreshold = this.TIER_THRESHOLDS[nextTier].min;
    const currentTierMin = this.TIER_THRESHOLDS[currentTier].min;
    const tokensToNextTier = nextTierThreshold - earnings;
    
    const tierRange = nextTierThreshold - currentTierMin;
    const earnedInTier = earnings - currentTierMin;
    const progressPercentage = Math.min(100, (earnedInTier / tierRange) * 100);
    
    return {
      currentTier,
      nextTier,
      tokensToNextTier: Math.max(0, tokensToNextTier),
      progressPercentage
    };
  }

  // Validate customer data integrity
  validateCustomerData(customer: CustomerData): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    // Check address format
    if (!this.isValidAddress(customer.address)) {
      errors.push("Invalid Ethereum address format");
    }
    
    // Check earnings consistency
    if (customer.lifetimeEarnings < 0) {
      errors.push("Lifetime earnings cannot be negative");
    }
    
    // No daily or monthly earning validations - removed per new requirements
    
    // Check tier consistency
    const calculatedTier = this.calculateTier(customer.lifetimeEarnings);
    if (customer.tier !== calculatedTier) {
      errors.push(`Tier mismatch: should be ${calculatedTier} based on ${customer.lifetimeEarnings} lifetime earnings`);
    }
    
    // Check date format
    if (!this.isValidDate(customer.lastEarnedDate) || !this.isValidDate(customer.joinDate)) {
      errors.push("Invalid date format");
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Get earning rules summary
  getEarningRules(): {
    repairRules: any;
    referralRules: any;
    limits: EarningLimits;
    tierThresholds: any;
  } {
    return {
      repairRules: {
        minimumAmount: 50,
        smallRepair: { minAmount: 50, maxAmount: 99, tokens: 10 },
        largeRepair: { minAmount: 100, tokens: 25 }
      },
      referralRules: {
        referrerReward: 25,
        refereeReward: 10,
        requiresCompletedRepair: true
      },
      limits: {
        daily: null,      // No daily limit
        monthly: null,    // No monthly limit
        perTransaction: 25
      },
      tierThresholds: this.TIER_THRESHOLDS
    };
  }

  // Get contract instance
  async getContract() {
    return getContract({
      client: this.client,
      chain: baseSepolia,
      address: this.contractAddress,
    });
  }

  // Helper functions
  private isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  private isValidDate(dateString: string): boolean {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  }

  // Create new customer data object
  static createNewCustomer(
    address: string,
    name?: string,
    email?: string,
    phone?: string,
    fixflowCustomerId?: string,
    first_name?: string,
    last_name?: string
  ): CustomerData {
    return {
      address: address.toLowerCase(),
      email,
      phone,
      name,
      first_name,
      last_name,
      lifetimeEarnings: 0,
      tier: "BRONZE",
      lastEarnedDate: new Date().toISOString(),
      joinDate: new Date().toISOString(),
      fixflowCustomerId,
      isActive: true,
      referralCount: 0
    };
  }

  // Bulk tier calculations
  bulkCalculateTiers(customers: CustomerData[]): CustomerData[] {
    return customers.map(customer => ({
      ...customer,
      tier: this.calculateTier(customer.lifetimeEarnings)
    }));
  }

  // Get tier statistics
  getTierStatistics(customers: CustomerData[]): {
    bronze: number;
    silver: number;
    gold: number;
    total: number;
    averageLifetimeEarnings: number;
  } {
    const stats = {
      bronze: 0,
      silver: 0,
      gold: 0,
      total: customers.length,
      averageLifetimeEarnings: 0
    };

    let totalEarnings = 0;

    customers.forEach(customer => {
      switch (customer.tier) {
        case "BRONZE":
          stats.bronze++;
          break;
        case "SILVER":
          stats.silver++;
          break;
        case "GOLD":
          stats.gold++;
          break;
      }
      totalEarnings += customer.lifetimeEarnings;
    });

    stats.averageLifetimeEarnings = stats.total > 0 ? totalEarnings / stats.total : 0;

    return stats;
  }
}