import { DatabaseService } from './DatabaseService';
import { logger } from '../utils/logger';

export interface RoleConflictResult {
  hasConflict: boolean;
  existingRole?: 'customer' | 'shop';
  existingData?: {
    id: string;
    name?: string;
    email?: string;
    isActive: boolean;
    createdAt: Date;
  };
}

export interface RolePromotionOptions {
  action: 'deactivate' | 'preserve' | 'force';
  reason?: string;
  promotedBy?: string;
}

export interface RolePromotionResult {
  success: boolean;
  conflictResolved: boolean;
  previousRole?: 'customer' | 'shop';
  adminCreated: boolean;
  errors: string[];
  auditLog?: {
    action: string;
    timestamp: Date;
    details: any;
  };
}

export class AdminRoleConflictService {
  private db: DatabaseService;

  constructor() {
    this.db = DatabaseService.getInstance();
  }

  /**
   * Check if a wallet address has existing role conflicts with admin promotion
   */
  async checkRoleConflict(walletAddress: string): Promise<RoleConflictResult> {
    const normalizedAddress = walletAddress.toLowerCase();

    try {
      // Check customer table
      const customerQuery = `
        SELECT address as id, name, email, is_active as "isActive", created_at as "createdAt"
        FROM customers 
        WHERE LOWER(wallet_address) = $1
      `;
      const customerResult = await this.db.query(customerQuery, [normalizedAddress]);

      if (customerResult.rows.length > 0) {
        return {
          hasConflict: true,
          existingRole: 'customer',
          existingData: customerResult.rows[0]
        };
      }

      // Check shop table
      const shopQuery = `
        SELECT shop_id as id, name, email, active as "isActive", created_at as "createdAt"
        FROM shops 
        WHERE LOWER(wallet_address) = $1
      `;
      const shopResult = await this.db.query(shopQuery, [normalizedAddress]);

      if (shopResult.rows.length > 0) {
        return {
          hasConflict: true,
          existingRole: 'shop',
          existingData: shopResult.rows[0]
        };
      }

      return { hasConflict: false };
    } catch (error) {
      logger.error('Error checking role conflicts:', error);
      throw new Error('Failed to check role conflicts');
    }
  }

  /**
   * Validate all addresses in ADMIN_ADDRESSES environment variable
   */
  async validateAdminAddresses(): Promise<{
    valid: string[];
    conflicts: Array<{
      address: string;
      conflict: RoleConflictResult;
    }>;
    invalid: Array<{
      address: string;
      reason: string;
    }>;
  }> {
    const adminAddresses = (process.env.ADMIN_ADDRESSES || '')
      .split(',')
      .map(addr => addr.trim())
      .filter(addr => addr.length > 0);

    const valid: string[] = [];
    const conflicts: Array<{ address: string; conflict: RoleConflictResult }> = [];
    const invalid: Array<{ address: string; reason: string }> = [];

    for (const address of adminAddresses) {
      // Validate address format
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        invalid.push({
          address,
          reason: 'Invalid Ethereum address format'
        });
        continue;
      }

      try {
        const conflict = await this.checkRoleConflict(address);
        if (conflict.hasConflict) {
          conflicts.push({ address, conflict });
        } else {
          valid.push(address);
        }
      } catch (error) {
        invalid.push({
          address,
          reason: `Validation error: ${error.message}`
        });
      }
    }

