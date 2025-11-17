// backend/src/domains/admin/services/operations/TokenOperationsService.ts
import {
  customerRepository,
  shopRepository,
  transactionRepository,
  adminRepository,
  treasuryRepository
} from '../../../../repositories';
import { TokenMinter } from '../../../../contracts/TokenMinter';
import { TierManager } from '../../../../contracts/TierManager';
import { TokenService } from '../../../token/services/TokenService';
import { logger } from '../../../../utils/logger';
import { eventBus, createDomainEvent } from '../../../../events/EventBus';

export interface ManualMintParams {
  customerAddress: string;
  amount: number;
  reason: string;
  adminAddress?: string;
}

export interface SellRcnParams {
  shopId: string;
  amount: number;
  pricePerToken: number;
  paymentMethod: string;
  paymentReference?: string;
  adminAddress?: string;
}

/**
 * TokenOperationsService
 * Handles all token minting, selling, and redemption operations
 * Extracted from AdminService for better maintainability and security
 */
export class TokenOperationsService {
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

  async manualMint(params: ManualMintParams) {
    try {
      // Validate customer exists
      const customer = await customerRepository.getCustomer(params.customerAddress);
      if (!customer) {
        throw new Error('Customer not found');
      }

      logger.info('Admin manual token mint', {
        adminAddress: params.adminAddress,
        customerAddress: params.customerAddress,
        amount: params.amount,
        reason: params.reason
      });

      // Mint tokens using TokenMinter
      const tokenMinter = this.getTokenMinterInstance();
      const mintResult = await tokenMinter.adminMintTokens(
        params.customerAddress,
        params.amount,
        params.reason
      );

      if (!mintResult.success || !mintResult.transactionHash) {
        throw new Error(mintResult.error || 'Failed to mint tokens');
      }

      const transactionHash = mintResult.transactionHash;

      // Update customer data
      const newTier = this.getTierManager().calculateTier(customer.lifetimeEarnings + params.amount);
      await customerRepository.updateCustomerAfterEarning(params.customerAddress, params.amount, newTier);

      // Record transaction
      await transactionRepository.recordTransaction({
        id: `admin_mint_${Date.now()}`,
        type: 'mint',
        customerAddress: params.customerAddress.toLowerCase(),
        shopId: null,
        amount: params.amount,
        reason: `Admin mint: ${params.reason}`,
        transactionHash: transactionHash,
        timestamp: new Date().toISOString(),
        status: 'confirmed',
        metadata: {
          repairAmount: params.amount,
          referralId: undefined,
          engagementType: 'admin_mint',
          redemptionLocation: undefined,
          webhookId: `admin_${Date.now()}`
        }
      });

      // Log admin activity
      await adminRepository.logAdminActivity({
        adminAddress: params.adminAddress || 'system',
        actionType: 'manual_mint',
        actionDescription: `Minted ${params.amount} RCN to customer: ${params.reason}`,
        entityType: 'customer',
        entityId: params.customerAddress,
        metadata: {
          amount: params.amount,
          reason: params.reason,
          transactionHash: transactionHash
        }
      });

      return {
        success: true,
        transactionHash: transactionHash,
        amount: params.amount,
        newTier,
        message: `Successfully minted ${params.amount} RCN to customer`
      };
    } catch (error) {
      logger.error('Manual mint error:', error);
      throw error;
    }
  }

