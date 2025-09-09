#!/usr/bin/env node

// backend/src/cli/admin.ts
import { Command } from 'commander';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { AdminService } from '../domains/admin/services/AdminService';
import { adminRepository } from '../repositories';
import { logger } from '../utils/logger';
import { validateEthereumAddress } from '../utils/validators';

// Dynamic imports for ESM modules
const inquirer = require('inquirer');
const ora = require('ora');

// Chalk color functions
const chalk = {
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
  gray: (text: string) => `\x1b[90m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
  bold: (text: string) => `\x1b[1m${text}\x1b[0m`,
  underline: (text: string) => `\x1b[4m${text}\x1b[0m`
};

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const program = new Command();
const adminService = new AdminService();

// Helper function to check if user is super admin
async function checkSuperAdminAccess(): Promise<boolean> {
  const superAdminAddress = process.env.SUPER_ADMIN_ADDRESS || 
    (process.env.ADMIN_ADDRESSES?.split(',')[0] || '').trim();
  
  if (!superAdminAddress) {
    console.error(chalk.red('❌ No super admin configured in environment'));
    return false;
  }

  console.log(chalk.gray(`Super admin address: ${superAdminAddress}`));
  return true;
}

// Helper function to format permissions
function formatPermissions(permissions: string[]): string {
  if (permissions.includes('all') || permissions.includes('*')) {
    return chalk.green('All Permissions');
  }
  return permissions.map(p => chalk.cyan(p)).join(', ');
}

// Main CLI configuration
program
  .name('repaircoin-admin')
  .description('RepairCoin Admin CLI for managing administrators')
  .version('1.0.0');

// List all admins command
program
  .command('list')
  .alias('ls')
  .description('List all administrators')
  .option('-a, --all', 'Include inactive admins')
  .action(async (options) => {
    const spinner = ora('Fetching administrators...').start();
    
    try {
      const admins = await adminRepository.getAllAdmins();
      const filteredAdmins = options.all ? admins : admins.filter(a => a.isActive);
      
      spinner.succeed(`Found ${filteredAdmins.length} admin${filteredAdmins.length !== 1 ? 's' : ''}`);
      
      if (filteredAdmins.length === 0) {
        console.log(chalk.yellow('No administrators found.'));
        return;
      }

      console.log('\n' + chalk.bold(chalk.underline('Administrators:')));
      
      filteredAdmins.forEach((admin, index) => {
        console.log(`\n${chalk.gray(`[${index + 1}]`)} ${chalk.bold(admin.name || 'Unnamed Admin')}`);
        console.log(`    ${chalk.gray('Wallet:')} ${admin.walletAddress}`);
        console.log(`    ${chalk.gray('Email:')} ${admin.email || 'Not set'}`);
        console.log(`    ${chalk.gray('Permissions:')} ${formatPermissions(admin.permissions)}`);
        console.log(`    ${chalk.gray('Status:')} ${admin.isActive ? chalk.green('Active') : chalk.red('Inactive')}`);
        console.log(`    ${chalk.gray('Super Admin:')} ${admin.isSuperAdmin ? chalk.yellow('Yes') : 'No'}`);
        console.log(`    ${chalk.gray('Created:')} ${new Date(admin.createdAt).toLocaleDateString()}`);
        if (admin.lastLogin) {
          console.log(`    ${chalk.gray('Last Login:')} ${new Date(admin.lastLogin).toLocaleDateString()}`);
        }
      });
      
    } catch (error: any) {
      spinner.fail('Failed to fetch administrators');
      console.error(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });

// Add new admin command
program
  .command('add')
  .alias('create')
  .description('Add a new administrator')
  .option('-w, --wallet <address>', 'Wallet address (will prompt if not provided)')
  .option('-n, --name <name>', 'Administrator name')
  .option('-e, --email <email>', 'Email address')
  .option('-p, --permissions <permissions...>', 'Permissions (space-separated)')
  .option('--super', 'Grant super admin privileges')
  .action(async (options) => {
    try {
      // Check super admin access
      const hasSuperAdmin = await checkSuperAdminAccess();
      if (!hasSuperAdmin) {
        console.error(chalk.red('❌ This operation requires super admin privileges'));
        process.exit(1);
      }

      // Collect admin details
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'walletAddress',
          message: 'Wallet address:',
          default: options.wallet,
          validate: (input) => {
            if (!validateEthereumAddress(input)) {
              return 'Please enter a valid Ethereum address';
            }
            return true;
          },
          when: !options.wallet
        },
        {
          type: 'input',
          name: 'name',
          message: 'Administrator name:',
          default: options.name,
          when: !options.name
        },
        {
          type: 'input',
          name: 'email',
          message: 'Email address (optional):',
          default: options.email,
          validate: (input) => {
            if (input && !input.includes('@')) {
              return 'Please enter a valid email address';
            }
            return true;
          }
        },
        {
          type: 'checkbox',
          name: 'permissions',
          message: 'Select permissions:',
          choices: [
            { name: 'All Permissions', value: 'all' },
            new inquirer.Separator(),
            { name: 'Manage Customers', value: 'manage_customers' },
            { name: 'Manage Shops', value: 'manage_shops' },
            { name: 'Manage Admins', value: 'manage_admins' },
            { name: 'View Reports', value: 'view_reports' },
            { name: 'Mint Tokens', value: 'mint_tokens' },
            { name: 'Pause/Unpause Contract', value: 'manage_contract' },
            { name: 'Manage Treasury', value: 'manage_treasury' }
          ],
          when: !options.permissions || options.permissions.length === 0
        },
        {
          type: 'confirm',
          name: 'isSuperAdmin',
          message: 'Grant super admin privileges?',
          default: options.super || false,
          when: options.super === undefined
        }
      ]);

      // Merge options with answers
      const adminData = {
        walletAddress: options.wallet || answers.walletAddress,
        name: options.name || answers.name,
        email: answers.email || options.email || undefined,
        permissions: options.permissions || answers.permissions || ['view_reports'],
        isSuperAdmin: options.super !== undefined ? options.super : answers.isSuperAdmin,
        createdBy: 'cli'
      };

      // Confirm creation
      console.log('\n' + chalk.bold('Admin Details:'));
      console.log(chalk.gray('Wallet:'), adminData.walletAddress);
      console.log(chalk.gray('Name:'), adminData.name);
      console.log(chalk.gray('Email:'), adminData.email || 'Not set');
      console.log(chalk.gray('Permissions:'), formatPermissions(adminData.permissions));
      console.log(chalk.gray('Super Admin:'), adminData.isSuperAdmin ? chalk.yellow('Yes') : 'No');

      const { confirm } = await inquirer.prompt({
        type: 'confirm',
        name: 'confirm',
        message: 'Create this administrator?',
        default: true
      });

      if (!confirm) {
        console.log(chalk.yellow('Admin creation cancelled.'));
        return;
      }

      const spinner = ora('Creating administrator...').start();

      const result = await adminService.createAdmin(adminData);

      spinner.succeed(chalk.green('✅ Administrator created successfully!'));
      console.log(chalk.gray(`Admin ID: ${result.admin.id}`));
      
    } catch (error: any) {
      console.error(chalk.red(`❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

// Update admin command
program
  .command('update <walletAddress>')
  .description('Update an administrator\'s details')
  .option('-n, --name <name>', 'Update name')
  .option('-e, --email <email>', 'Update email')
  .option('-p, --permissions <permissions...>', 'Update permissions (space-separated)')
  .option('--activate', 'Activate the admin')
  .option('--deactivate', 'Deactivate the admin')
  .option('--super', 'Grant super admin privileges')
  .option('--no-super', 'Remove super admin privileges')
  .action(async (walletAddress, options) => {
    try {
      // Validate wallet address
      if (!validateEthereumAddress(walletAddress)) {
        console.error(chalk.red('❌ Invalid wallet address'));
        process.exit(1);
      }

      const spinner = ora('Fetching admin details...').start();
      
      // Get current admin details
      const admin = await adminRepository.getAdmin(walletAddress);
      if (!admin) {
        spinner.fail('Administrator not found');
        process.exit(1);
      }

      spinner.succeed('Admin found');

      // Prepare updates
      const updates: any = {};
      
      if (options.name) updates.name = options.name;
      if (options.email) updates.email = options.email;
      if (options.permissions) updates.permissions = options.permissions;
      if (options.activate) updates.isActive = true;
      if (options.deactivate) updates.isActive = false;
      if (options.super !== undefined) updates.isSuperAdmin = options.super;

      // Show current vs new values
      console.log('\n' + chalk.bold('Current Details:'));
      console.log(chalk.gray('Name:'), admin.name || 'Not set');
      console.log(chalk.gray('Email:'), admin.email || 'Not set');
      console.log(chalk.gray('Permissions:'), formatPermissions(admin.permissions));
      console.log(chalk.gray('Status:'), admin.isActive ? chalk.green('Active') : chalk.red('Inactive'));
      console.log(chalk.gray('Super Admin:'), admin.isSuperAdmin ? chalk.yellow('Yes') : 'No');

      if (Object.keys(updates).length > 0) {
        console.log('\n' + chalk.bold('New Values:'));
        if (updates.name) console.log(chalk.gray('Name:'), updates.name);
        if (updates.email) console.log(chalk.gray('Email:'), updates.email);
        if (updates.permissions) console.log(chalk.gray('Permissions:'), formatPermissions(updates.permissions));
        if (updates.isActive !== undefined) {
          console.log(chalk.gray('Status:'), updates.isActive ? chalk.green('Active') : chalk.red('Inactive'));
        }
        if (updates.isSuperAdmin !== undefined) {
          console.log(chalk.gray('Super Admin:'), updates.isSuperAdmin ? chalk.yellow('Yes') : 'No');
        }

        const { confirm } = await inquirer.prompt({
          type: 'confirm',
          name: 'confirm',
          message: 'Apply these updates?',
          default: true
        });

        if (!confirm) {
          console.log(chalk.yellow('Update cancelled.'));
          return;
        }

        const updateSpinner = ora('Updating administrator...').start();
        
        await adminRepository.updateAdmin(walletAddress, updates);
        
        updateSpinner.succeed(chalk.green('✅ Administrator updated successfully!'));
      } else {
        console.log(chalk.yellow('\nNo updates specified.'));
      }
      
    } catch (error: any) {
      console.error(chalk.red(`❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

// Remove admin command
program
  .command('remove <walletAddress>')
  .alias('delete')
  .description('Remove an administrator')
  .option('-f, --force', 'Skip confirmation')
  .action(async (walletAddress, options) => {
    try {
      // Validate wallet address
      if (!validateEthereumAddress(walletAddress)) {
        console.error(chalk.red('❌ Invalid wallet address'));
        process.exit(1);
      }

      // Check if this is the super admin
      const superAdminAddress = (process.env.ADMIN_ADDRESSES?.split(',')[0] || '').trim();
      if (walletAddress.toLowerCase() === superAdminAddress.toLowerCase()) {
        console.error(chalk.red('❌ Cannot remove the primary super admin'));
        process.exit(1);
      }

      const spinner = ora('Checking administrator...').start();
      
      // Get admin details
      const admin = await adminRepository.getAdmin(walletAddress);
      if (!admin) {
        spinner.fail('Administrator not found');
        process.exit(1);
      }

      spinner.succeed('Admin found');

      // Show admin details
      console.log('\n' + chalk.bold('Administrator to remove:'));
      console.log(chalk.gray('Name:'), admin.name || 'Not set');
      console.log(chalk.gray('Wallet:'), admin.walletAddress);
      console.log(chalk.gray('Email:'), admin.email || 'Not set');
      console.log(chalk.gray('Super Admin:'), admin.isSuperAdmin ? chalk.yellow('Yes') : 'No');

      if (!options.force) {
        const { confirm } = await inquirer.prompt({
          type: 'confirm',
          name: 'confirm',
          message: chalk.red('Are you sure you want to remove this administrator?'),
          default: false
        });

        if (!confirm) {
          console.log(chalk.yellow('Removal cancelled.'));
          return;
        }
      }

      const deleteSpinner = ora('Removing administrator...').start();
      
      const deleted = await adminRepository.deleteAdmin(walletAddress);
      
      if (deleted) {
        deleteSpinner.succeed(chalk.green('✅ Administrator removed successfully!'));
      } else {
        deleteSpinner.fail('Failed to remove administrator');
      }
      
    } catch (error: any) {
      console.error(chalk.red(`❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

// Check admin status command
program
  .command('check <walletAddress>')
  .description('Check if a wallet address is an administrator')
  .action(async (walletAddress) => {
    try {
      // Validate wallet address
      if (!validateEthereumAddress(walletAddress)) {
        console.error(chalk.red('❌ Invalid wallet address'));
        process.exit(1);
      }

      const spinner = ora('Checking admin status...').start();
      
      const isAdmin = await adminService.checkAdminAccess(walletAddress);
      
      if (isAdmin) {
        spinner.succeed(chalk.green('✅ This address is an administrator'));
        
        // Get detailed info
        const admin = await adminRepository.getAdmin(walletAddress);
        if (admin) {
          console.log('\n' + chalk.bold('Admin Details:'));
          console.log(chalk.gray('Name:'), admin.name || 'Not set');
          console.log(chalk.gray('Email:'), admin.email || 'Not set');
          console.log(chalk.gray('Permissions:'), formatPermissions(admin.permissions));
          console.log(chalk.gray('Status:'), admin.isActive ? chalk.green('Active') : chalk.red('Inactive'));
          console.log(chalk.gray('Super Admin:'), admin.isSuperAdmin ? chalk.yellow('Yes') : 'No');
        }
      } else {
        spinner.fail(chalk.yellow('⚠️  This address is not an administrator'));
      }
      
    } catch (error: any) {
      console.error(chalk.red(`❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

// Interactive mode
program
  .command('interactive')
  .alias('i')
  .description('Run in interactive mode')
  .action(async () => {
    console.log(chalk.bold(chalk.blue('\n🛠️  RepairCoin Admin Management\n')));

    let running = true;
    while (running) {
      const { action } = await inquirer.prompt({
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'List all administrators', value: 'list' },
          { name: 'Add new administrator', value: 'add' },
          { name: 'Update administrator', value: 'update' },
          { name: 'Remove administrator', value: 'remove' },
          { name: 'Check admin status', value: 'check' },
          new inquirer.Separator(),
          { name: 'Exit', value: 'exit' }
        ]
      });

      switch (action) {
        case 'list':
          await program.commands.find(c => c.name() === 'list')!.parseAsync(['', ''], { from: 'user' });
          break;
        
        case 'add':
          await program.commands.find(c => c.name() === 'add')!.parseAsync(['', ''], { from: 'user' });
          break;
        
        case 'update':
          const { updateWallet } = await inquirer.prompt({
            type: 'input',
            name: 'updateWallet',
            message: 'Enter wallet address to update:',
            validate: (input) => validateEthereumAddress(input) || 'Please enter a valid Ethereum address'
          });
          await program.commands.find(c => c.name() === 'update')!.parseAsync(['', '', updateWallet], { from: 'user' });
          break;
        
        case 'remove':
          const { removeWallet } = await inquirer.prompt({
            type: 'input',
            name: 'removeWallet',
            message: 'Enter wallet address to remove:',
            validate: (input) => validateEthereumAddress(input) || 'Please enter a valid Ethereum address'
          });
          await program.commands.find(c => c.name() === 'remove')!.parseAsync(['', '', removeWallet], { from: 'user' });
          break;
        
        case 'check':
          const { checkWallet } = await inquirer.prompt({
            type: 'input',
            name: 'checkWallet',
            message: 'Enter wallet address to check:',
            validate: (input) => validateEthereumAddress(input) || 'Please enter a valid Ethereum address'
          });
          await program.commands.find(c => c.name() === 'check')!.parseAsync(['', '', checkWallet], { from: 'user' });
          break;
        
        case 'exit':
          running = false;
          console.log(chalk.green('\n👋 Goodbye!\n'));
          break;
      }

      if (running && action !== 'exit') {
        console.log('\n' + chalk.gray('─'.repeat(50)) + '\n');
      }
    }
  });

// Parse arguments and handle errors
program.parseAsync(process.argv).catch((error) => {
  console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
  process.exit(1);
});

// Show help if no command provided
if (process.argv.length === 2) {
  program.help();
}