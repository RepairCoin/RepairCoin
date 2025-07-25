// backend/src/utils/roleValidator.ts
import { databaseService } from '../services/DatabaseService';
import { logger } from './logger';

export interface RoleCheckResult {
  isValid: boolean;
  conflictingRole?: 'admin' | 'shop' | 'customer';
  message?: string;
}

/**
 * Check if a wallet address is already registered in any role
 */
export class RoleValidator {
  /**
   * Check if wallet address has role conflicts for customer registration
   */
  static async validateCustomerRegistration(walletAddress: string): Promise<RoleCheckResult> {
    const normalizedAddress = walletAddress.toLowerCase();

    try {
      // Check if address is admin
      const adminAddresses = (process.env.ADMIN_ADDRESSES || '').split(',').map(addr => addr.toLowerCase().trim());
      if (adminAddresses.includes(normalizedAddress)) {
        return {
          isValid: false,
          conflictingRole: 'admin',
          message: 'This wallet address is already registered as an admin and cannot be used for customer registration'
        };
      }

      // Check if address is already a shop
      const existingShop = await databaseService.getShopByWallet(normalizedAddress);
      if (existingShop) {
        return {
          isValid: false,
          conflictingRole: 'shop',
          message: `This wallet address is already registered as a shop (${existingShop.name}) and cannot be used for customer registration`
        };
      }

      return { isValid: true };
    } catch (error) {
      logger.error('Error validating customer registration role conflicts:', error);
      throw new Error('Failed to validate registration permissions');
    }
  }

  /**
   * Check if wallet address has role conflicts for shop registration
   */
  static async validateShopRegistration(walletAddress: string): Promise<RoleCheckResult> {
    const normalizedAddress = walletAddress.toLowerCase();

    try {
      // Check if address is admin
      const adminAddresses = (process.env.ADMIN_ADDRESSES || '').split(',').map(addr => addr.toLowerCase().trim());
      if (adminAddresses.includes(normalizedAddress)) {
        return {
          isValid: false,
          conflictingRole: 'admin',
          message: 'This wallet address is already registered as an admin and cannot be used for shop registration'
        };
      }

      // Check if address is already a customer
      const existingCustomer = await databaseService.getCustomer(normalizedAddress);
      if (existingCustomer) {
        return {
          isValid: false,
          conflictingRole: 'customer',
          message: `This wallet address is already registered as a customer and cannot be used for shop registration`
        };
      }

      return { isValid: true };
    } catch (error) {
      logger.error('Error validating shop registration role conflicts:', error);
      throw new Error('Failed to validate registration permissions');
    }
  }

  /**
   * Get the current role of a wallet address
   */
  static async getCurrentRole(walletAddress: string): Promise<'admin' | 'shop' | 'customer' | null> {
    const normalizedAddress = walletAddress.toLowerCase();

    try {
      // Check admin
      const adminAddresses = (process.env.ADMIN_ADDRESSES || '').split(',').map(addr => addr.toLowerCase().trim());
      if (adminAddresses.includes(normalizedAddress)) {
        return 'admin';
      }

      // Check shop
      const shop = await databaseService.getShopByWallet(normalizedAddress);
      if (shop) {
        return 'shop';
      }

      // Check customer
      const customer = await databaseService.getCustomer(normalizedAddress);
      if (customer) {
        return 'customer';
      }

      return null;
    } catch (error) {
      logger.error('Error getting current role:', error);
      return null;
    }
  }
}