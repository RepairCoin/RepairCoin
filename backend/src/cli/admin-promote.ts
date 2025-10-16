#!/usr/bin/env node

import { AdminRoleConflictService } from '../services/AdminRoleConflictService';
import { logger } from '../utils/logger';

interface PromoteOptions {
  address: string;
  action: 'deactivate' | 'preserve' | 'force';
  reason?: string;
  dryRun?: boolean;
}

class AdminPromoteCLI {
  private conflictService: AdminRoleConflictService;

  constructor() {
    this.conflictService = new AdminRoleConflictService();
  }

  async promote(options: PromoteOptions): Promise<void> {
    const { address, action, reason, dryRun } = options;

    logger.info('🔧 Admin Promotion CLI');
    logger.info(`   Address: ${address}`);
    logger.info(`   Action: ${action}`);
    logger.info(`   Reason: ${reason || 'Not specified'}`);
    logger.info(`   Dry Run: ${dryRun ? 'Yes' : 'No'}`);
    logger.info('');

    try {
      // Validate address format
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        throw new Error('Invalid Ethereum address format');
      }

      // Check for conflicts
      logger.info('🔍 Checking for role conflicts...');
      const conflict = await this.conflictService.checkRoleConflict(address);

      if (!conflict.hasConflict) {
        logger.info('✅ No role conflicts detected');
        
        if (dryRun) {
          logger.info('🧪 [DRY RUN] Would create admin record without conflicts');
          return;
        }

        // No conflicts, proceed with promotion
        const result = await this.conflictService.promoteToAdmin(address, {
          action: 'preserve', // No conflicts to resolve
          reason: reason || 'Promoted via CLI - no conflicts',
          promotedBy: 'admin-cli'
        });

        if (result.success) {
          logger.info('✅ Admin promotion successful');
        } else {
          logger.error('❌ Admin promotion failed:', result.errors.join(', '));
        }
        return;
      }

      // Handle conflicts
      logger.warn('⚠️ Role conflict detected:');
      logger.warn(`   Existing role: ${conflict.existingRole}`);
      if (conflict.existingData) {
        logger.warn(`   ID: ${conflict.existingData.id}`);
        logger.warn(`   Name: ${conflict.existingData.name || 'N/A'}`);
        logger.warn(`   Email: ${conflict.existingData.email || 'N/A'}`);
        logger.warn(`   Active: ${conflict.existingData.isActive}`);
        logger.warn(`   Created: ${conflict.existingData.createdAt}`);
      }
      logger.warn('');

      if (dryRun) {
        logger.info('🧪 [DRY RUN] Would resolve conflict with action:', action);
        
        switch (action) {
          case 'deactivate':
            logger.info(`   - Deactivate existing ${conflict.existingRole} role`);
            logger.info('   - Create admin record');
            break;
          case 'preserve':
            logger.info(`   - Keep existing ${conflict.existingRole} role active`);
            logger.info('   - Create admin record (both roles active)');
            break;
          case 'force':
            logger.info(`   - Ignore ${conflict.existingRole} role conflict`);
            logger.info('   - Create admin record forcefully');
            break;
        }
        return;
      }

      // Confirm promotion with conflict resolution
      logger.info(`🚀 Proceeding with admin promotion (action: ${action})`);
      
      const result = await this.conflictService.promoteToAdmin(address, {
        action,
        reason: reason || `Promoted via CLI with ${action} action`,
        promotedBy: 'admin-cli'
      });

      if (result.success) {
        logger.info('✅ Admin promotion successful');
        logger.info(`   Conflict resolved: ${result.conflictResolved}`);
        logger.info(`   Previous role: ${result.previousRole || 'none'}`);
        logger.info(`   Admin created: ${result.adminCreated}`);
        
        if (result.auditLog) {
          logger.info('📋 Audit log created:', result.auditLog.action);
        }
      } else {
        logger.error('❌ Admin promotion failed:');
        result.errors.forEach(error => {
          logger.error(`   - ${error}`);
        });
      }

    } catch (error) {
      logger.error('💥 Error during admin promotion:', error.message);
      process.exit(1);
    }
  }

  async checkConflicts(): Promise<void> {
    logger.info('🔍 Checking all admin addresses for conflicts...');
    
    try {
      const report = await this.conflictService.generateConflictReport();
      
      logger.info('📊 Conflict Report Summary:');
      logger.info(`   Total admin addresses: ${report.summary.totalAdminAddresses}`);
      logger.info(`   Valid addresses: ${report.summary.validCount}`);
      logger.info(`   Conflicts detected: ${report.summary.conflictCount}`);
      logger.info(`   Invalid addresses: ${report.summary.invalidCount}`);
      logger.info('');

      if (report.details.conflicts.length > 0) {
        logger.warn('⚠️ Conflicts detected:');
        report.details.conflicts.forEach((conflict, index) => {
          logger.warn(`   ${index + 1}. ${conflict.address}`);
          logger.warn(`      Existing role: ${conflict.existingRole}`);
          logger.warn(`      Recommendations:`);
          conflict.recommendations.forEach(rec => {
            logger.warn(`        - ${rec}`);
          });
          logger.warn('');
        });
      }

      if (report.details.invalid.length > 0) {
        logger.error('❌ Invalid addresses:');
        report.details.invalid.forEach((invalid, index) => {
          logger.error(`   ${index + 1}. ${invalid.address}: ${invalid.reason}`);
        });
      }

      if (report.summary.conflictCount === 0 && report.summary.invalidCount === 0) {
        logger.info('✅ All admin addresses are valid with no conflicts');
      }

    } catch (error) {
      logger.error('💥 Error checking conflicts:', error.message);
      process.exit(1);
    }
  }

  async showHistory(address: string): Promise<void> {
    logger.info(`📚 Role history for ${address}:`);
    
    try {
      const history = await this.conflictService.getRoleHistory(address);
      
      if (history.length === 0) {
        logger.info('   No role changes recorded');
        return;
      }

      history.forEach((entry, index) => {
        logger.info(`   ${index + 1}. ${entry.action} - ${entry.timestamp}`);
        logger.info(`      Previous role: ${entry.previous_role || 'none'}`);
        logger.info(`      Action: ${entry.promotion_action}`);
        logger.info(`      Promoted by: ${entry.promoted_by}`);
        if (entry.reason) {
          logger.info(`      Reason: ${entry.reason}`);
        }
        logger.info('');
      });

    } catch (error) {
      logger.error('💥 Error getting role history:', error.message);
      process.exit(1);
    }
  }

  printUsage(): void {
    console.log(`
🔧 Admin Promotion CLI

Usage:
  npm run admin:promote <address> --action <action> [options]
  npm run admin:check-conflicts
  npm run admin:history <address>

Commands:
  promote <address>     Promote an address to admin with conflict resolution
  check-conflicts       Check all admin addresses for role conflicts  
  history <address>     Show role change history for an address

Options:
  --action <action>     Conflict resolution action: deactivate|preserve|force
                        - deactivate: Disable existing customer/shop role
                        - preserve: Keep existing role active (both roles)
                        - force: Ignore conflicts (not recommended)
  
  --reason <reason>     Reason for the promotion (for audit)
  --dry-run            Show what would happen without making changes

Examples:
  npm run admin:promote 0x123...abc --action deactivate --reason "Owner promotion"
  npm run admin:promote 0x456...def --action preserve --dry-run
  npm run admin:check-conflicts
  npm run admin:history 0x789...ghi
`);
  }
}

