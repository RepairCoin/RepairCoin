import { CustomerFormData, ShopFormData } from "@/feature/auth/services/auth.interface";

export const COMPANY_SIZE_OPTIONS = [
  { label: "1-10 employees", value: "1-10" },
  { label: "11-50 employees", value: "11-50" },
  { label: "51-100 employees", value: "51-100" },
  { label: "100+ employees", value: "100+" },
];

export const MONTHLY_REVENUE_OPTIONS = [
  { label: "Less than $10,000", value: "<10k" },
  { label: "$10,000 - $50,000", value: "10k-50k" },
  { label: "$50,000 - $100,000", value: "50k-100k" },
  { label: "More than $100,000", value: "100k+" },
];

export const TERMS_ITEMS = [
  "Your shop will need admin verification before activation",
  "You'll be able to purchase RCN at $100 each",
  "Tier bonuses will be automatically deducted from your RCN balance",
  "Cross-shop redemption can be enabled after verification",
  "All transactions are recorded on the blockchain",
  "You agree to comply with all FixFlow network policies",
];

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