  async processManualRedemption(params: {
    customerAddress: string;
    amount: number;
    shopId: string;
    adminAddress?: string;
    reason?: string;
    forceProcess?: boolean;
  }) {
    try {
      const { customerAddress, amount, shopId, adminAddress, reason } = params;

      logger.info('Manual redemption requested', { customerAddress, amount, shopId, adminAddress });

      // Validate customer exists
      const customer = await customerRepository.getCustomer(customerAddress);
      if (!customer) {
        throw new Error('Customer not found');
      }

      // Validate shop exists
      const shop = await shopRepository.getShop(shopId);
      if (!shop) {
        throw new Error('Shop not found');
      }

      // Check customer balance
      const currentBalance = await this.getTokenMinterInstance().getCustomerBalance(customerAddress);
      if (!currentBalance || currentBalance < amount) {
        throw new Error(`Insufficient balance. Customer has ${currentBalance || 0} RCN, requested ${amount} RCN`);
      }

      // Process the redemption by burning tokens
      const burnResult = await this.getTokenMinterInstance().burnTokensFromCustomer(
        customerAddress,
        amount,
        '0x000000000000000000000000000000000000dEaD',
        'Manual admin redemption'
      );

      if (!burnResult.success) {
        throw new Error(burnResult.error || 'Failed to process redemption');
      }

      // Record transaction
      await transactionRepository.recordTransaction({
        id: `manual_redemption_${Date.now()}`,
        type: 'redeem',
        customerAddress: customerAddress.toLowerCase(),
        shopId,
        amount,
        reason: `Manual redemption: ${reason || 'Admin processed'}`,
        transactionHash: burnResult.transactionHash || '',
        timestamp: new Date().toISOString(),
        status: 'confirmed',
        metadata: {
          processedBy: adminAddress || 'admin',
          manual: true,
          adminReason: reason || 'Manual processing'
        }
      });

      // Log admin activity
      await adminRepository.logAdminActivity({
        adminAddress: adminAddress || 'system',
        actionType: 'manual_redemption',
        actionDescription: `Manually processed redemption of ${amount} RCN for customer ${customerAddress}`,
        entityType: 'transaction',
        entityId: `manual_redemption_${Date.now()}`,
        metadata: {
          customerAddress,
          shopId,
          amount,
          reason,
          transactionHash: burnResult.transactionHash
        }
      });

      logger.info('Manual redemption processed successfully', {
        customerAddress,
        amount,
        shopId,
        transactionHash: burnResult.transactionHash
      });

      return {
        success: true,
        transactionHash: burnResult.transactionHash,
        message: `Successfully processed manual redemption of ${amount} RCN`,
        details: {
          customerAddress,
          shopId: shop.shopId,
          shopName: shop.name,
          amount,
          newBalance: (currentBalance - amount)
        }
      };
    } catch (error) {
      logger.error('Manual redemption error:', error);
      throw new Error(`Manual redemption failed: ${error.message}`);
    }
  }

  async sellRcnToShop(params: SellRcnParams) {
    try {
      // Validate shop exists and is active
      const shop = await shopRepository.getShop(params.shopId);
      if (!shop) {
        throw new Error('Shop not found');
      }
      if (!shop.active) {
        throw new Error('Shop is not active');
      }
      if (!shop.verified) {
        throw new Error('Shop is not verified');
      }

      logger.info('Processing RCN sale to shop', {
        shopId: params.shopId,
        amount: params.amount,
        pricePerToken: params.pricePerToken,
        totalCost: params.amount * params.pricePerToken
      });

      // Record the purchase in the database
      const purchase = await shopRepository.createShopPurchase({
        shopId: params.shopId,
        amount: params.amount,
        pricePerRcn: params.pricePerToken,
        totalCost: params.amount * params.pricePerToken,
        paymentMethod: params.paymentMethod,
        paymentReference: params.paymentReference || `ADMIN-${Date.now()}`,
        status: 'completed'
      });

      // Update shop's purchased RCN balance
      await shopRepository.updateShopRcnBalance(params.shopId, params.amount);

      // Update treasury
      await treasuryRepository.updateTreasuryAfterSale(params.amount, params.amount * params.pricePerToken);

      // Log admin activity
      await adminRepository.logAdminActivity({
        adminAddress: params.adminAddress || 'system',
        actionType: 'rcn_sale',
        actionDescription: `Sold ${params.amount} RCN to shop ${shop.name} at $${params.pricePerToken} per token`,
        entityType: 'shop',
        entityId: params.shopId,
        metadata: {
          amount: params.amount,
          pricePerToken: params.pricePerToken,
          totalCost: params.amount * params.pricePerToken,
          paymentMethod: params.paymentMethod,
          paymentReference: params.paymentReference
        }
      });

      return {
        success: true,
        message: `Successfully sold ${params.amount} RCN to shop`,
        purchase: {
          id: purchase.id,
          amount: params.amount,
          totalCost: params.amount * params.pricePerToken,
          newBalance: shop.purchasedRcnBalance + params.amount
        }
      };
    } catch (error) {
      logger.error('Error selling RCN to shop:', error);
      throw error;
    }
  }

  async getShopPendingMintAmount(shopId: string): Promise<number> {
    try {
      const db = treasuryRepository;

      // Try with minted_at column first
      let unmintedQuery;
      try {
        unmintedQuery = await db.query(`
          SELECT COALESCE(SUM(amount), 0) as pending_mint_amount
          FROM shop_rcn_purchases
          WHERE shop_id = $1
            AND status = 'completed'
            AND minted_at IS NULL
        `, [shopId]);
      } catch (error: any) {
        // Fallback if minted_at column doesn't exist
        if (error.message?.includes('minted_at') || error.message?.includes('column')) {
          unmintedQuery = await db.query(`
            SELECT COALESCE(SUM(amount), 0) as pending_mint_amount
            FROM shop_rcn_purchases
            WHERE shop_id = $1
              AND status = 'completed'
          `, [shopId]);
        } else {
          throw error;
        }
      }

      return parseFloat(unmintedQuery.rows[0]?.pending_mint_amount || '0');
    } catch (error) {
      logger.error('Failed to get shop pending mint amount', { shopId, error: error.message });
      return 0;
    }
  }

