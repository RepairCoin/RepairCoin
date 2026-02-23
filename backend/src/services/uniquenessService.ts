import { DatabaseService } from './DatabaseService';

export interface UniquenessCheckResult {
  isUnique: boolean;
  conflictType?: 'customer' | 'shop';
  conflictField?: 'email' | 'wallet';
  existingAccountId?: string;
}

export class UniquenessService {
  private db: DatabaseService;

  constructor() {
    this.db = DatabaseService.getInstance();
  }

  /**
   * Check if an email address is unique across all account types
   * NOTE: Placeholder accounts (addresses starting with 0xmanual) can be excluded
   * from uniqueness checks to allow real customer accounts to claim them.
   * However, for shop registration, placeholder emails should still be blocked.
   *
   * @param email - Email to check
   * @param excludeCustomerAddress - Customer address to exclude (for updates)
   * @param excludeShopId - Shop ID to exclude (for updates)
   * @param excludePlaceholders - If true, exclude placeholder customer accounts from check
   */
  async checkEmailUniqueness(
    email: string,
    excludeCustomerAddress?: string,
    excludeShopId?: string,
    excludePlaceholders: boolean = false
  ): Promise<UniquenessCheckResult> {
    if (!email || email.trim() === '') {
      return { isUnique: true };
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check customers table
    // Only exclude placeholder accounts if explicitly requested (for customer registration)
    // Shop registration should NOT exclude placeholders to prevent email hijacking
    const placeholderExclusion = excludePlaceholders ? "AND LOWER(address) NOT LIKE '0xmanual%'" : '';
    const customerQuery = `
      SELECT address FROM customers
      WHERE LOWER(email) = $1
      ${placeholderExclusion}
      ${excludeCustomerAddress ? 'AND address != $2' : ''}
    `;
    const customerParams = excludeCustomerAddress
      ? [normalizedEmail, excludeCustomerAddress]
      : [normalizedEmail];

    const customerResult = await this.db.query(customerQuery, customerParams);

    if (customerResult.rows.length > 0) {
      return {
        isUnique: false,
        conflictType: 'customer',
        conflictField: 'email',
        existingAccountId: customerResult.rows[0].address
      };
    }

    // Check shops table
    const shopQuery = `
      SELECT shop_id FROM shops 
      WHERE LOWER(email) = $1 
      ${excludeShopId ? 'AND shop_id != $2' : ''}
    `;
    const shopParams = excludeShopId 
      ? [normalizedEmail, excludeShopId] 
      : [normalizedEmail];
    
    const shopResult = await this.db.query(shopQuery, shopParams);
    
    if (shopResult.rows.length > 0) {
      return {
        isUnique: false,
        conflictType: 'shop',
        conflictField: 'email',
        existingAccountId: shopResult.rows[0].shop_id
      };
    }

    return { isUnique: true };
  }

  /**
   * Check if a wallet address is unique across all account types
   */
  async checkWalletUniqueness(
    walletAddress: string, 
    excludeCustomerAddress?: string, 
    excludeShopId?: string
  ): Promise<UniquenessCheckResult> {
    const normalizedWallet = walletAddress.toLowerCase();

    // Check customers table
    const customerQuery = `
      SELECT address FROM customers 
      WHERE LOWER(wallet_address) = $1 
      ${excludeCustomerAddress ? 'AND address != $2' : ''}
    `;
    const customerParams = excludeCustomerAddress 
      ? [normalizedWallet, excludeCustomerAddress] 
      : [normalizedWallet];
    
    const customerResult = await this.db.query(customerQuery, customerParams);
    
    if (customerResult.rows.length > 0) {
      return {
        isUnique: false,
        conflictType: 'customer',
        conflictField: 'wallet',
        existingAccountId: customerResult.rows[0].address
      };
    }

    // Check shops table
    const shopQuery = `
      SELECT shop_id FROM shops 
      WHERE LOWER(wallet_address) = $1 
      ${excludeShopId ? 'AND shop_id != $2' : ''}
    `;
    const shopParams = excludeShopId 
      ? [normalizedWallet, excludeShopId] 
      : [normalizedWallet];
    
    const shopResult = await this.db.query(shopQuery, shopParams);
    
    if (shopResult.rows.length > 0) {
      return {
        isUnique: false,
        conflictType: 'shop',
        conflictField: 'wallet',
        existingAccountId: shopResult.rows[0].shop_id
      };
    }

    return { isUnique: true };
  }

  /**
   * Comprehensive uniqueness check for both email and wallet
   *
   * @param excludePlaceholders - If true, exclude placeholder customer accounts from email check
   */
  async checkAccountUniqueness(
    email: string | undefined,
    walletAddress: string,
    excludeCustomerAddress?: string,
    excludeShopId?: string,
    excludePlaceholders: boolean = false
  ): Promise<{
    emailCheck: UniquenessCheckResult;
    walletCheck: UniquenessCheckResult;
    isValid: boolean;
    errors: string[];
  }> {
    const emailCheck = email
      ? await this.checkEmailUniqueness(email, excludeCustomerAddress, excludeShopId, excludePlaceholders)
      : { isUnique: true };
    
    const walletCheck = await this.checkWalletUniqueness(
      walletAddress, 
      excludeCustomerAddress, 
      excludeShopId
    );

    const errors: string[] = [];
    
    if (!emailCheck.isUnique) {
      const accountType = emailCheck.conflictType === 'customer' ? 'customer' : 'shop';
      errors.push(`Email address is already registered to a ${accountType} account`);
    }
    
    if (!walletCheck.isUnique) {
      const accountType = walletCheck.conflictType === 'customer' ? 'customer' : 'shop';
      errors.push(`Wallet address is already registered to a ${accountType} account`);
    }

    return {
      emailCheck,
      walletCheck,
      isValid: emailCheck.isUnique && walletCheck.isUnique,
      errors
    };
  }
}