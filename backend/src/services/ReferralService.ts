import { ReferralRepository } from '../repositories/ReferralRepository';
import { CustomerRepository } from '../repositories/CustomerRepository';
import { TransactionRepository } from '../repositories/TransactionRepository';
import { TokenService } from '../domains/token/services/TokenService';
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
    refereeData: any
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Validate referral code
      const referral = await this.referralRepository.getReferralByCode(referralCode);
      if (!referral) {
        return { 
          success: false, 
          message: 'Invalid or expired referral code' 
        };
      }

      // Check if referee already exists
      const existingCustomer = await this.customerRepository.getCustomer(refereeAddress);
      if (existingCustomer) {
        return { 
          success: false, 
          message: 'Customer already registered' 
        };
      }

      // Check if referrer is trying to refer themselves
      if (referral.referrerAddress.toLowerCase() === refereeAddress.toLowerCase()) {
        return { 
          success: false, 
          message: 'Cannot refer yourself' 
        };
      }

      // Create referee customer with referral link
      await this.customerRepository.createCustomer({
        ...refereeData,
        address: refereeAddress,
        referredBy: referral.referrerAddress
      });

      // Process referral rewards
      const transactionId = uuidv4();
      
      // Mint 25 RCN to referrer
      await this.tokenService.mintTokens(
        referral.referrerAddress,
        25,
        'Referral bonus for bringing new customer'
      );

      // Record referrer's RCN source
      await this.referralRepository.recordRcnSource({
        customerAddress: referral.referrerAddress,
        sourceType: 'referral_bonus',
        amount: 25,
        transactionId,
        isRedeemable: true,
        metadata: {
          refereeAddress,
          referralCode
        }
      });

      // Mint 10 RCN to referee
      await this.tokenService.mintTokens(
        refereeAddress,
        10,
        'Welcome bonus for joining via referral'
      );

      // Record referee's RCN source
      await this.referralRepository.recordRcnSource({
        customerAddress: refereeAddress,
        sourceType: 'referral_bonus',
        amount: 10,
        transactionId,
        isRedeemable: true,
        metadata: {
          referrerAddress: referral.referrerAddress,
          referralCode
        }
      });

      // Complete the referral
      await this.referralRepository.completeReferral(
        referralCode,
        refereeAddress,
        transactionId
      );

      // Update referrer's referral count
      const referrer = await this.customerRepository.getCustomer(referral.referrerAddress);
      if (referrer) {
        await this.customerRepository.updateCustomer(referral.referrerAddress, {
          referralCount: (referrer.referralCount || 0) + 1
        });
      }

      // Emit event
      await eventBus.publish({
        type: 'referral.completed',
        aggregateId: referralCode,
        data: {
          referralCode,
          referrerAddress: referral.referrerAddress,
          refereeAddress,
          transactionId,
          rewards: {
            referrer: 25,
            referee: 10
          }
        },
        timestamp: new Date(),
        source: 'ReferralService',
        version: 1
      });

      logger.info('Referral processed successfully', {
        referralCode,
        referrerAddress: referral.referrerAddress,
        refereeAddress
      });

      return { 
        success: true, 
        message: 'Referral processed successfully' 
      };
    } catch (error) {
      logger.error('Error processing referral:', error);
      throw error;
    }
  }

  async getReferralStats(customerAddress?: string): Promise<any> {
    try {
      if (customerAddress) {
        // Get individual customer stats
        const referrals = await this.referralRepository.getCustomerReferrals(customerAddress);
        const successful = referrals.filter(r => r.status === 'completed');
        
        return {
          totalReferrals: referrals.length,
          successfulReferrals: successful.length,
          pendingReferrals: referrals.filter(r => r.status === 'pending').length,
          totalEarned: successful.length * 25,
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
        earnedBalance: breakdown.earned,
        marketBalance: breakdown.marketBought,
        redeemableBalance: breakdown.earned, // Only earned RCN can be redeemed
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