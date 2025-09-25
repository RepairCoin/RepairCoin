// Temporary helper to check pending mints without relying on minted_at column
// This can be used until the migration is run

import { treasuryRepository, shopRepository } from '../../../repositories';
import { TokenService } from '../../token/services/TokenService';
import { logger } from '../../../utils/logger';

export async function getShopsWithPendingMintsTemp() {
  try {
    // Get all shops
    const shopsResult = await shopRepository.getShopsPaginated({ 
      page: 1, 
      limit: 10000 
    });
    const shops = shopsResult.items;
    
    const shopsWithPendingMints = [];
    
    for (const shop of shops) {
      try {
        // Get total purchased RCN from completed purchases
        // Since we don't have minted_at column yet, we'll compare with blockchain balance
        const purchaseQuery = await treasuryRepository.query(`
          SELECT 
            COALESCE(SUM(amount), 0) as total_purchased
          FROM shop_rcn_purchases 
          WHERE shop_id = $1 AND status = 'completed'
        `, [shop.shopId]);
        
        const totalPurchased = parseFloat(purchaseQuery.rows[0]?.total_purchased || '0');
        
        if (totalPurchased > 0 && shop.walletAddress) {
          // Get blockchain balance
          const tokenService = new TokenService();
          const blockchainBalance = await tokenService.getBalance(shop.walletAddress);
          
          // If database balance > blockchain balance, there are pending mints
          const pendingAmount = totalPurchased - blockchainBalance;
          
          if (pendingAmount > 0) {
            shopsWithPendingMints.push({
              shop_id: shop.shopId,
              name: shop.name,
              wallet_address: shop.walletAddress,
              purchased_rcn_balance: totalPurchased,
              blockchain_balance: blockchainBalance,
              pending_mint_amount: pendingAmount
            });
            
            logger.info(`Shop ${shop.shopId} has pending mints:`, {
              totalPurchased,
              blockchainBalance,
              pendingAmount
            });
          }
        }
      } catch (error) {
        logger.warn(`Could not check pending mints for shop ${shop.shopId}:`, error);
      }
    }
    
    return shopsWithPendingMints;
  } catch (error) {
    logger.error('Error getting shops with pending mints:', error);
    throw error;
  }
}