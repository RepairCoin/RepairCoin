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

/**
 * Initialize system settings table if it doesn't exist
 */
const initializeSettingsTable = async () => {
  const db = DatabaseService.getInstance();
  
  try {
    // Create system_settings table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id SERIAL PRIMARY KEY,
        setting_key VARCHAR(255) UNIQUE NOT NULL,
        setting_value TEXT NOT NULL,
        last_modified TIMESTAMP DEFAULT NOW(),
        modified_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Insert default blockchain minting setting if it doesn't exist
    await db.query(`
      INSERT INTO system_settings (setting_key, setting_value, modified_by)
      VALUES ('blockchain_minting_enabled', $1, 'system')
      ON CONFLICT (setting_key) DO NOTHING
    `, [process.env.ENABLE_BLOCKCHAIN_MINTING === 'true' ? 'true' : 'false']);
    
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

export default router;