  async getShopsWithPendingMints() {
    try {
      logger.debug('Starting optimized getShopsWithPendingMints operation');

      // First, get all shops with completed purchases in a single query
      let shopsWithPurchasesQuery;
      let usingMintedAt = false;

      try {
        // Try with minted_at column first - single query for all shops
        shopsWithPurchasesQuery = await treasuryRepository.query(`
          SELECT
            s.shop_id,
            s.name,
            s.wallet_address,
            COALESCE(SUM(p.amount), 0) as total_purchased,
            COUNT(p.id) as purchase_count
          FROM shops s
          INNER JOIN shop_rcn_purchases p ON s.shop_id = p.shop_id
          WHERE p.status = 'completed' AND p.minted_at IS NULL
          GROUP BY s.shop_id, s.name, s.wallet_address
          HAVING COALESCE(SUM(p.amount), 0) > 0
        `);
        usingMintedAt = true;
        logger.debug('Using minted_at column for pending mints query');
      } catch (error: any) {
        // Fallback if minted_at column doesn't exist
        logger.debug('minted_at column not available, using fallback query method');
        if (error.message?.includes('minted_at')) {
          shopsWithPurchasesQuery = await treasuryRepository.query(`
            SELECT
              s.shop_id,
              s.name,
              s.wallet_address,
              COALESCE(SUM(p.amount), 0) as total_purchased,
              COUNT(p.id) as purchase_count
            FROM shops s
            INNER JOIN shop_rcn_purchases p ON s.shop_id = p.shop_id
            WHERE p.status = 'completed'
            GROUP BY s.shop_id, s.name, s.wallet_address
            HAVING COALESCE(SUM(p.amount), 0) > 0
          `);
        } else {
          throw error;
        }
      }

      logger.debug('Found shops with completed purchases', { shopCount: shopsWithPurchasesQuery.rows.length });

      // Now check blockchain balances only for shops with purchases
      const shopsWithPendingMints = [];
      const tokenService = new TokenService();

      // Check balances in parallel for better performance
      const balanceChecks = shopsWithPurchasesQuery.rows.map(async (shop) => {
        try {
          const totalPurchased = parseFloat(shop.total_purchased);
          const blockchainBalance = await tokenService.getBalance(shop.wallet_address);
          const pendingAmount = totalPurchased - blockchainBalance;

          logger.debug('Shop pending mint analysis', { shopId: shop.shop_id, totalPurchased, blockchainBalance, pendingAmount });

          if (pendingAmount > 0) {
            return {
              shop_id: shop.shop_id,
              name: shop.name,
              wallet_address: shop.wallet_address,
              purchased_rcn_balance: totalPurchased,
              blockchain_balance: blockchainBalance,
              pending_mint_amount: pendingAmount
            };
          }
          return null;
        } catch (error) {
          logger.error('Error checking blockchain balance for shop', { shopId: shop.shop_id, error: error.message });
          return null;
        }
      });

      const results = await Promise.all(balanceChecks);
      const validResults = results.filter(result => result !== null);

      logger.debug('Pending mints analysis completed', { shopsWithPendingMints: validResults.length, results: validResults });

      logger.info('Retrieved shops with pending mints', {
        count: validResults.length
      });

      return validResults;
    } catch (error) {
      logger.error('Failed to get shops with pending mints', { error: error.message });
      logger.error('Error getting shops with pending mints:', error);
      throw error;
    }
  }

