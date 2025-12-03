import { BaseResponse } from "./base.interface";

export interface TierBenefits {
  earningMultiplier: number;
  redemptionRate: number;
  crossShopRedemption: boolean;
  tierBonus: number;
  features: string[];
}

export interface CustomerData {
  address: string;
  name: string;
  email: string;
  phone: string;
  tier: string;
  lifetimeEarnings: number;
  totalRedemptions: number;
  totalRepairs: number;
  referralCode: string;
  referralCount: number;
  dailyEarnings: number;
  monthlyEarnings: number;
  lastEarnedDate: string;
  joinDate: string;
  isActive: boolean;
  isSuspended: boolean;
  suspensionReason: string | null;
  id: number;
  shopId: string;
  stripeCustomerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  customer: CustomerData;
  blockchainBalance: number;
  tierBenefits: TierBenefits;
  earningCapacity: {};
  tierProgression: {};
}

export interface CreateCustomerRequest {
  address?: string;
  name?: string;
  email: string;
  phone?: string;
  referralCode?: string;
  walletAddress: string;
  fixflowCustomerId?: string;
}

export interface TransactionData {
  amount: number;
  createdAt: string;
  description: string;
  id: number;
  metadata: string[];
  shopId: string;
  shopName: string;
  type: string;
}

export interface Transaction {
  count: number;
  customer: CustomerData;
  transactions: TransactionData[];
}

export interface CustomerResponse extends BaseResponse<Customer> {}
export interface TransactionResponse extends BaseResponse<Transaction> {}
