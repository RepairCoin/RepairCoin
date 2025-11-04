import { apiClient } from "@/utilities/axios";

export interface Location {
    lat: number;
    lng: number;
    city: string;
    state: string;
    zipCode: string;
}

export interface ShopData {
    acceptTerms: boolean;
    active: boolean;
    address: string;
    companySize: string;
    country: string;
    crossShopEnabled: boolean;
    email: string;
    facebook: string;
    firstName: string;
    instagram: string;
    joinDate: string;
    lastName: string;
    location: Location;
    monthlyRevenue: string;
    name: string;
    phone: string;
    referral: string;
    shopId: string;
    twitter: string;
    verified: boolean;
    website: string;
}

export interface ShopResponse {
    data: {
      count: number;
      shops: ShopData[]
    };
    success: boolean;
    message?: string;
}

export const listShops = async (): Promise<ShopResponse> => {
  try {
    return await apiClient.get<ShopResponse>('/shops');
  } catch (error: any) {
    throw new Error(`Failed to fetch shops: ${error.response?.status || error.message}`);
  }
}