import { BaseResponse } from "./base.interface";
import { CustomerData } from "./customer.interface";

export interface ShopFormData {
  // Shop Information
  shopId: string;
  name: string; // Company name
  walletAddress: string;

  // Personal Information
  firstName: string;
  lastName: string;
  email: string;
  phone: string;

  // Business Information
  address: string; // Street address
  city: string;
  country: string;
  companySize: string;
  monthlyRevenue: string;
  website: string;
  referral: string;

  // Social Media
  facebook: string;
  twitter: string;
  instagram: string;

  // Wallet Information
  reimbursementAddress: string;
  fixflowShopId: string;

  // Location (for mapping)
  location: {
    city: string;
    state: string;
    zipCode: string;
    lat: string;
    lng: string;
  };

  // Terms and Conditions
  acceptTerms: boolean;
}

export interface ShopData {
  active: boolean;
  address: string;
  crossShopEnabled: boolean;
  email: string;
  facebook: string;
  instagram: string;
  joinDate: string;
  name: string;
  operational_status: string;
  phone: string;
  purchasedRcnBalance: number;
  rcg_balance: number;
  rcg_tier: string;
  shopId: string;
  totalRcnPurchased: number;
  totalRedemptions: number;
  totalTokensIssued: number;
  twitter: string;
  verified: boolean;
  walletAddress: string;
  website: string;
}

export interface ShopCustomerData {
  currentPage: number;
  customers: CustomerData[];
  totalItems: number;
  totalPages: number;
}

export interface CustomerGrowthData {
  activeCustomers: number;
  activeGrowthPercentage: number;
  averageEarningsPerCustomer: number;
  avgEarningsGrowthPercentage: number;
  growthPercentage: number;
  newCustomers: number;
  periodLabel: string;
  regularCustomers: number;
  regularGrowthPercentage: number;
  totalCustomers: number;
}

export interface ShopByWalletAddressResponse extends BaseResponse<ShopData> {}
export interface ShopCustomersResponse extends BaseResponse<ShopCustomerData> {}
export interface ShopCustomerGrowthResponse extends BaseResponse<CustomerGrowthData> {}
