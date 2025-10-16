import { AdminRoleConflictService } from './AdminRoleConflictService';
import { logger } from '../utils/logger';

export class StartupValidationService {
  private adminRoleConflictService: AdminRoleConflictService;

  constructor() {
    this.adminRoleConflictService = new AdminRoleConflictService();
  }

  /**
   * Validate admin addresses during application startup
   */
  async validateAdminAddressesOnStartup(): Promise<{
    success: boolean;
    warnings: string[];
    errors: string[];
    conflictReport?: any;
  }> {
    const result: {
      success: boolean;
      warnings: string[];
      errors: string[];
      conflictReport?: any;
    } = {
      success: true,
      warnings: [],
      errors: []
    };

    try {
      logger.info('🔍 Validating ADMIN_ADDRESSES configuration...');

      // Check if ADMIN_ADDRESSES is set
      const adminAddressesEnv = process.env.ADMIN_ADDRESSES;
      if (!adminAddressesEnv || adminAddressesEnv.trim() === '') {
        result.warnings.push('ADMIN_ADDRESSES environment variable is not set or empty');
        logger.warn('⚠️ No admin addresses configured in environment');
        return result;
      }

      // Validate all admin addresses
      const validation = await this.adminRoleConflictService.validateAdminAddresses();

      // Report invalid addresses
      if (validation.invalid.length > 0) {
        validation.invalid.forEach(invalid => {
          const error = `Invalid admin address: ${invalid.address} - ${invalid.reason}`;
          result.errors.push(error);
          logger.error(`❌ ${error}`);
        });
        result.success = false;
      }

      // Report conflicts
      if (validation.conflicts.length > 0) {
        const conflictReport = await this.adminRoleConflictService.generateConflictReport();
        result.conflictReport = conflictReport;

        validation.conflicts.forEach(conflict => {
          const warning = `Role conflict detected: ${conflict.address} is already registered as ${conflict.conflict.existingRole}`;
          result.warnings.push(warning);
          logger.warn(`⚠️ ${warning}`);
          
          if (conflict.conflict.existingData) {
            logger.warn(`   Existing ${conflict.conflict.existingRole} details:`, {
              id: conflict.conflict.existingData.id,
              name: conflict.conflict.existingData.name,
              email: conflict.conflict.existingData.email,
              isActive: conflict.conflict.existingData.isActive
            });
          }
        });

        // Provide resolution guidance
        logger.warn('📋 Role Conflict Resolution Options:');
        logger.warn('   1. Remove conflicted addresses from ADMIN_ADDRESSES');
        logger.warn('   2. Use CLI command to promote with role resolution:');
        logger.warn('      npm run admin:promote <address> --action deactivate|preserve|force');
        logger.warn('   3. Set ADMIN_SKIP_CONFLICT_CHECK=true to bypass (not recommended)');
      }

      // Report valid addresses
      if (validation.valid.length > 0) {
        logger.info(`✅ Valid admin addresses configured: ${validation.valid.length}`);
        validation.valid.forEach(address => {
          logger.debug(`   ✓ ${address}`);
        });
      }

      // Summary
      const total = validation.valid.length + validation.conflicts.length + validation.invalid.length;
      logger.info('📊 Admin Address Validation Summary:');
      logger.info(`   Total addresses: ${total}`);
      logger.info(`   Valid: ${validation.valid.length}`);
      logger.info(`   Conflicts: ${validation.conflicts.length}`);
      logger.info(`   Invalid: ${validation.invalid.length}`);

      // Determine if startup should continue
      const skipConflictCheck = process.env.ADMIN_SKIP_CONFLICT_CHECK === 'true';
      
      if (validation.conflicts.length > 0 && !skipConflictCheck) {
        logger.error('🚫 Application startup blocked due to admin role conflicts');
        logger.error('   Set ADMIN_SKIP_CONFLICT_CHECK=true to bypass validation (not recommended)');
        logger.error('   Or resolve conflicts using the admin promotion CLI');
        result.success = false;
        result.errors.push('Admin role conflicts detected - startup blocked');
      } else if (validation.conflicts.length > 0 && skipConflictCheck) {
        logger.warn('⚠️ Admin role conflicts detected but bypassed by ADMIN_SKIP_CONFLICT_CHECK=true');
        result.warnings.push('Role conflicts bypassed - security risk');
      }

    } catch (error) {
      const errorMsg = `Admin address validation failed: ${error.message}`;
      result.errors.push(errorMsg);
      result.success = false;
      logger.error(`❌ ${errorMsg}`, error);
    }

    return result;
  }

