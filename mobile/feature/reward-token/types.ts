import { RepairType } from "./hooks/useShopRewards";
import { CustomerData } from "@/shared/interfaces/customer.interface";

export type { RepairType, CustomerData };

export type CustomerTier = "GOLD" | "SILVER" | "BRONZE";

export interface RepairOption {
  type: RepairType;
  label: string;
  rcn: number;
  description: string;
}

export interface HowItWorksItem {
  icon: string;
  title: string;
  desc: string;
}

export interface PromoCode {
  id: string;
  code: string;
  name?: string;
  bonus_type: "fixed" | "percentage";
  bonus_value: number;
}
