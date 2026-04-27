import { z } from "zod/v4";

export const CustomerRegisterDto = z.object({
  fullName: z
    .string()
    .min(2, "Name must be at least 2 characters"),
  email: z
    .string()
    .email("Please enter a valid email address"),
  referral: z.string().optional().default(""),
});

export const ShopLocationDto = z.object({
  city: z.string().default(""),
  state: z.string().default(""),
  zipCode: z.string().default(""),
  lat: z.string().default(""),
  lng: z.string().default(""),
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
  companySize: z.string().default(""),
  monthlyRevenue: z.string().default(""),
  website: z.string().default(""),
  referral: z.string().default(""),
  facebook: z.string().default(""),
  twitter: z.string().default(""),
  instagram: z.string().default(""),
  reimbursementAddress: z.string().default(""),
  fixflowShopId: z.string().default(""),
  location: ShopLocationDto,
  acceptTerms: z.boolean(),
});

export type CustomerRegisterData = z.infer<typeof CustomerRegisterDto>;
export type ShopRegisterData = z.infer<typeof ShopRegisterDto>;
export type ShopLocationData = z.infer<typeof ShopLocationDto>;
