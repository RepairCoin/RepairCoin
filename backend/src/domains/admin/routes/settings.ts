import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../../middleware/errorHandler';
import { logger } from '../../../utils/logger';

const router = Router();

// In-memory settings store (in production, this should be in database)
interface SystemSettings {
  blockchainMintingEnabled: boolean;
  lastModified: Date;
  modifiedBy?: string;
}

// Initialize with environment variable
let systemSettings: SystemSettings = {
  blockchainMintingEnabled: process.env.ENABLE_BLOCKCHAIN_MINTING === 'true',
  lastModified: new Date(),
  modifiedBy: 'system'
};

/**
 * Get current system settings
 */
router.get('/system', asyncHandler(async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      blockchainMintingEnabled: systemSettings.blockchainMintingEnabled,
      lastModified: systemSettings.lastModified,
      modifiedBy: systemSettings.modifiedBy
    }
  });
}));

/**
 * Toggle blockchain minting on/off
 */
router.post('/system/blockchain-minting', asyncHandler(async (req: Request, res: Response) => {
  const { enabled } = req.body;
  const adminAddress = req.user?.address;
  
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({
      success: false,
      error: 'enabled must be a boolean value'
    });
  }
  
  const previousState = systemSettings.blockchainMintingEnabled;
  systemSettings.blockchainMintingEnabled = enabled;
  systemSettings.lastModified = new Date();
  systemSettings.modifiedBy = adminAddress || 'unknown';
  
  // Update the runtime environment variable
  process.env.ENABLE_BLOCKCHAIN_MINTING = enabled ? 'true' : 'false';
  
  logger.info('Blockchain minting setting updated', {
    previousState,
    newState: enabled,
    modifiedBy: adminAddress
  });
  
  res.json({
    success: true,
    message: `Blockchain minting ${enabled ? 'enabled' : 'disabled'}`,
    data: {
      blockchainMintingEnabled: enabled,
      previousState,
      modifiedBy: adminAddress
    }
  });
}));

/**
 * Get blockchain minting status only
 */
router.get('/system/blockchain-minting', asyncHandler(async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      enabled: systemSettings.blockchainMintingEnabled,
      environmentVariable: process.env.ENABLE_BLOCKCHAIN_MINTING
    }
  });
}));

export default router;