// CLI entry point
async function main() {
  const args = process.argv.slice(2);
  const cli = new AdminPromoteCLI();

  if (args.length === 0) {
    cli.printUsage();
    process.exit(0);
  }

  const command = args[0];

  try {
    switch (command) {
      case 'promote': {
        const address = args[1];
        if (!address) {
          logger.error('❌ Address is required for promote command');
          cli.printUsage();
          process.exit(1);
        }

        const actionIndex = args.indexOf('--action');
        const action = actionIndex !== -1 ? args[actionIndex + 1] : undefined;
        
        if (!action || !['deactivate', 'preserve', 'force'].includes(action)) {
          logger.error('❌ Valid --action is required: deactivate, preserve, or force');
          cli.printUsage();
          process.exit(1);
        }

        const reasonIndex = args.indexOf('--reason');
        const reason = reasonIndex !== -1 ? args[reasonIndex + 1] : undefined;
        
        const dryRun = args.includes('--dry-run');

        await cli.promote({ address, action: action as any, reason, dryRun });
        break;
      }

      case 'check-conflicts':
        await cli.checkConflicts();
        break;

      case 'history': {
        const address = args[1];
        if (!address) {
          logger.error('❌ Address is required for history command');
          cli.printUsage();
          process.exit(1);
        }
        await cli.showHistory(address);
        break;
      }

      default:
        logger.error(`❌ Unknown command: ${command}`);
        cli.printUsage();
        process.exit(1);
    }
  } catch (error) {
    logger.error('💥 CLI error:', error.message);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    logger.error('💥 Unhandled error:', error);
    process.exit(1);
  });
}

export { AdminPromoteCLI };