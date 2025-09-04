// contracts/TierManager.ts
import { createThirdwebClient, getContract, readContract } from "thirdweb";
import { baseSepolia } from "thirdweb/chains";

export type TierLevel = "BRONZE" | "SILVER" | "GOLD";

export interface CustomerData {
  address: string;
  name?: string;
  email?: string;
  phone?: string;
  isActive: boolean;
  lifetimeEarnings: number;
  tier: TierLevel;
  dailyEarnings: number;
  monthlyEarnings: number;
  lastEarnedDate: string;
  referralCount: number;
  joinDate: string; 
  fixflowCustomerId?: string;
  suspendedAt?: string | null;
  suspensionReason?: string | null;
  referralCode?: string;
  referredBy?: string | null;
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
    daily: 50,      // 50 RCN per day max
    monthly: 500,   // 500 RCN per month max
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
        crossShopRedemptionLimit: 10,
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
        crossShopRedemptionLimit: 20,
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
        crossShopRedemptionLimit: 30,
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

  // Check if customer can earn more tokens today (40 RCN daily limit)
  canEarnToday(customer: CustomerData, tokensToEarn: number): boolean {
    const today = new Date().toISOString().split('T')[0];
    const customerLastEarnedDate = customer.lastEarnedDate.split('T')[0];
    
    // Reset daily earnings if it's a new day
    if (customerLastEarnedDate !== today) {
      return tokensToEarn <= this.EARNING_LIMITS.daily;
    }
    
    return (customer.dailyEarnings + tokensToEarn) <= this.EARNING_LIMITS.daily;
  }

  // Check monthly earning limit (500 RCN monthly limit)
  canEarnThisMonth(customer: CustomerData, tokensToEarn: number): boolean {
    const today = new Date();
    const customerLastEarned = new Date(customer.lastEarnedDate);
    
    // Reset monthly earnings if it's a new month
    if (today.getMonth() !== customerLastEarned.getMonth() || 
        today.getFullYear() !== customerLastEarned.getFullYear()) {
      return tokensToEarn <= this.EARNING_LIMITS.monthly;
    }
    
    return (customer.monthlyEarnings + tokensToEarn) <= this.EARNING_LIMITS.monthly;
  }

  // Check if earning amount is within per-transaction limit
  isValidTransactionAmount(tokensToEarn: number): boolean {
    return tokensToEarn > 0 && tokensToEarn <= this.EARNING_LIMITS.perTransaction;
  }

  // Update customer data after earning tokens
  updateCustomerAfterEarning(customer: CustomerData, tokensEarned: number): CustomerData {
    const today = new Date().toISOString().split('T')[0];
    const currentDate = new Date();
    const lastEarnedDate = new Date(customer.lastEarnedDate);
    const customerLastEarnedDateOnly = customer.lastEarnedDate.split('T')[0];
    
    // Reset daily earnings if new day
    const dailyEarnings = (customerLastEarnedDateOnly === today) 
      ? customer.dailyEarnings + tokensEarned 
      : tokensEarned;
    
    // Reset monthly earnings if new month
    const monthlyEarnings = (currentDate.getMonth() === lastEarnedDate.getMonth() && 
                            currentDate.getFullYear() === lastEarnedDate.getFullYear())
      ? customer.monthlyEarnings + tokensEarned
      : tokensEarned;
    
    const newLifetimeEarnings = customer.lifetimeEarnings + tokensEarned;
    const newTier = this.calculateTier(newLifetimeEarnings);
    
    return {
      ...customer,
      lifetimeEarnings: newLifetimeEarnings,
      tier: newTier,
      dailyEarnings,
      monthlyEarnings,
      lastEarnedDate: today
    };
  }

  // Check if customer can redeem at another shop
  canRedeemAtShop(customer: CustomerData, redemptionAmount: number, isHomeShop: boolean): {
    canRedeem: boolean;
    message?: string;
    maxRedemption?: number;
  } {
    // Home shop has no limits
    if (isHomeShop) {
      return { canRedeem: true };
    }
    
    // Cross-shop redemption limits based on tier
    const limit = this.getRedemptionLimit(customer.tier);
    
    if (redemptionAmount > limit) {
      return {
        canRedeem: false,
        message: `Cross-shop redemption limit exceeded. ${customer.tier} tier allows max ${limit} RCN per transaction.`,
        maxRedemption: limit
      };
    }
    
    return { canRedeem: true };
  }

  // Get customer's current earning capacity
  getEarningCapacity(customer: CustomerData): {
    dailyRemaining: number;
    monthlyRemaining: number;
    canEarnToday: boolean;
    canEarnThisMonth: boolean;
  } {
    const today = new Date().toISOString().split('T')[0];
    const currentDate = new Date();
    const lastEarnedDate = new Date(customer.lastEarnedDate);
    const customerLastEarnedDateOnly = customer.lastEarnedDate.split('T')[0];
    
    // Calculate remaining daily capacity
    const dailyUsed = (customerLastEarnedDateOnly === today) ? customer.dailyEarnings : 0;
    const dailyRemaining = Math.max(0, this.EARNING_LIMITS.daily - dailyUsed);
    
    // Calculate remaining monthly capacity
    const sameMonth = (currentDate.getMonth() === lastEarnedDate.getMonth() && 
                      currentDate.getFullYear() === lastEarnedDate.getFullYear());
    const monthlyUsed = sameMonth ? customer.monthlyEarnings : 0;
    const monthlyRemaining = Math.max(0, this.EARNING_LIMITS.monthly - monthlyUsed);
    
    return {
      dailyRemaining,
      monthlyRemaining,
      canEarnToday: dailyRemaining > 0,
      canEarnThisMonth: monthlyRemaining > 0
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
    
    if (customer.dailyEarnings < 0 || customer.dailyEarnings > this.EARNING_LIMITS.daily) {
      errors.push(`Daily earnings must be between 0 and ${this.EARNING_LIMITS.daily}`);
    }
    
    if (customer.monthlyEarnings < 0 || customer.monthlyEarnings > this.EARNING_LIMITS.monthly) {
      errors.push(`Monthly earnings must be between 0 and ${this.EARNING_LIMITS.monthly}`);
    }
    
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
      limits: this.EARNING_LIMITS,
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
  static createNewCustomer(address: string, email?: string, phone?: string, fixflowCustomerId?: string): CustomerData {
    return {
      address: address.toLowerCase(),
      email,
      phone,
      lifetimeEarnings: 0,
      tier: "BRONZE",
      dailyEarnings: 0,
      monthlyEarnings: 0,
      lastEarnedDate: new Date().toISOString().split('T')[0],
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