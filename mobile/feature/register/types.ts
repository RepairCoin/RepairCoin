import { CountryCode } from "react-native-country-picker-modal";

// Customer Registration Types
export interface CustomerFormData {
  fullName: string;
  email: string;
  referral: string;
}

// Shop Registration Types
export interface ShopLocation {
  city: string;
  state: string;
  zipCode: string;
  lat: string;
  lng: string;
}

export interface ShopFormData {
  // Shop Information
  shopId: string;
  name: string;
  walletAddress: string;

  // Personal Information
  firstName: string;
  lastName: string;
  email: string;
  phone: string;

  // Business Information
  address: string;
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
  location: ShopLocation;

  // Terms and Conditions
  acceptTerms: boolean;
}

// Slide Types
export interface Slide {
  key: string;
}

// Props Types
export interface BaseSlideProps {
  handleGoBack: () => void;
  formData: ShopFormData;
  updateFormData: <K extends keyof ShopFormData>(
    field: K,
    value: ShopFormData[K]
  ) => void;
}

export interface NavigableSlideProps extends BaseSlideProps {
  handleGoNext: () => void;
}

export interface FirstSlideProps extends NavigableSlideProps {
  countryCode: CountryCode;
  setCountryCode: (code: CountryCode) => void;
}

export interface ThirdSlideProps extends NavigableSlideProps {
  address: string;
}

export interface FourthSlideProps extends BaseSlideProps {
  handleSubmit: () => void;
  isLoading?: boolean;
}
