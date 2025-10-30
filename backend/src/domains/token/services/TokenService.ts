  // backend/src/services/tokenService.ts
  import { TokenMinter, MintResult } from '../../../contracts/TokenMinter';
  import { TierManager, CustomerData } from '../../../contracts/TierManager';
  import { customerRepository, shopRepository, transactionRepository, adminRepository } from '../../../repositories';
  import { ReferralRepository } from '../../../repositories/ReferralRepository';
  import { logger } from '../../../utils/logger';

  export interface TokenEarningRequest {
    customerAddress: string;
    amount: number;
    reason: string;
    shopId: string;
    metadata?: any;
  }

  export interface TokenRedemptionRequest {
    customerAddress: string;
    shopId: string;
    amount: number;
    notes?: string;
  }

  export interface TokenTransferRequest {
    fromAddress: string;
    toAddress: string;
    amount: number;
    reason: string;
  }

  export interface TokenServiceStats {
    totalSupply: number;
    totalHolders: number;
    totalTransactions: number;
    averageBalance: number;
    topHolders: Array<{
      address: string;
      balance: number;
      tier: string;
    }>;
  }

  export class TokenService {
    private tokenMinter: TokenMinter | null = null;
    private tierManager: TierManager | null = null;
    private referralRepository: ReferralRepository;

    constructor() {
      this.referralRepository = new ReferralRepository();
    }

    private getTokenMinter(): TokenMinter {
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

    // Process repair-based token earning
    async processRepairEarning(
      customerAddress: string,
      repairAmount: number,
      shopId: string
    ): Promise<MintResult> {
      try {
        logger.transaction('Processing repair earning', {
          customerAddress,
          repairAmount,
          shopId
        });

        // Get or create customer
        let customer = await customerRepository.getCustomer(customerAddress);
        if (!customer) {
          customer = TierManager.createNewCustomer(customerAddress);
          await customerRepository.createCustomer(customer);
          logger.info('New customer created during repair earning', { customerAddress });
        }

        // Process the repair earning
        const result = await this.getTokenMinter().mintRepairTokens(
          customerAddress,
          repairAmount,
          shopId,
          customer
        );

        if (result.success && result.tokensToMint && result.newTier) {
          // Update customer in database
          await customerRepository.updateCustomerAfterEarning(
            customerAddress,
            result.tokensToMint,
            result.newTier as any
          );

          // Update shop statistics
          await this.updateShopStats(shopId, result.tokensToMint, 0);

          // Record transaction
          await transactionRepository.recordTransaction({
            id: `repair_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            type: 'mint',
            customerAddress: customerAddress.toLowerCase(),
            shopId,
            amount: result.tokensToMint,
            reason: `Repair completion - $${repairAmount}`,
            transactionHash: result.transactionHash || '',
            timestamp: new Date().toISOString(),
            status: 'confirmed',
            metadata: {
              repairAmount,
              oldTier: customer.tier,
              newTier: result.newTier
            }
          });

          // Track RCN source
          await this.referralRepository.recordRcnSource({
            customerAddress: customerAddress.toLowerCase(),
            sourceType: 'shop_repair',
            sourceShopId: shopId,
            amount: result.tokensToMint,
            transactionId: `repair_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            transactionHash: result.transactionHash,
            isRedeemable: true,
            metadata: {
              repairAmount,
              oldTier: customer.tier,
              newTier: result.newTier
            }
          });

          // Update customer's home shop
          await this.referralRepository.updateCustomerHomeShop(customerAddress.toLowerCase());

          logger.transaction('Repair earning processed successfully', {
            customerAddress,
            tokensEarned: result.tokensToMint,
            newTier: result.newTier,
            transactionHash: result.transactionHash
          });
        }

        return result;

      } catch (error: any) {
        logger.error('Error processing repair earning:', error);
        return {
          success: false,
          error: `Failed to process repair earning: ${error.message}`
        };
      }
    }

    // Process referral rewards
    async processReferralReward(
      referrerAddress: string,
      refereeAddress: string,
      shopId?: string
    ): Promise<MintResult> {
      try {
        logger.transaction('Processing referral reward', {
          referrerAddress,
          refereeAddress,
          shopId
        });

        // Ensure both customers exist
        let referrer = await customerRepository.getCustomer(referrerAddress);
        let referee = await customerRepository.getCustomer(refereeAddress);

        if (!referrer) {
          referrer = TierManager.createNewCustomer(referrerAddress);
          await customerRepository.createCustomer(referrer);
        }

        if (!referee) {
          referee = TierManager.createNewCustomer(refereeAddress);
          await customerRepository.createCustomer(referee);
        }

        // Process referral minting
        const result = await this.getTokenMinter().mintReferralTokens(
          referrerAddress,
          refereeAddress,
          shopId
        );

        if (result.success) {
          // Update both customers
          const referrerNewTier = this.getTierManager().calculateTier(referrer.lifetimeEarnings + 25);
          const refereeNewTier = this.getTierManager().calculateTier(referee.lifetimeEarnings + 10);

          await Promise.all([
            customerRepository.updateCustomerAfterEarning(referrerAddress, 25, referrerNewTier),
            customerRepository.updateCustomerAfterEarning(refereeAddress, 10, refereeNewTier)
          ]);

          // Record transaction
          await transactionRepository.recordTransaction({
            id: `referral_${Date.now()}`,
            type: 'mint',
            customerAddress: referrerAddress.toLowerCase(),
            shopId: shopId || 'referral_system',
            amount: 35, // Total tokens (25 + 10)
            reason: `Referral reward: ${referrerAddress} → ${refereeAddress}`,
            transactionHash: result.transactionHash || '',
            timestamp: new Date().toISOString(),
            status: 'confirmed',
            metadata: {
              referrerTokens: 25,
              refereeTokens: 10,
              refereeAddress
            }
          });

          logger.transaction('Referral reward processed successfully', {
            referrerAddress,
            refereeAddress,
            transactionHash: result.transactionHash
          });
        }

        return result;

      } catch (error: any) {
        logger.error('Error processing referral reward:', error);
        return {
          success: false,
          error: `Failed to process referral reward: ${error.message}`
        };
      }
    }

    // Process engagement-based earning
    async processEngagementEarning(
      customerAddress: string,
      engagementType: string,
      baseAmount: number = 1
    ): Promise<MintResult> {
      try {
        logger.transaction('Processing engagement earning', {
          customerAddress,
          engagementType,
          baseAmount
        });

        const customer = await customerRepository.getCustomer(customerAddress);
        if (!customer) {
          return {
            success: false,
            error: 'Customer not found. Must be registered first.'
          };
        }

        // Process engagement earning
        const result = await this.getTokenMinter().mintEngagementTokens({
          customerAddress,
          engagementType: engagementType as any,
          baseAmount,
          customerData: customer
        });

        if (result.success && result.tokensToMint) {
          // Update customer
          const newTier = this.getTierManager().calculateTier(customer.lifetimeEarnings + result.tokensToMint);
          await customerRepository.updateCustomerAfterEarning(customerAddress, result.tokensToMint, newTier);

          // Record transaction
          await transactionRepository.recordTransaction({
            id: `engagement_${Date.now()}`,
            type: 'mint',
            customerAddress: customerAddress.toLowerCase(),
            shopId: 'engagement_system',
            amount: result.tokensToMint,
            reason: `Engagement reward: ${engagementType}`,
            transactionHash: result.transactionHash || '',
            timestamp: new Date().toISOString(),
            status: 'confirmed',
            metadata: {
              engagementType,
              baseAmount,
              multiplier: this.getTierManager().getEngagementMultiplier(customer.tier)
            }
          });

          logger.transaction('Engagement earning processed successfully', {
            customerAddress,
            engagementType,
            tokensEarned: result.tokensToMint,
            transactionHash: result.transactionHash
          });
        }

        return result;

      } catch (error: any) {
        logger.error('Error processing engagement earning:', error);
        return {
          success: false,
          error: `Failed to process engagement earning: ${error.message}`
        };
      }
    }

    // Process token redemption at shop
    async processRedemption(request: TokenRedemptionRequest): Promise<{
      success: boolean;
      transactionId?: string;
      error?: string;
      message?: string;
    }> {
      try {
        const { customerAddress, shopId, amount, notes } = request;

        logger.transaction('Processing token redemption', {
          customerAddress,
          shopId,
          amount
        });

        // Get customer and shop
        const [customer, shop] = await Promise.all([
          customerRepository.getCustomer(customerAddress),
          shopRepository.getShop(shopId)
        ]);

        if (!customer) {
          return { success: false, error: 'Customer not found' };
        }

        if (!shop) {
          return { success: false, error: 'Shop not found' };
        }

        if (!shop.active || !shop.verified) {
          return { success: false, error: 'Shop must be active and verified' };
        }

        // Check customer balance
        const currentBalance = await this.getTokenMinter().getCustomerBalance(customerAddress);
        if (!currentBalance || currentBalance < amount) {
          return {
            success: false,
            error: 'Insufficient balance',
          };
        }

        // Check redemption eligibility
        const isHomeShop = customer.fixflowCustomerId === shop.fixflowShopId;
        const redemptionCheck = this.getTierManager().canRedeemAtShop(customer, amount, isHomeShop);

        if (!redemptionCheck.canRedeem) {
          return {
            success: false,
            error: redemptionCheck.message || 'Redemption not allowed'
          };
        }

        // Record redemption transaction
        const transactionId = `redeem_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        
        await transactionRepository.recordTransaction({
          id: transactionId,
          type: 'redeem',
          customerAddress: customerAddress.toLowerCase(),
          shopId,
          amount,
          reason: `Redemption at ${shop.name}`,
          transactionHash: '', // In real implementation, would burn tokens
          timestamp: new Date().toISOString(),
          status: 'confirmed',
          metadata: {
            shopName: shop.name,
            isHomeShop,
            notes,
            customerTier: customer.tier
          }
        });

        // Update shop statistics
        await this.updateShopStats(shopId, 0, amount);

        logger.transaction('Token redemption processed successfully', {
          customerAddress,
          shopId,
          amount,
          transactionId,
          isHomeShop
        });

        return {
          success: true,
          transactionId,
          message: `Successfully redeemed ${amount} RCN at ${shop.name}`
        };

      } catch (error: any) {
        logger.error('Error processing redemption:', error);
        return {
          success: false,
          error: `Failed to process redemption: ${error.message}`
        };
      }
    }

    // Get comprehensive token statistics
    async getTokenStatistics(): Promise<TokenServiceStats> {
      try {
        const [contractStats, platformStats] = await Promise.all([
          this.getTokenMinter().getContractStats(),
          // Use AdminRepository to get optimized platform statistics from materialized view
          adminRepository.getPlatformStatisticsFromView()
        ]);

        // Get top holders (simplified - would need proper database query)
        const allCustomers = await Promise.all([
          customerRepository.getCustomersByTier('BRONZE'),
          customerRepository.getCustomersByTier('SILVER'),
          customerRepository.getCustomersByTier('GOLD')
        ]);

        const flatCustomers = allCustomers.flat();
        const topHolders = flatCustomers
          .sort((a, b) => b.lifetimeEarnings - a.lifetimeEarnings)
          .slice(0, 10)
          .map(customer => ({
            address: customer.address,
            balance: customer.lifetimeEarnings,
            tier: customer.tier
          }));

        const totalBalance = flatCustomers.reduce((sum, c) => sum + c.lifetimeEarnings, 0);
        const averageBalance = flatCustomers.length > 0 ? totalBalance / flatCustomers.length : 0;

        return {
          totalSupply: contractStats?.totalSupplyReadable || 0,
          totalHolders: flatCustomers.length,
          totalTransactions: platformStats.transactionStats.totalTransactions,
          averageBalance,
          topHolders
        };

      } catch (error: any) {
        logger.error('Error getting token statistics:', error);
        throw new Error('Failed to retrieve token statistics');
      }
    }

    // General purpose token minting with source tracking
    async mintTokens(
      customerAddress: string,
      amount: number,
      reason: string,
      sourceType: 'shop_repair' | 'referral_bonus' | 'tier_bonus' | 'promotion' = 'promotion',
      shopId?: string,
      metadata?: any
    ): Promise<MintResult> {
      try {
        logger.transaction('Processing token mint', {
          customerAddress,
          amount,
          reason,
          sourceType,
          shopId
        });

        // Get customer
        const customer = await customerRepository.getCustomer(customerAddress);
        if (!customer) {
          return {
            success: false,
            error: 'Customer not found'
          };
        }

        // Validate operation
        const validation = await this.validateTokenOperation('mint', customerAddress, amount);
        if (!validation.isValid) {
          return {
            success: false,
            error: validation.error
          };
        }

        // Mint tokens using TokenMinter private method via repair tokens
        // Since mintTokens is private, we use a workaround
        const result = await (this.getTokenMinter() as any).mintTokens(
          customerAddress,
          amount,
          `manual_${sourceType}_${Date.now()}`
        );

        if (result.success) {
          // Calculate new tier
          const newTier = this.getTierManager().calculateTier(customer.lifetimeEarnings + amount);

          // Update customer
          await customerRepository.updateCustomerAfterEarning(customerAddress, amount, newTier);

          // Record transaction
          const transactionId = `mint_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          await transactionRepository.recordTransaction({
            id: transactionId,
            type: 'mint',
            customerAddress: customerAddress.toLowerCase(),
            shopId: shopId || 'system',
            amount,
            reason,
            transactionHash: result.transactionHash || '',
            timestamp: new Date().toISOString(),
            status: 'confirmed',
            metadata: {
              sourceType,
              ...metadata
            }
          });

          // Track RCN source
          await this.referralRepository.recordRcnSource({
            customerAddress: customerAddress.toLowerCase(),
            sourceType,
            sourceShopId: shopId,
            amount,
            transactionId,
            transactionHash: result.transactionHash,
            isRedeemable: true, // All minted tokens are redeemable
            metadata: {
              reason,
              ...metadata
            }
          });

          // Update home shop if shop-based earning
          if (shopId && sourceType === 'shop_repair') {
            await this.referralRepository.updateCustomerHomeShop(customerAddress.toLowerCase());
          }

          logger.transaction('Token mint processed successfully', {
            customerAddress,
            amount,
            sourceType,
            transactionHash: result.transactionHash
          });

          return {
            ...result,
            newTier: newTier as string
          };
        }

        return result;

      } catch (error: any) {
        logger.error('Error minting tokens:', error);
        return {
          success: false,
          error: `Failed to mint tokens: ${error.message}`
        };
      }
    }

    // Get customer balance (earned vs total)
    async getBalance(customerAddress: string): Promise<number> {
      try {
        const balance = await this.getTokenMinter().getCustomerBalance(customerAddress);
        return balance || 0;
      } catch (error) {
        logger.error('Error getting balance:', error);
        return 0;
      }
    }

    async getRCNBalance(address: string): Promise<number> {
      try {
        const balance = await this.getTokenMinter().getCustomerBalance(address);
        return balance || 0;
      } catch (error) {
        logger.error('Error getting RCN balance:', error);
        return 0;
      }
    }

    // Validate token operation before execution
    async validateTokenOperation(
      operation: 'mint' | 'redeem' | 'transfer',
      customerAddress: string,
      amount: number,
      additionalParams?: any
    ): Promise<{ isValid: boolean; error?: string; details?: any }> {
      try {
        const customer = await customerRepository.getCustomer(customerAddress);
        
        if (!customer) {
          return { isValid: false, error: 'Customer not found' };
        }

        if (!customer.isActive) {
          return { isValid: false, error: 'Customer account is inactive' };
        }

        const earningCapacity = this.getTierManager().getEarningCapacity(customer);

        switch (operation) {
          case 'mint':
            if (!earningCapacity.canEarnToday) {
              return { 
                isValid: false, 
                error: 'Daily earning limit reached',
                details: { dailyRemaining: earningCapacity.dailyRemaining }
              };
            }
            
            if (!earningCapacity.canEarnThisMonth) {
              return { 
                isValid: false, 
                error: 'Monthly earning limit reached',
                details: { monthlyRemaining: earningCapacity.monthlyRemaining }
              };
            }

            if (amount > earningCapacity.dailyRemaining) {
              return {
                isValid: false,
                error: 'Amount exceeds daily earning capacity',
                details: { maxAmount: earningCapacity.dailyRemaining }
              };
            }
            break;

          case 'redeem':
            const currentBalance = await this.getTokenMinter().getCustomerBalance(customerAddress);
            if (!currentBalance || currentBalance < amount) {
              return {
                isValid: false,
                error: 'Insufficient balance',
                details: { currentBalance, requestedAmount: amount }
              };
            }

            if (additionalParams?.shopId) {
              const shop = await shopRepository.getShop(additionalParams.shopId);
              if (!shop?.active || !shop?.verified) {
                return { isValid: false, error: 'Shop is not active or verified' };
              }

              const isHomeShop = customer.fixflowCustomerId === shop.fixflowShopId;
              const redemptionCheck = this.getTierManager().canRedeemAtShop(customer, amount, isHomeShop);
              
              if (!redemptionCheck.canRedeem) {
                return {
                  isValid: false,
                  error: redemptionCheck.message,
                  details: { maxRedemption: redemptionCheck.maxRedemption }
                };
              }
            }
            break;
        }

        return { isValid: true };

      } catch (error: any) {
        logger.error('Error validating token operation:', error);
        return { isValid: false, error: 'Validation failed' };
      }
    }

    // Emergency functions
    async emergencyPause(): Promise<MintResult> {
      try {
        logger.security('Emergency pause initiated');
        return await this.getTokenMinter().pauseContract();
      } catch (error: any) {
        logger.error('Emergency pause failed:', error);
        return { success: false, error: error.message };
      }
    }

    async emergencyUnpause(): Promise<MintResult> {
      try {
        logger.security('Emergency unpause initiated');
        return await this.getTokenMinter().unpauseContract();
      } catch (error: any) {
        logger.error('Emergency unpause failed:', error);
        return { success: false, error: error.message };
      }
    }

    // Helper function to update shop statistics
    private async updateShopStats(shopId: string, tokensIssued: number, tokensRedeemed: number): Promise<void> {
      try {
        const shop = await shopRepository.getShop(shopId);
        if (shop) {
          await shopRepository.updateShop(shopId, {
            totalTokensIssued: shop.totalTokensIssued + tokensIssued,
            totalRedemptions: shop.totalRedemptions + tokensRedeemed,
            lastActivity: new Date().toISOString()
          });
        }
      } catch (error) {
        logger.error('Error updating shop stats:', error);
        // Don't throw - this is a secondary operation
      }
    }
  }

  // Export singleton factory function
  let tokenServiceInstance: TokenService | null = null;
  
  export const getTokenService = (): TokenService => {
    if (!tokenServiceInstance) {
      tokenServiceInstance = new TokenService();
    }
    return tokenServiceInstance;
  };
  
  // For backward compatibility - expose instance methods directly
  export const tokenService = {
    get instance() {
      return getTokenService();
    },
    processRepairEarning: (customerAddress: string, repairAmount: number, shopId: string) => 
      getTokenService().processRepairEarning(customerAddress, repairAmount, shopId),
    processReferralReward: (referrerAddress: string, refereeAddress: string, shopId?: string) => 
      getTokenService().processReferralReward(referrerAddress, refereeAddress, shopId),
    processEngagementEarning: (customerAddress: string, engagementType: string, baseAmount?: number) => 
      getTokenService().processEngagementEarning(customerAddress, engagementType, baseAmount),
    processRedemption: (request: TokenRedemptionRequest) => 
      getTokenService().processRedemption(request),
    getTokenStatistics: () => 
      getTokenService().getTokenStatistics(),
    validateTokenOperation: (operation: 'mint' | 'redeem' | 'transfer', customerAddress: string, amount: number, additionalParams?: any) => 
      getTokenService().validateTokenOperation(operation, customerAddress, amount, additionalParams),
    emergencyPause: () => 
      getTokenService().emergencyPause(),
    emergencyUnpause: () => 
      getTokenService().emergencyUnpause()
  };