/**
 * Cross-shop redemption limit calculation utilities
 *
 * Business Rules:
 * - Home shop (where customer earned RCN): 100% redemption allowed
 * - Cross-shop (other shops): max 20% of lifetime earnings
 */

// Cross-shop redemption limit percentage (20%)
export const CROSS_SHOP_LIMIT_PERCENTAGE = 0.20;

interface RedemptionLimitParams {
  balance: number;
  lifetimeEarnings: number;
  isHomeShop: boolean;
}

/**
 * Calculates the maximum amount a customer can redeem at a shop
 *
 * @param params - Customer balance and shop relationship data
 * @returns Maximum redeemable amount in RCN
 *
 * @example
 * // Home shop - customer can redeem full balance
 * calculateMaxRedeemable({ balance: 100, lifetimeEarnings: 500, isHomeShop: true })
 * // Returns: 100
 *
 * @example
 * // Cross-shop - customer limited to 20% of lifetime earnings
 * calculateMaxRedeemable({ balance: 100, lifetimeEarnings: 500, isHomeShop: false })
 * // Returns: 100 (min of balance and 20% of 500 = 100)
 *
 * @example
 * // Cross-shop with lower limit
 * calculateMaxRedeemable({ balance: 100, lifetimeEarnings: 200, isHomeShop: false })
 * // Returns: 40 (20% of 200)
 */
export function calculateMaxRedeemable(params: RedemptionLimitParams): number {
  const { balance, lifetimeEarnings, isHomeShop } = params;

  if (isHomeShop) {
    // Home shop: customer can redeem 100% of their balance
    return balance;
  }

  // Cross-shop: limited to 20% of lifetime earnings
  const crossShopLimit = lifetimeEarnings * CROSS_SHOP_LIMIT_PERCENTAGE;

  // Return the minimum of current balance and cross-shop limit
  return Math.min(balance, crossShopLimit);
}

/**
 * Calculates the cross-shop limit (20% of lifetime earnings)
 *
 * @param lifetimeEarnings - Customer's total lifetime RCN earnings
 * @returns Maximum amount allowed for cross-shop redemption
 */
export function calculateCrossShopLimit(lifetimeEarnings: number): number {
  return lifetimeEarnings * CROSS_SHOP_LIMIT_PERCENTAGE;
}

/**
 * Validates if a redemption amount is within limits
 *
 * @param amount - Requested redemption amount
 * @param maxRedeemable - Maximum allowed amount
 * @returns Validation result with error message if invalid
 */
export function validateRedemptionAmount(
  amount: number,
  maxRedeemable: number
): { valid: boolean; error?: string } {
  if (amount <= 0) {
    return { valid: false, error: "Amount must be greater than 0" };
  }

  if (amount > maxRedeemable) {
    return {
      valid: false,
      error: `Amount exceeds maximum redeemable limit of ${maxRedeemable.toFixed(2)} RCN`,
    };
  }

  return { valid: true };
}
