#!/usr/bin/env node

/**
 * AdminService Refactoring Script
 *
 * This script automatically extracts methods from AdminService.ts
 * into specialized service files following the extraction map.
 *
 * Usage: node scripts/refactor-admin-service.js
 */

const fs = require('fs');
const path = require('path');

const ADMIN_SERVICE_PATH = path.join(__dirname, '../backend/src/domains/admin/services/AdminService.ts');
const SERVICES_DIR = path.join(__dirname, '../backend/src/domains/admin/services');

console.log('🔧 AdminService Refactoring Tool\n');

// Read the current AdminService
const adminServiceContent = fs.readFileSync(ADMIN_SERVICE_PATH, 'utf8');
const lines = adminServiceContent.split('\n');

console.log(`📄 AdminService has ${lines.length} lines\n`);

// Helper to extract method by name
function extractMethod(methodName, startHint, endHint) {
  const startPattern = new RegExp(`async ${methodName}\\(`);
  let startLine = -1;
  let endLine = -1;
  let braceCount = 0;
  let inMethod = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (startPattern.test(line) && startLine === -1) {
      startLine = i;
      inMethod = true;
    }

    if (inMethod) {
      // Count braces
      for (const char of line) {
        if (char === '{') braceCount++;
        if (char === '}') braceCount--;
      }

      // Method ends when braces balance
      if (braceCount === 0 && startLine !== i) {
        endLine = i;
        break;
      }
    }
  }

  if (startLine === -1 || endLine === -1) {
    console.warn(`⚠️  Could not find method: ${methodName}`);
    return null;
  }

  const methodLines = lines.slice(startLine, endLine + 1);
  return {
    name: methodName,
    startLine,
    endLine,
    content: methodLines.join('\n'),
    lineCount: methodLines.length
  };
}

// Service definitions
const services = {
  'ShopManagementService': {
    file: 'management/ShopManagementService.ts',
    methods: [
      'getShops',
      'approveShop',
      'createShop',
      'suspendShop',
      'unsuspendShop',
      'updateShop',
      'verifyShop',
      'getUnsuspendRequests',
      'approveUnsuspendRequest',
      'rejectUnsuspendRequest'
    ],
    imports: `import { shopRepository, adminRepository } from '../../../../repositories';
import { logger } from '../../../../utils/logger';
import { eventBus, createDomainEvent } from '../../../../events/EventBus';`
  },
  'CustomerManagementService': {
    file: 'management/CustomerManagementService.ts',
    methods: [
      'getCustomers',
      'suspendCustomer',
      'unsuspendCustomer'
    ],
    imports: `import { customerRepository, adminRepository } from '../../../../repositories';
import { logger } from '../../../../utils/logger';
import { eventBus, createDomainEvent } from '../../../../events/EventBus';
import { TierLevel } from '../../../../contracts/TierManager';`
  },
  'TokenOperationsService': {
    file: 'operations/TokenOperationsService.ts',
    methods: [
      'manualMint',
      'processManualRedemption',
      'sellRcnToShop',
      'getShopsWithPendingMints',
      'mintShopBalance'
    ],
    imports: `import {
  customerRepository,
  shopRepository,
  transactionRepository,
  adminRepository,
  treasuryRepository
} from '../../../../repositories';
import { TokenMinter } from '../../../../contracts/TokenMinter';
import { TierManager } from '../../../../contracts/TierManager';
import { logger } from '../../../../utils/logger';
import { eventBus, createDomainEvent } from '../../../../events/EventBus';`
  }
};

console.log('📦 Services to extract:\n');
Object.keys(services).forEach(serviceName => {
  console.log(`   - ${serviceName} (${services[serviceName].methods.length} methods)`);
});
console.log('');

// Extract each service
Object.entries(services).forEach(([serviceName, config]) => {
  console.log(`\n🔨 Extracting ${serviceName}...`);

  const extractedMethods = [];
  let totalLines = 0;

  config.methods.forEach(methodName => {
    const method = extractMethod(methodName);
    if (method) {
      extractedMethods.push(method);
      totalLines += method.lineCount;
      console.log(`   ✓ ${methodName} (${method.lineCount} lines)`);
    } else {
      console.log(`   ✗ ${methodName} - NOT FOUND`);
    }
  });

  // Generate service file content
  const className = serviceName;
  const instanceName = serviceName.charAt(0).toLowerCase() + serviceName.slice(1);

  const serviceContent = `// backend/src/domains/admin/services/${config.file}
${config.imports}

/**
 * ${serviceName}
 * Extracted from AdminService for better maintainability
 */
export class ${className} {
  private tokenMinter: TokenMinter | null = null;
  private tierManager: TierManager | null = null;

  private getTokenMinterInstance(): TokenMinter {
    if (!this.tokenMinter) {
      this.tokenMinter = new TokenMinter();
    }
    return this.tokenMinter;
  }

  private getTierManager(): TierManager {
    if (!this.tierManager) {
      this.tierManager = new TierManager();
    }
    return this.tierManager;
  }

${extractedMethods.map(m => '  ' + m.content.split('\n').map((line, i) => i === 0 ? line : '  ' + line).join('\n')).join('\n\n')}
}

// Export singleton instance
export const ${instanceName} = new ${className}();
`;

  // Create directory if it doesn't exist
  const serviceDir = path.join(SERVICES_DIR, path.dirname(config.file));
  if (!fs.existsSync(serviceDir)) {
    fs.mkdirSync(serviceDir, { recursive: true });
    console.log(`   📁 Created directory: ${path.dirname(config.file)}`);
  }

  // Write service file
  const servicePath = path.join(SERVICES_DIR, config.file);
  fs.writeFileSync(servicePath, serviceContent, 'utf8');
  console.log(`   ✅ Created ${config.file} (${totalLines} lines)`);
});

console.log('\n✅ Extraction complete!\n');
console.log('📝 Next steps:');
console.log('   1. Update AdminService.ts to import and delegate to these services');
console.log('   2. Run: cd backend && npm run typecheck');
console.log('   3. Fix any TypeScript errors');
console.log('   4. Test the application\n');

