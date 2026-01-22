export type BonusType = "fixed" | "percentage";

export interface PromoCodeFormData {
  code: string;
  name: string;
  description: string;
  bonusType: BonusType;
  bonusValue: string;
  startDate: Date;
  endDate: Date;
  totalUsageLimit: string;
  perCustomerLimit: string;
  maxBonus: string;
}

export interface CreatePromoCodeData {
  code: string;
  name: string;
  description?: string;
  bonus_type: BonusType;
  bonus_value: number;
  start_date: string;
  end_date: string;
  total_usage_limit?: number;
  per_customer_limit?: number;
  max_bonus?: number;
  is_active: boolean;
}
