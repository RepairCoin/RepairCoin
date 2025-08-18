import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import RepairCoinApp from '../../src/app';
import { CustomerRepository } from '../../src/repositories/CustomerRepository';
import { TransactionRepository } from '../../src/repositories/TransactionRepository';
import { ReferralRepository } from '../../src/repositories/ReferralRepository';
import { TokenService } from '../../src/domains/token/services/TokenService';
import { VerificationService } from '../../src/domains/token/services/VerificationService';

jest.mock('../../src/repositories/CustomerRepository');
jest.mock('../../src/repositories/TransactionRepository');
jest.mock('../../src/repositories/ReferralRepository');
jest.mock('../../src/domains/token/services/TokenService');
jest.mock('../../src/domains/token/services/VerificationService');
jest.mock('thirdweb');

describe('Customer Earnings and Redemption Tests', () => {
  let app: any;
  let customerToken: string;
  const customerAddress = '0x1234567890123456789012345678901234567890';
  
  const mockCustomer = {
    address: customerAddress,
    email: 'customer@example.com',
    lifetimeEarnings: 250,
    tier: 'SILVER',
    dailyEarnings: 20,
    monthlyEarnings: 200,
    lastEarnedDate: new Date().toISOString(),
    isActive: true,
    referralCount: 2,
    referralCode: 'CUST123'
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.NODE_ENV = 'test';
    
    const repairCoinApp = new RepairCoinApp();
    await repairCoinApp.initialize();
    app = repairCoinApp.app;

    // Mock customer authentication
    jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
      .mockResolvedValue(mockCustomer as any);

    // Get customer token
    const authResponse = await request(app)
      .post('/api/auth/customer')
      .send({ walletAddress: customerAddress });
    customerToken = authResponse.body.token;
  });

  describe('GET /api/customers/:address/transactions', () => {
    it('should retrieve customer transaction history', async () => {
      const mockTransactions = [
        {
          id: 1,
          transaction_type: 'repair_reward',
          amount: 30,
          shop_id: 'test-shop',
          description: 'Oil change reward',
          transaction_date: new Date('2025-02-01'),
          blockchain_hash: '0xabc123'
        },
        {
          id: 2,
          transaction_type: 'referral_reward',
          amount: 25,
          description: 'Referral bonus',
          transaction_date: new Date('2025-02-02'),
          blockchain_hash: '0xdef456'
        },
        {
          id: 3,
          transaction_type: 'shop_redemption',
          amount: -50,
          shop_id: 'test-shop',
          description: 'Brake repair redemption',
          transaction_date: new Date('2025-02-03'),
          blockchain_hash: '0xghi789'
        }
      ];

      jest.spyOn(TransactionRepository.prototype, 'getCustomerTransactions')
        .mockResolvedValue({
          transactions: mockTransactions,
          total: 25,
          page: 1,
          limit: 10
        } as any);

      const response = await request(app)
        .get(`/api/customers/${customerAddress}/transactions?limit=10`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.transactions).toHaveLength(3);
      expect(response.body.data.summary).toMatchObject({
        totalEarned: 55,
        totalRedeemed: 50,
        netBalance: 5
      });
    });

    it('should filter transactions by type', async () => {
      jest.spyOn(TransactionRepository.prototype, 'getCustomerTransactions')
        .mockResolvedValue({
          transactions: [],
          total: 0
        } as any);

      const response = await request(app)
        .get(`/api/customers/${customerAddress}/transactions?type=repair_reward`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(200);
      expect(TransactionRepository.prototype.getCustomerTransactions)
        .toHaveBeenCalledWith(customerAddress, expect.objectContaining({ 
          type: 'repair_reward' 
        }));
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get(`/api/customers/${customerAddress}/transactions`);

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Authentication required');
    });
  });

  describe('GET /api/tokens/earned-balance/:address', () => {
    it('should return earned vs market-bought balance breakdown', async () => {
      const mockEarnedBalance = {
        earnedBalance: 300,
        totalBalance: 500, // 200 market-bought
        breakdown: {
          repairs: 250,
          referrals: 50,
          bonuses: 0
        },
        homeShop: 'test-shop',
        crossShopLimit: 60 // 20% of 300
      };

      jest.spyOn(VerificationService.prototype, 'getEarnedBalance')
        .mockResolvedValue(mockEarnedBalance as any);

      const response = await request(app)
        .get(`/api/tokens/earned-balance/${customerAddress}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        earnedBalance: 300,
        totalBalance: 500,
        marketBoughtBalance: 200,
        redeemableBalance: 300,
        breakdown: {
          repairs: 250,
          referrals: 50,
          bonuses: 0
        }
      });
    });
  });

  describe('Tier Progression', () => {
    it('should show correct tier progression for Bronze customer', async () => {
      jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
        .mockResolvedValue({
          ...mockCustomer,
          lifetimeEarnings: 150,
          tier: 'BRONZE'
        } as any);

      const response = await request(app)
        .get(`/api/customers/${customerAddress}`);

      expect(response.status).toBe(200);
      expect(response.body.data.tierProgression).toMatchObject({
        currentTier: 'BRONZE',
        nextTier: 'SILVER',
        tokensToNextTier: 50, // 200 - 150
        progressPercentage: 75 // 150/200 * 100
      });
    });

    it('should show correct tier progression for Gold customer', async () => {
      jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
        .mockResolvedValue({
          ...mockCustomer,
          lifetimeEarnings: 1500,
          tier: 'GOLD'
        } as any);

      const response = await request(app)
        .get(`/api/customers/${customerAddress}`);

      expect(response.body.data.tierProgression).toMatchObject({
        currentTier: 'GOLD',
        progressPercentage: 100
        // No nextTier since Gold is highest
      });
    });
  });

  describe('Daily and Monthly Limits', () => {
    it('should show correct earning capacity', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
        .mockResolvedValue({
          ...mockCustomer,
          dailyEarnings: 45,
          monthlyEarnings: 300,
          lastEarnedDate: today
        } as any);

      const response = await request(app)
        .get(`/api/customers/${customerAddress}`);

      expect(response.body.data.earningCapacity).toMatchObject({
        dailyRemaining: 5, // 50 - 45
        monthlyRemaining: 200, // 500 - 300
        canEarnToday: true,
        canEarnThisMonth: true
      });
    });

    it('should reset daily earnings on new day', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
        .mockResolvedValue({
          ...mockCustomer,
          dailyEarnings: 50,
          lastEarnedDate: yesterday.toISOString()
        } as any);

      const response = await request(app)
        .get(`/api/customers/${customerAddress}`);

      expect(response.body.data.earningCapacity.dailyRemaining).toBe(50);
      expect(response.body.data.earningCapacity.canEarnToday).toBe(true);
    });

    it('should reset monthly earnings on new month', async () => {
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      
      jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
        .mockResolvedValue({
          ...mockCustomer,
          monthlyEarnings: 500,
          lastEarnedDate: lastMonth.toISOString()
        } as any);

      const response = await request(app)
        .get(`/api/customers/${customerAddress}`);

      expect(response.body.data.earningCapacity.monthlyRemaining).toBe(500);
      expect(response.body.data.earningCapacity.canEarnThisMonth).toBe(true);
    });
  });

  describe('Referral System', () => {
    it('should generate unique referral code for new customers', async () => {
      jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
        .mockResolvedValue({
          ...mockCustomer,
          referralCode: 'CUST123'
        } as any);

      const response = await request(app)
        .get(`/api/customers/${customerAddress}`);

      expect(response.body.data.customer.referralCode).toBe('CUST123');
    });

    it('should track successful referrals', async () => {
      const mockReferrals = [
        {
          referee_address: '0x2345678901234567890123456789012345678901',
          status: 'completed',
          referrer_reward: 25,
          referee_bonus: 10,
          completed_date: new Date('2025-01-15')
        },
        {
          referee_address: '0x3456789012345678901234567890123456789012',
          status: 'pending',
          referrer_reward: 25,
          referee_bonus: 10
        }
      ];

      jest.spyOn(ReferralRepository.prototype, 'getReferralsByReferrer')
        .mockResolvedValue(mockReferrals as any);

      const response = await request(app)
        .get(`/api/referrals/by-referrer/${customerAddress}`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.referrals).toHaveLength(2);
      expect(response.body.data.summary).toMatchObject({
        totalReferrals: 2,
        completedReferrals: 1,
        pendingReferrals: 1,
        totalEarned: 25
      });
    });
  });

  describe('Cross-Shop Redemption', () => {
    it('should check redemption eligibility at different shops', async () => {
      jest.spyOn(VerificationService.prototype, 'verifyRedemption')
        .mockResolvedValueOnce({
          canRedeem: true,
          earnedBalance: 100,
          isHomeShop: true,
          maxRedeemable: 100
        } as any)
        .mockResolvedValueOnce({
          canRedeem: true,
          earnedBalance: 100,
          isHomeShop: false,
          maxRedeemable: 20 // 20% limit
        } as any);

      // Check at home shop
      const homeShopResponse = await request(app)
        .get(`/api/customers/${customerAddress}/redemption-check?shopId=home-shop&amount=50`);

      expect(homeShopResponse.status).toBe(200);
      expect(homeShopResponse.body.data).toMatchObject({
        canRedeem: true,
        isHomeShop: true,
        maxRedeemable: 100
      });

      // Check at different shop
      const otherShopResponse = await request(app)
        .get(`/api/customers/${customerAddress}/redemption-check?shopId=other-shop&amount=50`);

      expect(otherShopResponse.status).toBe(200);
      expect(otherShopResponse.body.data).toMatchObject({
        canRedeem: false, // 50 > 20 limit
        isHomeShop: false,
        maxRedeemable: 20,
        reason: 'Amount exceeds cross-shop limit'
      });
    });
  });

  describe('Redemption Session Approval', () => {
    it('should allow customer to approve redemption session', async () => {
      const mockSession = {
        id: 'session-123',
        shop_id: 'test-shop',
        customer_address: customerAddress,
        amount: 50,
        status: 'pending',
        created_at: new Date()
      };

      jest.spyOn(TransactionRepository.prototype, 'getRedemptionSession')
        .mockResolvedValue(mockSession as any);

      jest.spyOn(TransactionRepository.prototype, 'updateRedemptionSession')
        .mockResolvedValue({
          ...mockSession,
          status: 'approved'
        } as any);

      const response = await request(app)
        .post(`/api/customers/${customerAddress}/approve-redemption`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          sessionId: 'session-123',
          approved: true
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('approved');
    });

    it('should allow customer to reject redemption session', async () => {
      const mockSession = {
        id: 'session-123',
        customer_address: customerAddress,
        status: 'pending'
      };

      jest.spyOn(TransactionRepository.prototype, 'getRedemptionSession')
        .mockResolvedValue(mockSession as any);

      jest.spyOn(TransactionRepository.prototype, 'updateRedemptionSession')
        .mockResolvedValue({
          ...mockSession,
          status: 'rejected'
        } as any);

      const response = await request(app)
        .post(`/api/customers/${customerAddress}/approve-redemption`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          sessionId: 'session-123',
          approved: false
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('rejected');
    });

    it('should prevent approval of another customer\'s session', async () => {
      const mockSession = {
        id: 'session-123',
        customer_address: '0x9999999999999999999999999999999999999999',
        status: 'pending'
      };

      jest.spyOn(TransactionRepository.prototype, 'getRedemptionSession')
        .mockResolvedValue(mockSession as any);

      const response = await request(app)
        .post(`/api/customers/${customerAddress}/approve-redemption`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          sessionId: 'session-123',
          approved: true
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('not authorized');
    });
  });

  describe('Customer Analytics', () => {
    it('should provide comprehensive customer analytics', async () => {
      const mockAnalytics = {
        earningTrends: [
          { month: '2025-01', earned: 150, redeemed: 50 },
          { month: '2025-02', earned: 100, redeemed: 100 }
        ],
        shopInteractions: [
          { shopId: 'shop-1', transactions: 10, totalEarned: 200 },
          { shopId: 'shop-2', transactions: 5, totalEarned: 50 }
        ],
        referralPerformance: {
          totalReferrals: 5,
          successfulReferrals: 3,
          totalEarned: 75
        }
      };

      jest.spyOn(CustomerRepository.prototype, 'getCustomerAnalytics')
        .mockResolvedValue(mockAnalytics as any);

      const response = await request(app)
        .get(`/api/customers/${customerAddress}/analytics`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject(mockAnalytics);
    });
  });
});