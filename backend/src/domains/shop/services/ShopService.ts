import { databaseService } from '../../../services/DatabaseService';
import { logger } from '../../../utils/logger';

export class ShopService {
  async updateTokenStats(shopId: string, amount: number, type: 'minted' | 'redeemed'): Promise<void> {
    try {
      const shop = await databaseService.getShop(shopId);
      if (!shop) {
        logger.warn(`Shop not found for stats update: ${shopId}`);
        return;
      }

      const updates: any = {
        lastActivity: new Date().toISOString()
      };

      if (type === 'minted') {
        updates.totalTokensIssued = shop.totalTokensIssued + amount;
      } else if (type === 'redeemed') {
        updates.totalRedemptions = shop.totalRedemptions + amount;
      }

      await databaseService.updateShop(shopId, updates);
      
      logger.info(`Shop stats updated`, {
        shopId,
        type,
        amount,
        newTotal: type === 'minted' ? updates.totalTokensIssued : updates.totalRedemptions
      });

    } catch (error) {
      logger.error('Failed to update shop stats:', error);
    }
  }
}