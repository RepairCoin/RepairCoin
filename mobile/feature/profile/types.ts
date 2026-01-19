import { LinkType } from "@/utilities/linking";
import { CustomerData as CustomerDataInterface } from "@/interfaces/customer.interface";

// Re-export CustomerData from interfaces
export type CustomerData = CustomerDataInterface;

// Shop Profile Types
export interface ShopData {
  shopId: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
  facebook?: string;
  twitter?: string;
  instagram?: string;
  verified?: boolean;
  active?: boolean;
  crossShopEnabled?: boolean;
  joinDate?: string;
  walletAddress?: string;
  country?: string;
  location?: {
    lat?: string;
    lng?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
}

export interface ShopProfileProps {
  shopId: string;
}

export interface ShopDetailsTabProps {
  shopData: ShopData | null;
  onLinkPress: (type: LinkType, value?: string, platform?: string) => void;
  formatDate: (dateString?: string) => string;
}

export interface ShopServicesTabProps {
  shopId: string;
  onServicePress: (serviceId: string) => void;
}

// Customer Profile Types
export type CustomerTier = "bronze" | "silver" | "gold";

export interface CustomerProfileProps {
  walletAddress: string;
}

export interface CustomerStatsProps {
  lifetimeEarnings: number;
  totalRedemptions: number;
  totalRepairs: number;
}

// Edit Profile Types
export interface CustomerEditFormData {
  name: string;
  email: string;
  phone: string;
}

export interface ShopEditFormData {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  facebook: string;
  twitter: string;
  instagram: string;
  website: string;
  walletAddress: string;
  location: {
    lat: string;
    lng: string;
    city: string;
    state: string;
    zipCode: string;
  };
}

// Contact Info Types
export interface ContactInfoItem {
  type: "email" | "phone" | "wallet" | "website";
  label: string;
  value: string;
  onPress?: () => void;
  copyable?: boolean;
}

// Tab Types
export interface ProfileTab {
  key: string;
  label: string;
}

// Loading/Error State Types
export interface ProfileLoadingProps {
  message?: string;
}

export interface ProfileErrorProps {
  title: string;
  message: string;
  onBack?: () => void;
}
