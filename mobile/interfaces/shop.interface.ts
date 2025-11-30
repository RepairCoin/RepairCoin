export interface CreateShopRequest {
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