  async mintShopBalance(shopId: string) {
    const db = treasuryRepository;

    // Start atomic transaction to prevent race conditions
    await db.query('BEGIN');

    try {
      // Get shop data with row lock to prevent concurrent modifications
      const shopQuery = await db.query(`
        SELECT shop_id, name, wallet_address, active, verified
        FROM shops
        WHERE shop_id = $1
        FOR UPDATE
      `, [shopId]);

      if (shopQuery.rowCount === 0) {
        throw new Error('Shop not found');
      }

      const shop = shopQuery.rows[0];

      if (!shop.active || !shop.verified) {
        throw new Error('Shop must be active and verified to mint tokens');
      }

      // Get purchases to mint with row locks to prevent concurrent minting
      let purchasesToMint;
      let hasMintedAtColumn = true;

      try {
        // Try with minted_at column first
        purchasesToMint = await db.query(`
          SELECT id, amount, created_at
          FROM shop_rcn_purchases
          WHERE shop_id = $1
            AND status = 'completed'
            AND minted_at IS NULL
          FOR UPDATE
        `, [shopId]);
      } catch (error: any) {
        // Fallback if minted_at column doesn't exist
        if (error.message?.includes('minted_at') || error.message?.includes('column')) {
          hasMintedAtColumn = false;
          purchasesToMint = await db.query(`
            SELECT id, amount, created_at
            FROM shop_rcn_purchases
            WHERE shop_id = $1
              AND status = 'completed'
            FOR UPDATE
          `, [shopId]);
        } else {
          throw error;
        }
      }

      if (purchasesToMint.rowCount === 0) {
        throw new Error('No unminted purchases found. All completed RCN purchases have already been minted to the blockchain.');
      }

      const totalToMint = purchasesToMint.rows.reduce((sum, p) => sum + parseFloat(p.amount), 0);

      // Get current blockchain balance for verification
      let blockchainBalance = 0;
      try {
        const tokenService = new TokenService();
        blockchainBalance = await tokenService.getBalance(shop.wallet_address);
      } catch (balanceError) {
        logger.warn('Could not fetch blockchain balance for verification', {
          shopId,
          walletAddress: shop.wallet_address,
          error: balanceError
        });
      }

      logger.info('Atomic mint operation starting', {
        shopId,
        walletAddress: shop.wallet_address,
        totalToMint,
        purchaseCount: purchasesToMint.rowCount,
        currentBlockchainBalance: blockchainBalance,
        hasMintedAtColumn
      });

      // Mint tokens directly to shop wallet
      const tokenMinter = new TokenMinter();
      const mintResult = await tokenMinter.adminMintTokens(
        shop.wallet_address,
        totalToMint,
        `Shop purchase mint: ${shopId} - ${purchasesToMint.rowCount} purchases`
      );

      if (!mintResult || !mintResult.success) {
        throw new Error(`Minting failed: ${mintResult?.error || 'Unknown error'}`);
      }

      // Mark specific purchases as minted (atomic operation)
      const purchaseIds = purchasesToMint.rows.map(p => p.id);

      if (hasMintedAtColumn) {
        // Update with minted_at timestamp and transaction hash
        await db.query(`
          UPDATE shop_rcn_purchases
          SET
            minted_at = NOW(),
            transaction_hash = $2
          WHERE
            id = ANY($1)
            AND shop_id = $3
            AND status = 'completed'
        `, [purchaseIds, mintResult.transactionHash, shopId]);
      } else {
        // Fallback: update status to 'minted'
        await db.query(`
          UPDATE shop_rcn_purchases
          SET status = 'minted'
          WHERE
            id = ANY($1)
            AND shop_id = $2
        `, [purchaseIds, shopId]);
      }

      // Verify the update affected the expected number of rows
      const verifyQuery = await db.query(`
        SELECT COUNT(*) as updated_count
        FROM shop_rcn_purchases
        WHERE id = ANY($1)
          AND shop_id = $2
          AND (${hasMintedAtColumn ? 'minted_at IS NOT NULL' : "status = 'minted'"})
      `, [purchaseIds, shopId]);

      const updatedCount = parseInt(verifyQuery.rows[0]?.updated_count || '0');
      if (updatedCount !== purchaseIds.length) {
        throw new Error(`Database update verification failed: expected ${purchaseIds.length}, got ${updatedCount}`);
      }

      // Commit the transaction
      await db.query('COMMIT');

      logger.info('Atomic mint operation completed successfully', {
        shopId,
        transactionHash: mintResult.transactionHash,
        amountMinted: totalToMint,
        purchasesProcessed: purchaseIds.length,
        newBlockchainBalance: blockchainBalance + totalToMint
      });

      return {
        success: true,
        message: `Successfully minted ${totalToMint} RCN to shop wallet`,
        data: {
          shopId,
          shopName: shop.name,
          amountMinted: totalToMint,
          walletAddress: shop.wallet_address,
          transactionHash: mintResult.transactionHash,
          purchasesProcessed: purchaseIds.length,
          atomicOperation: true
        }
      };

    } catch (error) {
      // Rollback transaction on any error
      await db.query('ROLLBACK');

      logger.error('Atomic mint operation failed - transaction rolled back:', {
        shopId,
        error: error.message,
        stack: error.stack
      });

      throw error;
    }
  }
}

// Export singleton instance
export const tokenOperationsService = new TokenOperationsService();
