/**
 * Check if string is a valid Ethereum address
 */
export const isEthereumAddress = (str: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(str);
};
