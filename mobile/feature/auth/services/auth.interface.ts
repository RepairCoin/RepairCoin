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
  formData: ShopFormData;
  updateFormData: <K extends keyof ShopFormData>(
    field: K,
    value: ShopFormData[K],
  ) => void;
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
