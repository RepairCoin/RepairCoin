import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../../middleware/errorHandler';
import { logger } from '../../../utils/logger';
import { DatabaseService } from '../../../services/DatabaseService';

const router = Router();

interface SystemSettings {
  blockchainMintingEnabled: boolean;
  lastModified: Date;
  modifiedBy?: string;
}

interface PlatformSettings {
  // General
  platformName: string;
  platformDescription: string;
  supportEmail: string;
  supportPhone: string;

  // Rewards & Tiers
  defaultRcnRewardRate: number;
  bronzeTierThreshold: number;
  silverTierThreshold: number;
  goldTierThreshold: number;
  bronzeBonus: number;
  silverBonus: number;
  goldBonus: number;

  // Referrals
  referrerReward: number;
  refereeReward: number;

  // Bookings
  defaultCancellationWindow: number; // hours
  defaultDepositPercentage: number;
  maxAdvanceBookingDays: number;

  // System
  maintenanceMode: boolean;
  maintenanceMessage: string;
  timezone: string;
  currency: string;

  // Metadata
  lastModified: Date;
  modifiedBy?: string;
}

/**
 * Default platform settings
 */
const DEFAULT_PLATFORM_SETTINGS: Partial<PlatformSettings> = {
  platformName: 'RepairCoin',
  platformDescription: 'Blockchain-based customer loyalty and rewards platform',
  supportEmail: 'support@repaircoin.ai',
  supportPhone: '+1 (555) 000-0000',

  defaultRcnRewardRate: 10,
  bronzeTierThreshold: 0,
  silverTierThreshold: 100,
  goldTierThreshold: 500,
  bronzeBonus: 0,
  silverBonus: 2,
  goldBonus: 5,

  referrerReward: 25,
  refereeReward: 10,

  defaultCancellationWindow: 24,
  defaultDepositPercentage: 0,
  maxAdvanceBookingDays: 90,

  maintenanceMode: false,
  maintenanceMessage: 'System maintenance in progress. Please check back soon.',
  timezone: 'America/Toronto',
  currency: 'USD',
};

/**
 * Initialize system settings table if it doesn't exist
 */
