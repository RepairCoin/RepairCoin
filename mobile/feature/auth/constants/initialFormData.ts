import { CustomerFormData, ShopFormData } from "../types";

export const INITIAL_CUSTOMER_FORM_DATA: CustomerFormData = {
  fullName: "",
  email: "",
  referral: "",
};

export const INITIAL_SHOP_FORM_DATA: ShopFormData = {
  shopId: "",
  name: "",
  walletAddress: "",
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
  facebook: "",
  twitter: "",
  instagram: "",
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

export const SHOP_REGISTER_SLIDES = [
  { key: "1" },
  { key: "2" },
  { key: "3" },
  { key: "4" },
  { key: "5" },
];
