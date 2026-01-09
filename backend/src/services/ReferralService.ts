import { ReferralRepository } from '../repositories/ReferralRepository';
import { CustomerRepository } from '../repositories/CustomerRepository';
import { TransactionRepository } from '../repositories/TransactionRepository';
import { TokenService } from '../domains/token/services/TokenService';
import { TierManager } from '../contracts/TierManager';
import { logger } from '../utils/logger';
import { eventBus } from '../events/EventBus';
import { v4 as uuidv4 } from 'uuid';

export class ReferralService {
  private referralRepository: ReferralRepository;
  private customerRepository: CustomerRepository;
  private transactionRepository: TransactionRepository;
  private tokenService: TokenService;

  constructor() {
    this.referralRepository = new ReferralRepository();
    this.customerRepository = new CustomerRepository();
    this.transactionRepository = new TransactionRepository();
    this.tokenService = new TokenService();
  }

  async generateReferralCode(customerAddress: string): Promise<string> {
    try {
      // Check if customer exists
      const customer = await this.customerRepository.getCustomer(customerAddress);
      if (!customer) {
        throw new Error('Customer not found');
      }

      // Check if customer already has a referral code
      const existingReferral = await this.referralRepository.getReferralByReferrer(customerAddress);
      if (existingReferral) {
        return existingReferral.referralCode;
      }

      // Create new referral
      const referral = await this.referralRepository.createReferral(customerAddress);

      logger.info('Referral code generated', {
        customerAddress,
        referralCode: referral.referralCode
      });

      return referral.referralCode;
    } catch (error) {
      logger.error('Error generating referral code:', error);
      throw error;
    }
  }

  async validateReferralCode(code: string): Promise<{
    valid: boolean;
    referrerAddress?: string;
    expiresAt?: string;
    message?: string;
  }> {
    try {
      const referral = await this.referralRepository.getReferralByCode(code);
      
      if (!referral) {
        return {
          valid: false,
          message: 'Invalid or expired referral code'
        };
      }

      return {
        valid: true,
        referrerAddress: referral.referrerAddress,
        expiresAt: referral.expiresAt
      };
    } catch (error) {
      logger.error('Error validating referral code:', error);
      throw error;
    }
  }

