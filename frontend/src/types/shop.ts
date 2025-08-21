export interface ShopRegistrationFormData {
  // Shop Information
  shopId: string;
  name: string; // Company name

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

export interface ExistingApplication {
  hasApplication: boolean;
  status: "pending" | "verified" | null;
  shopName?: string;
  shopId?: string;
}

export const initialShopFormData: ShopRegistrationFormData = {
  shopId: "",
  name: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  country: "",
  companySize: "",
  monthlyRevenue: "",
  website: "",
  referral: "",
  reimbursementAddress: "",
  fixflowShopId: "",
  location: {
    city: "",
    state: "",
    zipCode: "",
    lat: "",
    lng: "",
  },
  acceptTerms: false,
};