// backend/src/utils/validators.ts

/**
 * Validates if a string is a valid Ethereum address
 */
export function validateEthereumAddress(address: string): boolean {
  if (!address || typeof address !== 'string') {
    return false;
  }
  
  // Check if it matches the basic Ethereum address pattern
  const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
  return ethAddressRegex.test(address);
}

/**
 * Validates if a string is a valid email address
 */
export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates if a string is a valid phone number (basic validation)
 */
export function validatePhoneNumber(phone: string): boolean {
  if (!phone || typeof phone !== 'string') {
    return false;
  }
  
  // Remove common formatting characters
  const cleanedPhone = phone.replace(/[\s\-\(\)\.]/g, '');
  
  // Check if it contains only digits and is between 10-15 characters
  return /^\+?\d{10,15}$/.test(cleanedPhone);
}

/**
 * Validates if a string is a valid shop ID
 */
export function validateShopId(shopId: string): boolean {
  if (!shopId || typeof shopId !== 'string') {
    return false;
  }
  
  // Shop IDs should be alphanumeric with optional hyphens/underscores
  const shopIdRegex = /^[a-zA-Z0-9_-]+$/;
  return shopIdRegex.test(shopId) && shopId.length >= 3 && shopId.length <= 50;
}

/**
 * Validates if a number is a valid token amount
 */
export function validateTokenAmount(amount: number): boolean {
  return typeof amount === 'number' && 
         amount > 0 && 
         isFinite(amount) &&
         amount <= 1000000; // Max 1M tokens per transaction
}

/**
 * Validates if a string is a valid referral code
 */
export function validateReferralCode(code: string): boolean {
  if (!code || typeof code !== 'string') {
    return false;
  }
  
  // Referral codes should be 6-10 alphanumeric characters
  const referralRegex = /^[A-Z0-9]{6,10}$/;
  return referralRegex.test(code);
}

/**
 * Normalizes an Ethereum address to lowercase
 */
export function normalizeAddress(address: string): string {
  return address ? address.toLowerCase() : '';
}

/**
 * Validates an array of permission strings
 */
export function validatePermissions(permissions: string[]): boolean {
  if (!Array.isArray(permissions)) {
    return false;
  }
  
  const validPermissions = [
    'all',
    'manage_customers',
    'manage_shops', 
    'manage_admins',
    'view_reports',
    'mint_tokens',
    'manage_contract',
    'manage_treasury'
  ];
  
  return permissions.every(perm => 
    typeof perm === 'string' && validPermissions.includes(perm)
  );
}