  async processReferral(
    referralCode: string,
    refereeAddress: string,
    referrerAddress: string,
    refereeData: any
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Find the referrer by their referral code in customers table
      // const referrer = await this.customerRepository.getCustomerByReferralCode(referralCode);
      // if (!referrer) {
      //   return {
      //     success: false,
      //     message: 'Invalid referral code'
      //   };
      // }

      // Check if referrer is trying to refer themselves
      if (referrerAddress.toLowerCase() === refereeAddress.toLowerCase()) {
        return {
          success: false,
          message: 'Cannot refer yourself'
        };
      }

      // Update the customer's referred_by field
      const existingCustomer = await this.customerRepository.getCustomer(refereeAddress);
      if (existingCustomer && !existingCustomer.referredBy) {
        await this.customerRepository.updateCustomer(refereeAddress, {
          referredBy: referrerAddress
        });
      }

      // Create PENDING referral record in referrals table with metadata
      const referral = await this.referralRepository.createReferral(
        referrerAddress,
        refereeAddress,
        {
          referralCode,
          referrerAddress: referrerAddress,
          refereeAddress,
          registeredAt: new Date().toISOString(),
          awaitingFirstRepair: true
        }
      );

      // Emit event for pending referral
      await eventBus.publish({
        type: 'referral.pending',
        aggregateId: referralCode,
        data: {
          referralCode,
          referrerAddress: referrerAddress,
          refereeAddress,
          referralId: referral.id
        },
        timestamp: new Date(),
        source: 'ReferralService',
        version: 1
      });

      logger.info('Referral recorded as pending (awaiting first repair)', {
        referralCode,
        referrerAddress: referrerAddress,
        refereeAddress,
        referralId: referral.id
      });

      return {
        success: true,
        message: 'Referral recorded successfully. Rewards will be distributed after first repair completion.'
      };
    } catch (error) {
      logger.error('Error processing referral:', error);
      throw error;
    }
  }

  async getReferralStats(customerAddress?: string): Promise<any> {
    try {
      if (customerAddress) {
        // Get customer to check their referral count
        const customer = await this.customerRepository.getCustomer(customerAddress);
        if (!customer) {
          throw new Error('Customer not found');
        }
        
        // Get referral records from referrals table
        const referrals = await this.referralRepository.getCustomerReferrals(customerAddress);
        const successful = referrals.filter(r => r.status === 'completed');
        
        // Use the referral count from customer record as the source of truth
        const successfulCount = customer.referralCount || 0;
        
        return {
          totalReferrals: Math.max(referrals.length, successfulCount),
          successfulReferrals: successfulCount,
          pendingReferrals: referrals.filter(r => r.status === 'pending').length,
          totalEarned: successfulCount * 25,
          referrals: referrals.slice(0, 10) // Last 10 referrals
        };
      } else {
        // Get leaderboard
        const stats = await this.referralRepository.getReferralStats(20);
        return {
          leaderboard: stats,
          totalReferrals: stats.reduce((sum, s) => sum + s.totalReferrals, 0),
          totalRewardsDistributed: stats.reduce((sum, s) => sum + s.totalEarnedRcn, 0)
        };
      }
    } catch (error) {
      logger.error('Error getting referral stats:', error);
      throw error;
    }
  }

  async getCustomerRcnBreakdown(customerAddress: string): Promise<any> {
    try {
      const breakdown = await this.referralRepository.getCustomerRcnBySource(customerAddress);
      const sources = await this.referralRepository.getCustomerRcnSources(customerAddress);
      const homeShop = await this.referralRepository.getHomeShop(customerAddress);
      
      // Get current blockchain balance
      const blockchainBalance = await this.tokenService.getBalance(customerAddress);
      
      return {
        totalBalance: blockchainBalance,
        availableBalance: breakdown.earned,
        redeemableBalance: breakdown.earned, // All earned RCN can be redeemed
        homeShop,
        breakdownByShop: breakdown.byShop,
        breakdownByType: breakdown.byType,
        recentSources: sources.slice(0, 10),
        crossShopLimit: breakdown.earned * 0.2 // 20% for cross-shop
      };
    } catch (error) {
      logger.error('Error getting customer RCN breakdown:', error);
      throw error;
    }
  }

  async completeReferralOnFirstRepair(
    customerAddress: string,
    shopId: string,
    repairAmount: number
  ): Promise<{ success: boolean; message: string; referralCompleted?: boolean }> {
    const fn = 'completeReferralOnFirstRepair';
    logger.info('completeReferralOnFirstRepair called', {
      fn,
      customerAddress,
      shopId,
      repairAmount
    });

    try {
      // Check if customer was referred
      const customer = await this.customerRepository.getCustomer(customerAddress);
      if (!customer || !customer.referredBy) {
        logger.info('Customer was not referred, skipping referral completion', {
          fn,
          customerAddress,
          customerExists: !!customer
        });
        return {
          success: true,
          message: 'Customer was not referred',
          referralCompleted: false
        };
      }

      // Check if this is the customer's first repair
      const transactions = await this.transactionRepository.getTransactionsByCustomer(customerAddress, 100);
      const repairCount = transactions.filter(t => t.type === 'mint' && t.shopId !== 'admin_system').length;

      logger.info('Checking repair count for referral eligibility', {
        fn,
        customerAddress,
        repairCount,
        referredBy: customer.referredBy
      });

      if (repairCount > 1) {
        logger.info('Not the first repair, skipping referral completion', {
          fn,
          customerAddress,
          repairCount
        });
        return {
          success: true,
          message: 'Not the first repair',
          referralCompleted: false
        };
      }

      // Find pending referral for this customer
      const referrals = await this.referralRepository.getCustomerReferrals(customer.referredBy);
      const pendingReferral = referrals.find(
        r => r.status === 'pending' && 
        r.referredAddress?.toLowerCase() === customerAddress.toLowerCase()
      );

      logger.info('Searching for pending referral', {
        fn,
        customerAddress,
        referredBy: customer.referredBy,
        totalReferrals: referrals.length,
        pendingReferralFound: !!pendingReferral,
        referralCode: pendingReferral?.referralCode
      });

      if (!pendingReferral) {
        logger.warn('No pending referral found for referred customer', {
          fn,
          customerAddress,
          referredBy: customer.referredBy
        });
        return { 
          success: false, 
          message: 'No pending referral found',
          referralCompleted: false
        };
      }

      // Now distribute the rewards
      const transactionId = uuidv4();

      logger.info('Starting referral reward distribution', {
        fn,
        transactionId,
        referralCode: pendingReferral.referralCode,
        referrerAddress: customer.referredBy,
        refereeAddress: customerAddress
      });

      // Add 25 RCN to referrer's database balance (NOT minting to wallet)
      // Wallet minting only happens through manual mint in customer overview
      logger.info('Adding 25 RCN to referrer database balance', {
        fn,
        referrerAddress: customer.referredBy,
        amount: 25
      });

      // Get referrer to calculate new tier
      const tierManager = new TierManager();
      const referrerCustomer = await this.customerRepository.getCustomer(customer.referredBy);
      if (referrerCustomer) {
        const referrerNewTier = tierManager.calculateTier(referrerCustomer.lifetimeEarnings + 25);
        await this.customerRepository.updateBalanceAfterEarning(
          customer.referredBy,
          25,
          referrerNewTier
        );

        // Record transaction for tracking (use 'tier_bonus' type for referral bonuses)
        await this.transactionRepository.recordTransaction({
          id: `referral_referrer_${transactionId}`,
          type: 'tier_bonus',
          customerAddress: customer.referredBy.toLowerCase(),
          shopId: shopId,
          amount: 25,
          reason: 'Referral bonus - referred customer completed first repair',
          transactionHash: undefined, // No blockchain transaction
          timestamp: new Date().toISOString(),
          status: 'confirmed',
          metadata: {
            refereeAddress: customerAddress,
            referralCode: pendingReferral.referralCode,
            bonusType: 'referral_referrer',
            balanceOnly: true // Flag indicating this is balance-only, no wallet mint
          }
        });
      }

      logger.info('Successfully added 25 RCN to referrer database balance', {
        fn,
        referrerAddress: customer.referredBy
      });

      // Record referrer's RCN source
      await this.referralRepository.recordRcnSource({
        customerAddress: customer.referredBy,
        sourceType: 'referral_bonus',
        amount: 25,
        transactionId,
        isRedeemable: true,
        metadata: {
          refereeAddress: customerAddress,
          referralCode: pendingReferral.referralCode,
          firstRepairShop: shopId,
          firstRepairAmount: repairAmount
        }
      });

      // Add 10 RCN to referee's database balance (NOT minting to wallet)
      // Wallet minting only happens through manual mint in customer overview
      logger.info('Adding 10 RCN to referee database balance', {
        fn,
        refereeAddress: customerAddress,
        amount: 10
      });

      // Calculate referee's new tier
      const refereeNewTier = tierManager.calculateTier(customer.lifetimeEarnings + 10);
      await this.customerRepository.updateBalanceAfterEarning(
        customerAddress,
        10,
        refereeNewTier
      );

      // Record transaction for tracking (use 'tier_bonus' type for referral bonuses)
      await this.transactionRepository.recordTransaction({
        id: `referral_referee_${transactionId}`,
        type: 'tier_bonus',
        customerAddress: customerAddress.toLowerCase(),
        shopId: shopId,
        amount: 10,
        reason: 'Referral bonus - first repair completed',
        transactionHash: undefined, // No blockchain transaction
        timestamp: new Date().toISOString(),
        status: 'confirmed',
        metadata: {
          referrerAddress: customer.referredBy,
          referralCode: pendingReferral.referralCode,
          bonusType: 'referral_referee',
          balanceOnly: true // Flag indicating this is balance-only, no wallet mint
        }
      });

      logger.info('Successfully added 10 RCN to referee database balance', {
        fn,
        refereeAddress: customerAddress
      });

      // Record referee's RCN source
      await this.referralRepository.recordRcnSource({
        customerAddress: customerAddress,
        sourceType: 'referral_bonus',
        amount: 10,
        transactionId,
        isRedeemable: true,
        metadata: {
          referrerAddress: customer.referredBy,
          referralCode: pendingReferral.referralCode,
          firstRepairShop: shopId,
          firstRepairAmount: repairAmount
        }
      });

      // Mark referral as completed
      logger.info('Marking referral as completed', {
        fn,
        referralCode: pendingReferral.referralCode,
        refereeAddress: customerAddress,
        transactionId
      });
      await this.referralRepository.completeReferral(
        pendingReferral.referralCode,
        customerAddress,
        transactionId
      );
      logger.info('Referral marked as completed', {
        fn,
        referralCode: pendingReferral.referralCode
      });

      // Update referrer's referral count
      const referrer = await this.customerRepository.getCustomer(customer.referredBy);
      if (referrer) {
        const newCount = (referrer.referralCount || 0) + 1;
        logger.info('Updating referrer referral count', {
          fn,
          referrerAddress: customer.referredBy,
          previousCount: referrer.referralCount || 0,
          newCount
        });
        await this.customerRepository.updateCustomer(customer.referredBy, {
          referralCount: newCount
        });
      }

      // Emit event
      await eventBus.publish({
        type: 'referral.completed',
        aggregateId: pendingReferral.referralCode,
        data: {
          referralCode: pendingReferral.referralCode,
          referrerAddress: customer.referredBy,
          refereeAddress: customerAddress,
          transactionId,
          firstRepairShop: shopId,
          firstRepairAmount: repairAmount,
          rewards: {
            referrer: 25,
            referee: 10
          }
        },
        timestamp: new Date(),
        source: 'ReferralService',
        version: 1
      });

      logger.info('Referral completed on first repair', {
        fn,
        referralCode: pendingReferral.referralCode,
        referrerAddress: customer.referredBy,
        refereeAddress: customerAddress,
        shopId,
        repairAmount
      });

      return { 
        success: true, 
        message: 'Referral rewards distributed successfully',
        referralCompleted: true
      };
    } catch (error) {
      logger.error('Error completing referral on first repair', { fn, error });
      throw error;
    }
  }

  async verifyRedemption(
    customerAddress: string,
    shopId: string,
    amount: number
  ): Promise<{
    allowed: boolean;
    reason?: string;
    availableAmount?: number;
  }> {
    try {
      const breakdown = await this.referralRepository.getCustomerRcnBySource(customerAddress);
      const homeShop = await this.referralRepository.getHomeShop(customerAddress);
      
      // Check if customer has enough earned RCN
      if (breakdown.earned < amount) {
        return {
          allowed: false,
          reason: 'Insufficient earned RCN balance',
          availableAmount: breakdown.earned
        };
      }
      
      // If redeeming at home shop, allow full balance
      if (homeShop === shopId) {
        return {
          allowed: true,
          availableAmount: breakdown.earned
        };
      }
      
      // For cross-shop redemptions, check 20% limit
      const crossShopLimit = breakdown.earned * 0.2;
      if (amount > crossShopLimit) {
        return {
          allowed: false,
          reason: `Cross-shop redemptions limited to 20% of earned balance`,
          availableAmount: crossShopLimit
        };
      }
      
      return {
        allowed: true,
        availableAmount: crossShopLimit
      };
    } catch (error) {
      logger.error('Error verifying redemption:', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    // Cleanup if needed
  }
}