import { Control, FieldErrors } from "react-hook-form";
import type { ShopRegisterData } from "../dto/register.dto";

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

export interface BaseSlideProps {
  handleGoBack: () => void;
  control: Control<ShopRegisterData>;
  errors: FieldErrors<ShopRegisterData>;
}

export interface NavigableSlideProps extends BaseSlideProps {
  handleGoNext: () => void;
}

export interface FirstSlideProps extends NavigableSlideProps {}

export interface ThirdSlideProps extends NavigableSlideProps {
  address: string;
}

export interface FourthSlideProps extends BaseSlideProps {
  handleSubmit: () => void;
  isLoading?: boolean;
}