  /**
   * Check for role conflicts during runtime (for monitoring)
   */
  async performRuntimeConflictCheck(): Promise<void> {
    try {
      const validation = await this.adminRoleConflictService.validateAdminAddresses();
      
      if (validation.conflicts.length > 0) {
        logger.warn('🔍 Runtime admin role conflict check detected issues:');
        validation.conflicts.forEach(conflict => {
          logger.warn(`   ${conflict.address} has ${conflict.conflict.existingRole} role conflict`);
        });
      }
    } catch (error) {
      logger.error('Runtime conflict check failed:', error);
    }
  }

  /**
   * Validate environment configuration
   */
  validateEnvironmentConfig(): {
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check ADMIN_ADDRESSES format
    const adminAddresses = process.env.ADMIN_ADDRESSES;
    if (adminAddresses) {
      const addresses = adminAddresses.split(',').map(addr => addr.trim());
      
      // Check for duplicates
      const uniqueAddresses = new Set(addresses.map(addr => addr.toLowerCase()));
      if (uniqueAddresses.size !== addresses.length) {
        issues.push('Duplicate addresses found in ADMIN_ADDRESSES');
        recommendations.push('Remove duplicate addresses from ADMIN_ADDRESSES');
      }

      // Check for empty addresses
      if (addresses.some(addr => addr === '')) {
        issues.push('Empty addresses found in ADMIN_ADDRESSES');
        recommendations.push('Remove empty addresses from ADMIN_ADDRESSES');
      }

      // Check address format
      addresses.forEach(addr => {
        if (addr && !/^0x[a-fA-F0-9]{40}$/.test(addr)) {
          issues.push(`Invalid address format: ${addr}`);
          recommendations.push(`Fix address format for: ${addr}`);
        }
      });
    }

    // Check other security-related env vars
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      issues.push('JWT_SECRET is missing or too short');
      recommendations.push('Set JWT_SECRET to at least 32 characters');
    }

    return {
      isValid: issues.length === 0,
      issues,
      recommendations
    };
  }

  /**
   * Full startup validation including environment and admin addresses
   */
  async performFullStartupValidation(): Promise<{
    canStart: boolean;
    adminValidation: any;
    envValidation: any;
    summary: {
      totalIssues: number;
      criticalIssues: number;
      warnings: number;
    };
  }> {
    logger.info('🚀 Performing full startup validation...');

    // Environment validation
    const envValidation = this.validateEnvironmentConfig();
    
    // Admin address validation
    const adminValidation = await this.validateAdminAddressesOnStartup();

    const criticalIssues = envValidation.issues.length + adminValidation.errors.length;
    const warnings = adminValidation.warnings.length;
    const totalIssues = criticalIssues + warnings;

    const canStart = envValidation.isValid && adminValidation.success;

    if (!canStart) {
      logger.error('🚫 Application cannot start due to validation failures');
    } else if (warnings > 0) {
      logger.warn(`⚠️ Application starting with ${warnings} warnings`);
    } else {
      logger.info('✅ All validations passed - application ready to start');
    }

    return {
      canStart,
      adminValidation,
      envValidation,
      summary: {
        totalIssues,
        criticalIssues,
        warnings
      }
    };
  }
}