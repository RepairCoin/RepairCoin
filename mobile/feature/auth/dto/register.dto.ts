import { z } from "zod/v4";

export const CustomerRegisterDto = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  referral: z.string(),
});

export const ShopLocationDto = z.object({
  city: z.string(),
  state: z.string(),
  zipCode: z.string(),
  lat: z.string(),
  lng: z.string(),
});

export const ShopRegisterDto = z.object({
  shopId: z.string().min(1, "Shop ID is required"),
  name: z.string().min(2, "Company name must be at least 2 characters"),
  walletAddress: z.string().min(1, "Wallet address is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(1, "Phone number is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  country: z.string().min(1, "Country is required"),
  companySize: z.string(),
  monthlyRevenue: z.string(),
  website: z.string(),
  referral: z.string(),
  facebook: z.string(),
  twitter: z.string(),
  instagram: z.string(),
  reimbursementAddress: z.string(),
  fixflowShopId: z.string(),
  location: ShopLocationDto,
  acceptTerms: z.boolean(),
});

export type CustomerRegisterData = z.infer<typeof CustomerRegisterDto>;
export type ShopRegisterData = z.infer<typeof ShopRegisterDto>;
export type ShopLocationData = z.infer<typeof ShopLocationDto>;
