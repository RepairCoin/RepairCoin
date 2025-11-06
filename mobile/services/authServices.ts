import { apiClient } from "@/utilities/axios";

interface CheckUserResponse {
  exists: boolean;
  type?: "customer" | "shop" | "admin";
  user?: {
    id: string;
    address: string;
    walletAddress: string;
    name?: string;
    email?: string;
    tier?: string;
    active?: boolean;
    createdAt?: string;
  };
  error?: string;
  message?: string;
}

export interface ShopRegistrationFormData {
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

export const checkUserByWalletAddress = async (
  address: string
): Promise<CheckUserResponse> => {
  try {
    return await apiClient.post<CheckUserResponse>("/auth/check-user", {
      address,
    });
  } catch (error) {
    console.error("Failed to check user:", error);
    throw error;
  }
};

export const getAuthCustomer = async (address: string) => {
  try {
    return await apiClient.post("/auth/customer", { address });
  } catch (error) {
    console.error("Failed to check user:", error);
    throw error;
  }
};

export const registerAsShop = async (registrationData: ShopRegistrationFormData) => {
  try {
    return await apiClient.post("/shops/register", registrationData);
  } catch (error) {
    console.error("Failed to register shop:", error);
    throw error;
  }
};