    return { valid, conflicts, invalid };
  }

  /**
   * Promote a wallet address to admin with proper conflict resolution
   */
  async promoteToAdmin(
    walletAddress: string, 
    options: RolePromotionOptions
  ): Promise<RolePromotionResult> {
    const normalizedAddress = walletAddress.toLowerCase();
    const result: RolePromotionResult = {
      success: false,
      conflictResolved: false,
      adminCreated: false,
      errors: []
    };

    try {
      // Start transaction
      await this.db.query('BEGIN');

      // Check for conflicts
      const conflict = await this.checkRoleConflict(walletAddress);
      
      if (conflict.hasConflict && options.action !== 'force') {
        // Handle the conflict based on action
        if (options.action === 'deactivate') {
          await this.deactivateExistingRole(normalizedAddress, conflict.existingRole!);
          result.conflictResolved = true;
          result.previousRole = conflict.existingRole;
        } else if (options.action === 'preserve') {
          // Keep existing role active but log the promotion
          logger.warn(`Promoting ${normalizedAddress} to admin while preserving ${conflict.existingRole} role`);
          result.previousRole = conflict.existingRole;
        }
      } else if (conflict.hasConflict && options.action === 'force') {
        logger.warn(`Force promoting ${normalizedAddress} to admin despite ${conflict.existingRole} role conflict`);
        result.previousRole = conflict.existingRole;
      }

      // Create admin record
      const adminCreated = await this.createAdminRecord(normalizedAddress, options);
      result.adminCreated = adminCreated;

      // Create audit log
      result.auditLog = await this.createAuditLog({
        walletAddress: normalizedAddress,
        action: 'admin_promotion',
        previousRole: conflict.existingRole,
        promotionAction: options.action,
        reason: options.reason,
        promotedBy: options.promotedBy || 'system'
      });

      await this.db.query('COMMIT');
      result.success = true;

      logger.info(`Successfully promoted ${normalizedAddress} to admin`, {
        previousRole: result.previousRole,
        action: options.action,
        conflictResolved: result.conflictResolved
      });

    } catch (error) {
      await this.db.query('ROLLBACK');
      result.errors.push(`Promotion failed: ${error.message}`);
      logger.error('Admin promotion failed:', error);
    }

    return result;
  }

  /**
   * Deactivate existing role (customer or shop)
   */
  private async deactivateExistingRole(walletAddress: string, role: 'customer' | 'shop'): Promise<void> {
    if (role === 'customer') {
      await this.db.query(
        'UPDATE customers SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE LOWER(wallet_address) = $1',
        [walletAddress]
      );
    } else if (role === 'shop') {
      await this.db.query(
        'UPDATE shops SET active = false, updated_at = CURRENT_TIMESTAMP WHERE LOWER(wallet_address) = $1',
        [walletAddress]
      );
    }
  }

  /**
   * Create admin record in database
   */
  private async createAdminRecord(walletAddress: string, options: RolePromotionOptions): Promise<boolean> {
    try {
      // Check if admin already exists
      const existingQuery = 'SELECT wallet_address FROM admins WHERE LOWER(wallet_address) = $1';
      const existing = await this.db.query(existingQuery, [walletAddress]);

      if (existing.rows.length > 0) {
        // Update existing admin to ensure it's active
        await this.db.query(
          'UPDATE admins SET is_super_admin = true, updated_at = CURRENT_TIMESTAMP WHERE LOWER(wallet_address) = $1',
          [walletAddress]
        );
        return false; // Didn't create new, updated existing
      }

      // Create new admin record
      await this.db.query(`
        INSERT INTO admins (
          wallet_address, 
          name, 
          permissions, 
          is_super_admin, 
          created_by,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      `, [
        walletAddress,
        'Super Administrator',
        JSON.stringify(['all']),
        true,
        options.promotedBy || 'system'
      ]);

      return true; // Created new admin
    } catch (error) {
      logger.error('Failed to create admin record:', error);
      throw error;
    }
  }

  /**
   * Create audit log entry
   */
  private async createAuditLog(data: {
    walletAddress: string;
    action: string;
    previousRole?: string;
    promotionAction: string;
    reason?: string;
    promotedBy: string;
  }): Promise<any> {
    const auditEntry = {
      action: data.action,
      timestamp: new Date(),
      details: {
        walletAddress: data.walletAddress,
        previousRole: data.previousRole,
        promotionAction: data.promotionAction,
        reason: data.reason,
        promotedBy: data.promotedBy
      }
    };

    // Store in audit table (create if doesn't exist)
    try {
      await this.db.query(`
        CREATE TABLE IF NOT EXISTS admin_role_audit (
          id SERIAL PRIMARY KEY,
          wallet_address VARCHAR(42) NOT NULL,
          action VARCHAR(50) NOT NULL,
          previous_role VARCHAR(20),
          promotion_action VARCHAR(20),
          reason TEXT,
          promoted_by VARCHAR(42),
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          details JSONB
        )
      `);

      await this.db.query(`
        INSERT INTO admin_role_audit (
          wallet_address, action, previous_role, promotion_action, reason, promoted_by, details
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        data.walletAddress,
        data.action,
        data.previousRole,
        data.promotionAction,
        data.reason,
        data.promotedBy,
        JSON.stringify(auditEntry.details)
      ]);

    } catch (error) {
      logger.error('Failed to create audit log:', error);
      // Don't throw - audit failure shouldn't block promotion
    }

    return auditEntry;
  }

  /**
   * Get role promotion history for an address
   */
  async getRoleHistory(walletAddress: string): Promise<any[]> {
    try {
      const result = await this.db.query(`
        SELECT * FROM admin_role_audit 
        WHERE LOWER(wallet_address) = $1 
        ORDER BY timestamp DESC
      `, [walletAddress.toLowerCase()]);

      return result.rows;
    } catch (error) {
      logger.error('Failed to get role history:', error);
      return [];
    }
  }

  /**
   * Generate conflict resolution report
   */
  async generateConflictReport(): Promise<{
    summary: {
      totalAdminAddresses: number;
      conflictCount: number;
      validCount: number;
      invalidCount: number;
    };
    details: {
      conflicts: Array<{
        address: string;
        existingRole: string;
        existingData: any;
        recommendations: string[];
      }>;
      invalid: Array<{
        address: string;
        reason: string;
      }>;
    };
  }> {
    const validation = await this.validateAdminAddresses();
    
    const conflicts = validation.conflicts.map(item => ({
      address: item.address,
      existingRole: item.conflict.existingRole!,
      existingData: item.conflict.existingData,
      recommendations: [
        `Use 'deactivate' to disable ${item.conflict.existingRole} role`,
        `Use 'preserve' to keep both roles active`,
        `Use 'force' to ignore conflict (not recommended)`
      ]
    }));

    return {
      summary: {
        totalAdminAddresses: validation.valid.length + validation.conflicts.length + validation.invalid.length,
        conflictCount: validation.conflicts.length,
        validCount: validation.valid.length,
        invalidCount: validation.invalid.length
      },
      details: {
        conflicts,
        invalid: validation.invalid
      }
    };
  }
}