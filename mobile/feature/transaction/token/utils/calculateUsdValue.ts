/**
 * Calculate USD value from RCN amount
 * 1 RCN = $0.10 USD
 */
export const calculateUsdValue = (rcnAmount: number): string => {
  return (rcnAmount * 0.1).toFixed(2);
};
