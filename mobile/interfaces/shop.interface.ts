import { BaseResponse } from "./base.interface";
import { CustomerData } from "./customer.interface";

export interface LocationData {
  city: string;
  state: string;
  zipCode: string;
  lat: string;
  lng: string;
}

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
  location: LocationData;

  // Terms and Conditions
  acceptTerms: boolean;
}

export interface ShopData {
  acceptTerms: boolean;
  active: boolean;
  address: string;
  category: string;
  companySize: string;
  country: string;
  crossShopEnabled: boolean;
  email: string;
  facebook: string;
  firstName: string;
  instagram: string;
  joinDate: string;
  lastName: string;
  location: LocationData;
  monthlyRevenue: string;
  name: string;
  phone: string;
  referral: string;
  shopId: string;
  twitter: string;
  verified: boolean;
  website: string;
}

export interface ShopResponseData {
  count: number;
  shops: ShopData[];
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

export interface ProcessRedemptionRequest {
  customerAddress: string;
  amount: number;
  sessionId: string;
}

export interface ProcessRedemptionData {
  transactionHash?: string;
  amount: number;
  customerAddress: string;
}

export interface CreatePromoCodeRequest {
  code: string;
  name: string;
  description?: string;
  bonus_type: "fixed" | "percentage";
  bonus_value: number;
  start_date: string;
  end_date: string;
  total_usage_limit?: number;
  per_customer_limit?: number;
  max_bonus?: number;
  is_active: boolean;
}

export interface PromoCodeData {
  id: string;
  code: string;
  name?: string;
  bonus_type: "fixed" | "percentage";
  bonus_value: number;
  max_bonus?: number;
  is_active: boolean;
  total_usage_limit?: number;
  times_used?: number;
}

export interface PromoCodeValidateData {
  is_valid: boolean;
  bonus_type?: "fixed" | "percentage";
  bonus_value?: string;
  max_bonus?: string;
  error_message?: string;
}

export interface PromoCodeValidateResponse extends BaseResponse<PromoCodeValidateData> {}
export interface PromoCodeResponse extends BaseResponse<PromoCodeData> {}
export interface ProcessRedemptionResponse extends BaseResponse<ProcessRedemptionData> {}
export interface ShopByWalletAddressResponse extends BaseResponse<ShopData> {}
export interface ShopCustomersResponse extends BaseResponse<ShopCustomerData> {}
export interface ShopCustomerGrowthResponse extends BaseResponse<CustomerGrowthData> {}
export interface ShopResponse extends BaseResponse<ShopResponseData> {}
