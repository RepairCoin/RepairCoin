import { CustomerData } from "@/shared/interfaces/customer.interface";

const getNumericValue = (snakeCase: any, camelCase: any, defaultValue: number = 0): number => {
  if (snakeCase !== undefined && snakeCase !== null) return Number(snakeCase);
  if (camelCase !== undefined && camelCase !== null) return Number(camelCase);
  return defaultValue;
};

const getStringValue = (snakeCase: any, camelCase: any, defaultValue: string = ""): string => {
  if (snakeCase !== undefined && snakeCase !== null) return String(snakeCase);
  if (camelCase !== undefined && camelCase !== null) return String(camelCase);
  return defaultValue;
};

export const transformCustomer = (customer: any): CustomerData => ({
  ...customer,
  lifetimeEarnings: getNumericValue(customer.lifetime_earnings, customer.lifetimeEarnings, 0),
  totalRedemptions: getNumericValue(customer.total_redemptions, customer.totalRedemptions, 0),
  totalRepairs: getNumericValue(customer.total_repairs, customer.totalRepairs, 0),
  referralCode: getStringValue(customer.referral_code, customer.referralCode, ""),
  referralCount: getNumericValue(customer.referral_count, customer.referralCount, 0),
  dailyEarnings: getNumericValue(customer.daily_earnings, customer.dailyEarnings, 0),
  monthlyEarnings: getNumericValue(customer.monthly_earnings, customer.monthlyEarnings, 0),
  joinDate: getStringValue(customer.join_date, customer.joinDate, ""),
  isActive: customer.is_active ?? customer.isActive ?? true,
  isSuspended: customer.suspended ?? customer.is_suspended ?? customer.isSuspended ?? (customer.is_active === false),
  suspensionReason: customer.suspension_reason ?? customer.suspensionReason ?? null,
  profileImageUrl: customer.profile_image_url ?? customer.profileImageUrl ?? null,
  total_transactions: getNumericValue(customer.total_transactions, undefined, 0),
  last_transaction_date: getStringValue(customer.last_transaction_date, customer.lastEarnedDate, ""),
});