const initializeSettingsTable = async () => {
  const db = DatabaseService.getInstance();

  try {
    // Create system_settings table if it doesn't exist with timeout
    await Promise.race([
      (async () => {
        // Create table if it doesn't exist
        await db.query(`
          CREATE TABLE IF NOT EXISTS system_settings (
            id SERIAL PRIMARY KEY,
            setting_key VARCHAR(255) NOT NULL,
            setting_value TEXT NOT NULL,
            last_modified TIMESTAMP DEFAULT NOW(),
            modified_by VARCHAR(255),
            created_at TIMESTAMP DEFAULT NOW()
          )
        `);

        // Add unique constraint if it doesn't exist
        await db.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_constraint
              WHERE conname = 'system_settings_setting_key_key'
            ) THEN
              ALTER TABLE system_settings
              ADD CONSTRAINT system_settings_setting_key_key UNIQUE (setting_key);
            END IF;
          END $$;
        `);

        // Insert default blockchain minting setting if it doesn't exist
        await db.query(`
          INSERT INTO system_settings (setting_key, setting_value, modified_by)
          VALUES ('blockchain_minting_enabled', $1, 'system')
          ON CONFLICT (setting_key) DO NOTHING
        `, [process.env.ENABLE_BLOCKCHAIN_MINTING === 'true' ? 'true' : 'false']);

        // Insert default platform settings
        const defaultSettings = [
          ['platform_name', DEFAULT_PLATFORM_SETTINGS.platformName],
          ['platform_description', DEFAULT_PLATFORM_SETTINGS.platformDescription],
          ['support_email', DEFAULT_PLATFORM_SETTINGS.supportEmail],
          ['support_phone', DEFAULT_PLATFORM_SETTINGS.supportPhone],
          ['default_rcn_reward_rate', String(DEFAULT_PLATFORM_SETTINGS.defaultRcnRewardRate)],
          ['bronze_tier_threshold', String(DEFAULT_PLATFORM_SETTINGS.bronzeTierThreshold)],
          ['silver_tier_threshold', String(DEFAULT_PLATFORM_SETTINGS.silverTierThreshold)],
          ['gold_tier_threshold', String(DEFAULT_PLATFORM_SETTINGS.goldTierThreshold)],
          ['bronze_bonus', String(DEFAULT_PLATFORM_SETTINGS.bronzeBonus)],
          ['silver_bonus', String(DEFAULT_PLATFORM_SETTINGS.silverBonus)],
          ['gold_bonus', String(DEFAULT_PLATFORM_SETTINGS.goldBonus)],
          ['referrer_reward', String(DEFAULT_PLATFORM_SETTINGS.referrerReward)],
          ['referee_reward', String(DEFAULT_PLATFORM_SETTINGS.refereeReward)],
          ['default_cancellation_window', String(DEFAULT_PLATFORM_SETTINGS.defaultCancellationWindow)],
          ['default_deposit_percentage', String(DEFAULT_PLATFORM_SETTINGS.defaultDepositPercentage)],
          ['max_advance_booking_days', String(DEFAULT_PLATFORM_SETTINGS.maxAdvanceBookingDays)],
          ['maintenance_mode', String(DEFAULT_PLATFORM_SETTINGS.maintenanceMode)],
          ['maintenance_message', DEFAULT_PLATFORM_SETTINGS.maintenanceMessage],
          ['timezone', DEFAULT_PLATFORM_SETTINGS.timezone],
          ['currency', DEFAULT_PLATFORM_SETTINGS.currency],
        ];

        for (const [key, value] of defaultSettings) {
          await db.query(`
            INSERT INTO system_settings (setting_key, setting_value, modified_by)
            VALUES ($1, $2, 'system')
            ON CONFLICT (setting_key) DO NOTHING
          `, [key, value]);
        }
      })(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Settings table initialization timeout after 3s')), 3000)
      )
    ]);

    logger.info('System settings table initialized');
  } catch (error) {
    logger.error('Failed to initialize system settings table:', error);
  }
};

/**
 * Get setting from database
 */
const getSetting = async (key: string): Promise<string | null> => {
  const db = DatabaseService.getInstance();
  
  try {
    const result = await db.query(`
      SELECT setting_value FROM system_settings 
      WHERE setting_key = $1
    `, [key]);
    
    return result.rows[0]?.setting_value || null;
  } catch (error) {
    logger.error(`Failed to get setting ${key}:`, error);
    return null;
  }
};

/**
 * Update setting in database
 */
const updateSetting = async (key: string, value: string, modifiedBy: string) => {
  const db = DatabaseService.getInstance();
  
  try {
    await db.query(`
      INSERT INTO system_settings (setting_key, setting_value, modified_by, last_modified)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (setting_key) 
      DO UPDATE SET 
        setting_value = EXCLUDED.setting_value,
        modified_by = EXCLUDED.modified_by,
        last_modified = NOW()
    `, [key, value, modifiedBy]);
    
    logger.info(`Setting ${key} updated to ${value} by ${modifiedBy}`);
  } catch (error) {
    logger.error(`Failed to update setting ${key}:`, error);
    throw error;
  }
};

// Initialize on module load
initializeSettingsTable();

/**
 * Get current system settings
 */
router.get('/system', asyncHandler(async (req: Request, res: Response) => {
  const db = DatabaseService.getInstance();
  
  try {
    const result = await db.query(`
      SELECT setting_key, setting_value, last_modified, modified_by 
      FROM system_settings
    `);
    
    const settings: any = {};
    result.rows.forEach(row => {
      if (row.setting_key === 'blockchain_minting_enabled') {
        settings.blockchainMintingEnabled = row.setting_value === 'true';
        settings.lastModified = row.last_modified;
        settings.modifiedBy = row.modified_by;
      }
    });
    
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    logger.error('Failed to get system settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve system settings'
    });
  }
}));

/**
 * Toggle blockchain minting on/off
 */
router.post('/system/blockchain-minting', asyncHandler(async (req: Request, res: Response) => {
  const { enabled } = req.body;
  const adminAddress = req.user?.address || 'unknown';
  
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({
      success: false,
      error: 'enabled must be a boolean value'
    });
  }
  
  try {
    // Get current state from database
    const currentValue = await getSetting('blockchain_minting_enabled');
    const previousState = currentValue === 'true';
    
    // Update in database with audit trail
    await updateSetting('blockchain_minting_enabled', enabled ? 'true' : 'false', adminAddress);
    
    // Update the runtime environment variable
    process.env.ENABLE_BLOCKCHAIN_MINTING = enabled ? 'true' : 'false';
    
    logger.info('Blockchain minting setting updated', {
      previousState,
      newState: enabled,
      modifiedBy: adminAddress,
      persistedToDatabase: true
    });
    
    res.json({
      success: true,
      message: `Blockchain minting ${enabled ? 'enabled' : 'disabled'} and persisted to database`,
      data: {
        blockchainMintingEnabled: enabled,
        previousState,
        modifiedBy: adminAddress,
        persistedToDatabase: true
      }
    });
  } catch (error) {
    logger.error('Failed to update blockchain minting setting:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update blockchain minting setting'
    });
  }
}));

/**
 * Get blockchain minting status only
 */
router.get('/system/blockchain-minting', asyncHandler(async (req: Request, res: Response) => {
  try {
    const currentValue = await getSetting('blockchain_minting_enabled');
    const enabled = currentValue === 'true';

    res.json({
      success: true,
      data: {
        enabled,
        environmentVariable: process.env.ENABLE_BLOCKCHAIN_MINTING,
        databaseValue: currentValue,
        synchronized: (process.env.ENABLE_BLOCKCHAIN_MINTING === 'true') === enabled
      }
    });
  } catch (error) {
    logger.error('Failed to get blockchain minting status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve blockchain minting status'
    });
  }
}));

/**
 * Get all platform settings
 */
router.get('/platform', asyncHandler(async (_req: Request, res: Response) => {
  const db = DatabaseService.getInstance();

  try {
    const result = await db.query(`
      SELECT setting_key, setting_value, last_modified, modified_by
      FROM system_settings
      WHERE setting_key NOT LIKE 'blockchain_%'
    `);

    const settings: Record<string, string | number | boolean> = {};
    let lastModified = new Date();
    let modifiedBy = 'system';

    result.rows.forEach(row => {
      const key = row.setting_key;
      let value: string | number | boolean = row.setting_value;

      // Parse numeric values
      if (['default_rcn_reward_rate', 'bronze_tier_threshold', 'silver_tier_threshold',
           'gold_tier_threshold', 'bronze_bonus', 'silver_bonus', 'gold_bonus',
           'referrer_reward', 'referee_reward', 'default_cancellation_window',
           'default_deposit_percentage', 'max_advance_booking_days'].includes(key)) {
        value = parseFloat(row.setting_value);
      }

      // Parse boolean values
      if (key === 'maintenance_mode') {
        value = row.setting_value === 'true';
      }

      // Convert snake_case to camelCase
      const camelKey = key.replace(/_([a-z])/g, (g: string) => g[1].toUpperCase());
      settings[camelKey] = value;

      if (row.last_modified > lastModified) {
        lastModified = row.last_modified;
        modifiedBy = row.modified_by || 'system';
      }
    });

    res.json({
      success: true,
      data: {
        ...settings,
        lastModified,
        modifiedBy
      }
    });
  } catch (error) {
    logger.error('Failed to get platform settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve platform settings'
    });
  }
}));

/**
 * Update platform settings
 */
router.put('/platform', asyncHandler(async (req: Request, res: Response) => {
  const adminAddress = req.user?.address || 'unknown';
  const updates = req.body;

  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({
      success: false,
      error: 'Invalid request body'
    });
  }

  try {
    // Convert camelCase keys to snake_case and validate
    const validSettings: Record<string, string> = {};

    Object.entries(updates).forEach(([key, value]) => {
      // Skip metadata fields
      if (key === 'lastModified' || key === 'modifiedBy') {
        return;
      }

      // Convert camelCase to snake_case
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();

      // Validate and convert value
      if (typeof value === 'boolean') {
        validSettings[snakeKey] = String(value);
      } else if (typeof value === 'number') {
        validSettings[snakeKey] = String(value);
      } else if (typeof value === 'string') {
        validSettings[snakeKey] = value;
      } else {
        logger.warn(`Skipping invalid setting ${key}: ${value}`);
      }
    });

    // Update each setting
    for (const [key, value] of Object.entries(validSettings)) {
      await updateSetting(key, value, adminAddress);
    }

    logger.info(`Platform settings updated by ${adminAddress}`, { updates: Object.keys(validSettings) });

    res.json({
      success: true,
      message: 'Platform settings updated successfully',
      data: {
        updatedFields: Object.keys(validSettings),
        modifiedBy: adminAddress
      }
    });
  } catch (error) {
    logger.error('Failed to update platform settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update platform settings'
    });
  }
}));

/**
 * Toggle maintenance mode
 */
router.post('/platform/maintenance-mode', asyncHandler(async (req: Request, res: Response) => {
  const { enabled, message } = req.body;
  const adminAddress = req.user?.address || 'unknown';

  if (typeof enabled !== 'boolean') {
    return res.status(400).json({
      success: false,
      error: 'enabled must be a boolean value'
    });
  }

  try {
    await updateSetting('maintenance_mode', enabled ? 'true' : 'false', adminAddress);

    if (message && typeof message === 'string') {
      await updateSetting('maintenance_message', message, adminAddress);
    }

    logger.info(`Maintenance mode ${enabled ? 'enabled' : 'disabled'} by ${adminAddress}`);

    res.json({
      success: true,
      message: `Maintenance mode ${enabled ? 'enabled' : 'disabled'}`,
      data: {
        maintenanceMode: enabled,
        maintenanceMessage: message || null,
        modifiedBy: adminAddress
      }
    });
  } catch (error) {
    logger.error('Failed to toggle maintenance mode:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle maintenance mode'
    });
  }
}));

/**
 * Notification Settings Types
 */
interface NotificationSettings {
  // Email Notifications
  emailNewShops: boolean;
  emailDisputes: boolean;
  emailReports: boolean;
  emailLowTreasury: boolean;
  emailFailedTransactions: boolean;
  emailSystemErrors: boolean;

  // In-App Notifications
  inAppNewShops: boolean;
  inAppDisputes: boolean;
  inAppReports: boolean;
  inAppLowTreasury: boolean;
  inAppFailedTransactions: boolean;
  inAppSystemErrors: boolean;

  // Notification Frequency
  notificationFrequency: 'instant' | 'daily' | 'weekly';
  digestTime: string; // HH:mm format for daily/weekly digests

  // Alert Thresholds
  treasuryBalanceThreshold: number; // USD
  failedTransactionThreshold: number; // count per hour
  systemErrorThreshold: number; // count per hour

  // Metadata
  lastModified: Date;
  modifiedBy?: string;
}

/**
 * Default notification settings
 */
const DEFAULT_NOTIFICATION_SETTINGS: Partial<NotificationSettings> = {
  // Email - all enabled by default
  emailNewShops: true,
  emailDisputes: true,
  emailReports: true,
  emailLowTreasury: true,
  emailFailedTransactions: true,
  emailSystemErrors: true,

  // In-App - all enabled by default
  inAppNewShops: true,
  inAppDisputes: true,
  inAppReports: true,
  inAppLowTreasury: true,
  inAppFailedTransactions: true,
  inAppSystemErrors: true,

  // Frequency
  notificationFrequency: 'instant',
  digestTime: '09:00', // 9 AM

  // Thresholds
  treasuryBalanceThreshold: 1000, // Alert when treasury < $1000
  failedTransactionThreshold: 5, // Alert when > 5 failed transactions per hour
  systemErrorThreshold: 10, // Alert when > 10 system errors per hour
};

/**
 * Initialize notification settings
 */
const initializeNotificationSettings = async () => {
  const db = DatabaseService.getInstance();

  try {
    const defaultSettings = [
      ['email_new_shops', String(DEFAULT_NOTIFICATION_SETTINGS.emailNewShops)],
      ['email_disputes', String(DEFAULT_NOTIFICATION_SETTINGS.emailDisputes)],
      ['email_reports', String(DEFAULT_NOTIFICATION_SETTINGS.emailReports)],
      ['email_low_treasury', String(DEFAULT_NOTIFICATION_SETTINGS.emailLowTreasury)],
      ['email_failed_transactions', String(DEFAULT_NOTIFICATION_SETTINGS.emailFailedTransactions)],
      ['email_system_errors', String(DEFAULT_NOTIFICATION_SETTINGS.emailSystemErrors)],

      ['in_app_new_shops', String(DEFAULT_NOTIFICATION_SETTINGS.inAppNewShops)],
      ['in_app_disputes', String(DEFAULT_NOTIFICATION_SETTINGS.inAppDisputes)],
      ['in_app_reports', String(DEFAULT_NOTIFICATION_SETTINGS.inAppReports)],
      ['in_app_low_treasury', String(DEFAULT_NOTIFICATION_SETTINGS.inAppLowTreasury)],
      ['in_app_failed_transactions', String(DEFAULT_NOTIFICATION_SETTINGS.inAppFailedTransactions)],
      ['in_app_system_errors', String(DEFAULT_NOTIFICATION_SETTINGS.inAppSystemErrors)],

      ['notification_frequency', DEFAULT_NOTIFICATION_SETTINGS.notificationFrequency],
      ['digest_time', DEFAULT_NOTIFICATION_SETTINGS.digestTime],

      ['treasury_balance_threshold', String(DEFAULT_NOTIFICATION_SETTINGS.treasuryBalanceThreshold)],
      ['failed_transaction_threshold', String(DEFAULT_NOTIFICATION_SETTINGS.failedTransactionThreshold)],
      ['system_error_threshold', String(DEFAULT_NOTIFICATION_SETTINGS.systemErrorThreshold)],
    ];

    for (const [key, value] of defaultSettings) {
      await db.query(`
        INSERT INTO system_settings (setting_key, setting_value, modified_by)
        VALUES ($1, $2, 'system')
        ON CONFLICT (setting_key) DO NOTHING
      `, [key, value]);
    }

    logger.info('Notification settings initialized');
  } catch (error) {
    logger.error('Failed to initialize notification settings:', error);
  }
};

// Initialize notification settings on module load
initializeNotificationSettings();

/**
 * Get notification settings
 */
router.get('/notifications', asyncHandler(async (_req: Request, res: Response) => {
  const db = DatabaseService.getInstance();

  try {
    const result = await db.query(`
      SELECT setting_key, setting_value, last_modified, modified_by
      FROM system_settings
      WHERE setting_key LIKE 'email_%'
         OR setting_key LIKE 'in_app_%'
         OR setting_key IN ('notification_frequency', 'digest_time', 'treasury_balance_threshold', 'failed_transaction_threshold', 'system_error_threshold')
    `);

    const settings: Record<string, string | number | boolean> = {};
    let lastModified = new Date();
    let modifiedBy = 'system';

    result.rows.forEach(row => {
      const key = row.setting_key;
      let value: string | number | boolean = row.setting_value;

      // Parse boolean values
      if (key.startsWith('email_') || key.startsWith('in_app_')) {
        value = row.setting_value === 'true';
      }

      // Parse numeric values
      if (key.endsWith('_threshold')) {
        value = parseFloat(row.setting_value);
      }

      // Convert snake_case to camelCase
      const camelKey = key.replace(/_([a-z])/g, (g: string) => g[1].toUpperCase());
      settings[camelKey] = value;

      if (row.last_modified > lastModified) {
        lastModified = row.last_modified;
        modifiedBy = row.modified_by || 'system';
      }
    });

    res.json({
      success: true,
      data: {
        ...settings,
        lastModified,
        modifiedBy
      }
    });
  } catch (error) {
    logger.error('Failed to get notification settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve notification settings'
    });
  }
}));

/**
 * Update notification settings
 */
router.put('/notifications', asyncHandler(async (req: Request, res: Response) => {
  const adminAddress = req.user?.address || 'unknown';
  const updates = req.body;

  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({
      success: false,
      error: 'Invalid request body'
    });
  }

  try {
    // Convert camelCase keys to snake_case and validate
    const validSettings: Record<string, string> = {};

    Object.entries(updates).forEach(([key, value]) => {
      // Skip metadata fields
      if (key === 'lastModified' || key === 'modifiedBy') {
        return;
      }

      // Convert camelCase to snake_case
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();

      // Validate notification frequency
      if (key === 'notificationFrequency' && !['instant', 'daily', 'weekly'].includes(value as string)) {
        logger.warn(`Invalid notification frequency: ${value}`);
        return;
      }

      // Validate digest time format (HH:mm)
      if (key === 'digestTime' && typeof value === 'string') {
        const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(value)) {
          logger.warn(`Invalid digest time format: ${value}`);
          return;
        }
      }

      // Validate and convert value
      if (typeof value === 'boolean') {
        validSettings[snakeKey] = String(value);
      } else if (typeof value === 'number') {
        validSettings[snakeKey] = String(value);
      } else if (typeof value === 'string') {
        validSettings[snakeKey] = value;
      } else {
        logger.warn(`Skipping invalid setting ${key}: ${value}`);
      }
    });

    // Update each setting
    for (const [key, value] of Object.entries(validSettings)) {
      await updateSetting(key, value, adminAddress);
    }

    logger.info(`Notification settings updated by ${adminAddress}`, { updates: Object.keys(validSettings) });

    res.json({
      success: true,
      message: 'Notification settings updated successfully',
      data: {
        updatedFields: Object.keys(validSettings),
        modifiedBy: adminAddress
      }
    });
  } catch (error) {
    logger.error('Failed to update notification settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update notification settings'
    });
  }
}));

/**
 * Security Settings Types
 */
interface SecuritySettings {
  // Admin Role Permissions
  enableRolePermissions: boolean;
  defaultRole: 'view-only' | 'standard' | 'super-admin';
  viewOnlyPermissions: string[];
  standardPermissions: string[];
  superAdminPermissions: string[];

  // Session Management
  sessionTimeout: number; // in minutes
  autoLogoutEnabled: boolean;
  maxConcurrentSessions: number;
  rememberMeDuration: number; // in days

  // IP Access Control
  enableIpWhitelist: boolean;
  enableIpBlacklist: boolean;
  ipWhitelist: string[];
  ipBlacklist: string[];

  // Two-Factor Authentication
  require2FA: boolean;
  allow2FAOptOut: boolean;
  twoFactorMethod: 'authenticator' | 'sms' | 'email';

  // Audit Logs
  auditLogRetention: number; // in days
  logLoginAttempts: boolean;
  logSettingsChanges: boolean;
  logFinancialTransactions: boolean;
  logAdminActions: boolean;

  // Metadata
  lastModified: Date;
  modifiedBy?: string;
}

/**
 * Default permissions
 */
const DEFAULT_PERMISSIONS = {
  viewOnly: [
    'view_dashboard',
    'view_shops',
    'view_customers',
    'view_transactions',
    'view_reports',
  ],
  standard: [
    'view_dashboard',
    'view_shops',
    'view_customers',
    'view_transactions',
    'view_reports',
    'manage_shops',
    'manage_customers',
    'issue_tokens',
    'view_settings',
  ],
  superAdmin: [
    'view_dashboard',
    'view_shops',
    'view_customers',
    'view_transactions',
    'view_reports',
    'manage_shops',
    'manage_customers',
    'issue_tokens',
    'view_settings',
    'manage_settings',
    'manage_admins',
    'manage_treasury',
    'system_maintenance',
  ],
};

/**
 * Default security settings
 */
const DEFAULT_SECURITY_SETTINGS: Partial<SecuritySettings> = {
  // Admin Role Permissions
  enableRolePermissions: true,
  defaultRole: 'standard',
  viewOnlyPermissions: DEFAULT_PERMISSIONS.viewOnly,
  standardPermissions: DEFAULT_PERMISSIONS.standard,
  superAdminPermissions: DEFAULT_PERMISSIONS.superAdmin,

  // Session Management
  sessionTimeout: 60, // 60 minutes
  autoLogoutEnabled: true,
  maxConcurrentSessions: 3,
  rememberMeDuration: 30, // 30 days

  // IP Access Control
  enableIpWhitelist: false,
  enableIpBlacklist: false,
  ipWhitelist: [],
  ipBlacklist: [],

  // Two-Factor Authentication
  require2FA: false,
  allow2FAOptOut: true,
  twoFactorMethod: 'authenticator',

  // Audit Logs
  auditLogRetention: 90, // 90 days
  logLoginAttempts: true,
  logSettingsChanges: true,
  logFinancialTransactions: true,
  logAdminActions: true,
};

/**
 * Initialize security settings
 */
const initializeSecuritySettings = async () => {
  const db = DatabaseService.getInstance();

  try {
    const defaultSettings = [
      // Admin Role Permissions
      ['enable_role_permissions', String(DEFAULT_SECURITY_SETTINGS.enableRolePermissions)],
      ['default_role', DEFAULT_SECURITY_SETTINGS.defaultRole],
      ['view_only_permissions', JSON.stringify(DEFAULT_SECURITY_SETTINGS.viewOnlyPermissions)],
      ['standard_permissions', JSON.stringify(DEFAULT_SECURITY_SETTINGS.standardPermissions)],
      ['super_admin_permissions', JSON.stringify(DEFAULT_SECURITY_SETTINGS.superAdminPermissions)],

      // Session Management
      ['session_timeout', String(DEFAULT_SECURITY_SETTINGS.sessionTimeout)],
      ['auto_logout_enabled', String(DEFAULT_SECURITY_SETTINGS.autoLogoutEnabled)],
      ['max_concurrent_sessions', String(DEFAULT_SECURITY_SETTINGS.maxConcurrentSessions)],
      ['remember_me_duration', String(DEFAULT_SECURITY_SETTINGS.rememberMeDuration)],

      // IP Access Control
      ['enable_ip_whitelist', String(DEFAULT_SECURITY_SETTINGS.enableIpWhitelist)],
      ['enable_ip_blacklist', String(DEFAULT_SECURITY_SETTINGS.enableIpBlacklist)],
      ['ip_whitelist', JSON.stringify(DEFAULT_SECURITY_SETTINGS.ipWhitelist)],
      ['ip_blacklist', JSON.stringify(DEFAULT_SECURITY_SETTINGS.ipBlacklist)],

      // Two-Factor Authentication
      ['require_2fa', String(DEFAULT_SECURITY_SETTINGS.require2FA)],
      ['allow_2fa_opt_out', String(DEFAULT_SECURITY_SETTINGS.allow2FAOptOut)],
      ['two_factor_method', DEFAULT_SECURITY_SETTINGS.twoFactorMethod],

      // Audit Logs
      ['audit_log_retention', String(DEFAULT_SECURITY_SETTINGS.auditLogRetention)],
      ['log_login_attempts', String(DEFAULT_SECURITY_SETTINGS.logLoginAttempts)],
      ['log_settings_changes', String(DEFAULT_SECURITY_SETTINGS.logSettingsChanges)],
      ['log_financial_transactions', String(DEFAULT_SECURITY_SETTINGS.logFinancialTransactions)],
      ['log_admin_actions', String(DEFAULT_SECURITY_SETTINGS.logAdminActions)],
    ];

    for (const [key, value] of defaultSettings) {
      await db.query(`
        INSERT INTO system_settings (setting_key, setting_value, modified_by)
        VALUES ($1, $2, 'system')
        ON CONFLICT (setting_key) DO NOTHING
      `, [key, value]);
    }

    logger.info('Security settings initialized');
  } catch (error) {
    logger.error('Failed to initialize security settings:', error);
  }
};

// Initialize security settings on module load
initializeSecuritySettings();

/**
 * Get security settings
 */
router.get('/security', asyncHandler(async (_req: Request, res: Response) => {
  const db = DatabaseService.getInstance();

  try {
    const result = await db.query(`
      SELECT setting_key, setting_value, last_modified, modified_by
      FROM system_settings
      WHERE setting_key LIKE '%role%'
         OR setting_key LIKE '%session%'
         OR setting_key LIKE '%ip_%'
         OR setting_key LIKE '%2fa%'
         OR setting_key LIKE '%audit%'
         OR setting_key LIKE '%log_%'
         OR setting_key IN ('default_role', 'two_factor_method', 'enable_ip_whitelist', 'enable_ip_blacklist')
    `);

    const settings: Record<string, string | number | boolean | string[]> = {};
    let lastModified = new Date();
    let modifiedBy = 'system';

    result.rows.forEach(row => {
      const key = row.setting_key;
      let value: string | number | boolean | string[] = row.setting_value;

      // Parse boolean values
      if (['enable_role_permissions', 'auto_logout_enabled', 'enable_ip_whitelist',
           'enable_ip_blacklist', 'require_2fa', 'allow_2fa_opt_out',
           'log_login_attempts', 'log_settings_changes', 'log_financial_transactions',
           'log_admin_actions'].includes(key)) {
        value = row.setting_value === 'true';
      }

      // Parse numeric values
      if (['session_timeout', 'max_concurrent_sessions', 'remember_me_duration',
           'audit_log_retention'].includes(key)) {
        value = parseInt(row.setting_value);
      }

      // Parse JSON arrays
      if (['view_only_permissions', 'standard_permissions', 'super_admin_permissions',
           'ip_whitelist', 'ip_blacklist'].includes(key)) {
        try {
          value = JSON.parse(row.setting_value);
        } catch (e) {
          logger.warn(`Failed to parse JSON for ${key}, using empty array`);
          value = [];
        }
      }

      // Convert snake_case to camelCase
      const camelKey = key.replace(/_([a-z])/g, (g: string) => g[1].toUpperCase())
        .replace('2fa', '2FA'); // Special case for 2FA

      settings[camelKey] = value;

      if (row.last_modified > lastModified) {
        lastModified = row.last_modified;
        modifiedBy = row.modified_by || 'system';
      }
    });

    res.json({
      success: true,
      data: {
        ...settings,
        lastModified,
        modifiedBy
      }
    });
  } catch (error) {
    logger.error('Failed to get security settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve security settings'
    });
  }
}));

/**
 * Update security settings
 */
router.put('/security', asyncHandler(async (req: Request, res: Response) => {
  const adminAddress = req.user?.address || 'unknown';
  const updates = req.body;

  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({
      success: false,
      error: 'Invalid request body'
    });
  }

  try {
    // Convert camelCase keys to snake_case and validate
    const validSettings: Record<string, string> = {};

    Object.entries(updates).forEach(([key, value]) => {
      // Skip metadata fields
      if (key === 'lastModified' || key === 'modifiedBy') {
        return;
      }

      // Convert camelCase to snake_case (handle 2FA specially)
      let snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      snakeKey = snakeKey.replace('2_f_a', '2fa'); // Fix 2FA conversion

      // Validate default role
      if (key === 'defaultRole' && !['view-only', 'standard', 'super-admin'].includes(value as string)) {
        logger.warn(`Invalid default role: ${value}`);
        return;
      }

      // Validate two factor method
      if (key === 'twoFactorMethod' && !['authenticator', 'sms', 'email'].includes(value as string)) {
        logger.warn(`Invalid two factor method: ${value}`);
        return;
      }

      // Validate numeric ranges
      if (key === 'sessionTimeout' && (typeof value !== 'number' || value < 5 || value > 1440)) {
        logger.warn(`Invalid session timeout: ${value}`);
        return;
      }

      if (key === 'maxConcurrentSessions' && (typeof value !== 'number' || value < 1 || value > 10)) {
        logger.warn(`Invalid max concurrent sessions: ${value}`);
        return;
      }

      if (key === 'rememberMeDuration' && (typeof value !== 'number' || value < 1 || value > 365)) {
        logger.warn(`Invalid remember me duration: ${value}`);
        return;
      }

      if (key === 'auditLogRetention' && (typeof value !== 'number' || value < 7 || value > 3650)) {
        logger.warn(`Invalid audit log retention: ${value}`);
        return;
      }

      // Validate and convert value
      if (typeof value === 'boolean') {
        validSettings[snakeKey] = String(value);
      } else if (typeof value === 'number') {
        validSettings[snakeKey] = String(value);
      } else if (typeof value === 'string') {
        validSettings[snakeKey] = value;
      } else if (Array.isArray(value)) {
        // Validate IP addresses if it's an IP list
        if (key === 'ipWhitelist' || key === 'ipBlacklist') {
          const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
          const validIps = (value as string[]).filter(ip => ipRegex.test(ip));
          validSettings[snakeKey] = JSON.stringify(validIps);
        } else {
          validSettings[snakeKey] = JSON.stringify(value);
        }
      } else {
        logger.warn(`Skipping invalid setting ${key}: ${value}`);
      }
    });

    // Update each setting
    for (const [key, value] of Object.entries(validSettings)) {
      await updateSetting(key, value, adminAddress);
    }

    logger.info(`Security settings updated by ${adminAddress}`, { updates: Object.keys(validSettings) });

    res.json({
      success: true,
      message: 'Security settings updated successfully',
      data: {
        updatedFields: Object.keys(validSettings),
        modifiedBy: adminAddress
      }
    });
  } catch (error) {
    logger.error('Failed to update security settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update security settings'
    });
  }
}));

export default router;