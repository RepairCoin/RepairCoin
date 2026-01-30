import { CustomerFormData, ShopFormData } from "../types";

export const INITIAL_CUSTOMER_FORM_DATA: CustomerFormData = {
  fullName: "",
  email: "",
  referral: "",
};

export const INITIAL_SHOP_FORM_DATA: ShopFormData = {
  // Shop Information
  shopId: "",
  name: "",
  walletAddress: "",

  // Personal Information
  firstName: "",
  lastName: "",
  email: "",
  phone: "",

  // Business Information
  address: "",
  city: "",
  country: "",
  companySize: "",
  monthlyRevenue: "",
  website: "",
  referral: "",

  // Social Media
  facebook: "",
  twitter: "",
  instagram: "",

  // Wallet Information
  reimbursementAddress: "",
  fixflowShopId: "",

  // Location (for mapping)
  location: {
    city: "",
    state: "",
    zipCode: "",
    lat: "",
    lng: "",
  },

  // Terms and Conditions
  acceptTerms: false,
};

export const SHOP_REGISTER_SLIDES = [
  { key: "1" },
  { key: "2" },
  { key: "3" },
  { key: "4" },
  { key: "5" },
];
