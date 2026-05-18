/**
 * Format wallet address for display (truncated)
 */
export const formatWalletAddress = (
  address: string,
  startChars: number = 6,
  endChars: number = 4
): string => {
  if (!address || address.length <= startChars + endChars) {
    return address;
  }
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
};

/**
 * Format wallet address for display with default truncation (6...4)
 */
export const formatAddress = (address: string): string => {
  return formatWalletAddress(address);
};
