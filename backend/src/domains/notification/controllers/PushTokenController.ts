import { Request, Response } from 'express';
import Expo from 'expo-server-sdk';
import { PushTokenRepository, RegisterTokenParams } from '../../../repositories/PushTokenRepository';
import { logger } from '../../../utils/logger';

export class PushTokenController {
  private repository: PushTokenRepository;

  constructor() {
    this.repository = new PushTokenRepository();
  }

  /**
   * POST /api/notifications/push-tokens
   * Register or update a push token for the authenticated user
   */
  async registerToken(req: Request, res: Response): Promise<void> {
    try {
      const walletAddress = req.user?.address;

      if (!walletAddress) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { expoPushToken, deviceId, deviceType, deviceName, appVersion } = req.body;

      // Validate required fields
      if (!expoPushToken) {
        res.status(400).json({ error: 'expoPushToken is required' });
        return;
      }

      if (!deviceType || !['ios', 'android'].includes(deviceType)) {
        res.status(400).json({ error: 'deviceType must be "ios" or "android"' });
        return;
      }

      // Validate Expo push token format
      if (!Expo.isExpoPushToken(expoPushToken)) {
        res.status(400).json({
          error: 'Invalid Expo push token format. Expected format: ExponentPushToken[xxx] or ExpoPushToken[xxx]',
        });
        return;
      }

      const params: RegisterTokenParams = {
        walletAddress,
        expoPushToken,
        deviceId,
        deviceType,
        deviceName,
        appVersion,
      };

      const token = await this.repository.registerToken(params);

      logger.info('Push token registered', {
        walletAddress,
        deviceType,
        deviceId: deviceId?.substring(0, 10),
      });

      res.status(201).json({
        message: 'Push token registered successfully',
        token: {
          id: token.id,
          deviceType: token.deviceType,
          deviceName: token.deviceName,
          createdAt: token.createdAt,
        },
      });
    } catch (error: any) {
      logger.error('Error registering push token:', error);
      res.status(500).json({ error: error.message || 'Failed to register push token' });
    }
  }

  /**
   * DELETE /api/notifications/push-tokens/:token
   * Deactivate a specific push token (logout from device)
   */
  async deactivateToken(req: Request, res: Response): Promise<void> {
    try {
      const walletAddress = req.user?.address;

      if (!walletAddress) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { token } = req.params;

      if (!token) {
        res.status(400).json({ error: 'Token is required' });
        return;
      }

      // Decode the token (it's URL encoded)
      const decodedToken = decodeURIComponent(token);

      // Deactivate only if it belongs to the authenticated user
      const success = await this.repository.deactivateTokenForWallet(walletAddress, decodedToken);

      if (!success) {
        res.status(404).json({ error: 'Token not found or already deactivated' });
        return;
      }

      logger.info('Push token deactivated', {
        walletAddress,
        token: decodedToken.substring(0, 30),
      });

      res.json({ message: 'Push token deactivated successfully' });
    } catch (error: any) {
      logger.error('Error deactivating push token:', error);
      res.status(500).json({ error: error.message || 'Failed to deactivate push token' });
    }
  }

  /**
   * DELETE /api/notifications/push-tokens
   * Deactivate all push tokens for the authenticated user (logout from all devices)
   */
  async deactivateAllTokens(req: Request, res: Response): Promise<void> {
    try {
      const walletAddress = req.user?.address;

      if (!walletAddress) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const count = await this.repository.deactivateAllForWallet(walletAddress);

      logger.info('All push tokens deactivated', { walletAddress, count });

      res.json({
        message: `Deactivated ${count} push token(s)`,
        count,
      });
    } catch (error: any) {
      logger.error('Error deactivating all push tokens:', error);
      res.status(500).json({ error: error.message || 'Failed to deactivate push tokens' });
    }
  }

  /**
   * GET /api/notifications/push-tokens
   * Get all active devices for the authenticated user
   */
  async getActiveDevices(req: Request, res: Response): Promise<void> {
    try {
      const walletAddress = req.user?.address;

      if (!walletAddress) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const devices = await this.repository.getActiveDevices(walletAddress);

      // Don't expose the full push token for security
      const sanitizedDevices = devices.map((device) => ({
        id: device.id,
        deviceType: device.deviceType,
        deviceName: device.deviceName,
        appVersion: device.appVersion,
        lastUsedAt: device.lastUsedAt,
        createdAt: device.createdAt,
      }));

      res.json({ devices: sanitizedDevices });
    } catch (error: any) {
      logger.error('Error getting active devices:', error);
      res.status(500).json({ error: error.message || 'Failed to get active devices' });
    }
  }

  /**
   * GET /api/notifications/push-tokens/stats (Admin only)
   * Get push token statistics
   */
  async getTokenStats(req: Request, res: Response): Promise<void> {
    try {
      const userRole = req.user?.role;

      if (userRole !== 'admin') {
        res.status(403).json({ error: 'Admin access required' });
        return;
      }

      const stats = await this.repository.getTokenStats();

      res.json(stats);
    } catch (error: any) {
      logger.error('Error getting push token stats:', error);
      res.status(500).json({ error: error.message || 'Failed to get push token stats' });
    }
  }
}
