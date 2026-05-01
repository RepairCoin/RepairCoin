export interface CustomerFormData {
  fullName: string;
  email: string;
  referral: string;
}

export interface ShopLocation {
  city: string;
  state: string;
  zipCode: string;
  lat: string;
  lng: string;
}

export interface ShopFormData {
  shopId: string;
  name: string;
  walletAddress: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  companySize: string;
  monthlyRevenue: string;
  website: string;
  referral: string;
  facebook: string;
  twitter: string;
  instagram: string;
  reimbursementAddress: string;
  fixflowShopId: string;
  location: ShopLocation;
  acceptTerms: boolean;
}

export interface Slide {
  key: string;
}

export interface NavigableSlideProps {
  handleGoNext: () => void;
}

export interface FirstSlideProps extends NavigableSlideProps {}

export interface ThirdSlideProps extends NavigableSlideProps {
  address: string;
}

export interface FourthSlideProps {
  handleSubmit: () => void;
  isLoading?: boolean;
}

export type AuthMethod =
  | "google"
  | "metamask"
  | "walletconnect"
  | "coinbase"
  | "rainbow"
  | null;
