import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import RepairCoinApp from '../../src/app';
import { ShopRepository } from '../../src/repositories/ShopRepository';
import { CustomerRepository } from '../../src/repositories/CustomerRepository';
import { TransactionRepository } from '../../src/repositories/TransactionRepository';
import { TokenService } from '../../src/domains/token/services/TokenService';
import { VerificationService } from '../../src/domains/token/services/VerificationService';

jest.mock('../../src/repositories/ShopRepository');
jest.mock('../../src/repositories/CustomerRepository');
jest.mock('../../src/repositories/TransactionRepository');
jest.mock('../../src/domains/token/services/TokenService');
jest.mock('../../src/domains/token/services/VerificationService');
jest.mock('thirdweb');

describe('Shop Operations Tests', () => {
  let app: any;
  let shopToken: string;
  const shopId = 'test-auto-repair';
  const shopWalletAddress = '0x1234567890123456789012345678901234567890';
  
  const mockShop = {
    id: shopId,
    wallet_address: shopWalletAddress,
    company_name: 'Test Auto Repair',
    is_verified: true,
    is_active: true,
    purchased_rcn_balance: 5000,
    distributed_rcn: 1000
  };

  const mockCustomer = {
    address: '0x2345678901234567890123456789012345678901',
    email: 'customer@example.com',
    lifetimeEarnings: 250,
    tier: 'SILVER',
    dailyEarnings: 20,
    monthlyEarnings: 200,
    lastEarnedDate: new Date().toISOString(),
    isActive: true,
    referralCount: 2
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.NODE_ENV = 'test';
    
    const repairCoinApp = new RepairCoinApp();
    await repairCoinApp.initialize();
    app = repairCoinApp.app;

    // Mock shop authentication
    jest.spyOn(ShopRepository.prototype, 'getShopByWalletAddress')
      .mockResolvedValue(mockShop as any);

    // Get shop token
    const authResponse = await request(app)
      .post('/api/auth/shop')
      .send({ shopId, walletAddress: shopWalletAddress });
    shopToken = authResponse.body.token;
  });

  describe('POST /api/shops/:shopId/issue-reward', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      jest.spyOn(ShopRepository.prototype, 'getShopById')
        .mockResolvedValue(mockShop as any);
    });

    it('should issue reward for small repair ($50-$99)', async () => {
      jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
        .mockResolvedValue(mockCustomer as any);
      
      jest.spyOn(CustomerRepository.prototype, 'updateCustomerEarnings')
        .mockResolvedValue({
          ...mockCustomer,
          lifetimeEarnings: 280, // 250 + 10 base + 20 tier bonus
          dailyEarnings: 50,
          monthlyEarnings: 230
        } as any);

      jest.spyOn(TokenService.prototype, 'mintTokens')
        .mockResolvedValue({
          success: true,
          transactionHash: '0xabc123'
        } as any);

      jest.spyOn(TransactionRepository.prototype, 'createTransaction')
        .mockResolvedValue({
          id: 1,
          transaction_type: 'repair_reward'
        } as any);

      const response = await request(app)
        .post(`/api/shops/${shopId}/issue-reward`)
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          customerAddress: mockCustomer.address,
          repairAmount: 75,
          serviceType: 'oil_change',
          description: 'Regular oil change'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        baseReward: 10,
        tierBonus: 20, // Silver tier bonus
        totalReward: 30,
        customerTier: 'SILVER',
        transactionHash: '0xabc123'
      });
    });

    it('should issue reward for large repair ($100+)', async () => {
      jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
        .mockResolvedValue({
          ...mockCustomer,
          tier: 'GOLD',
          lifetimeEarnings: 1500
        } as any);
      
      jest.spyOn(CustomerRepository.prototype, 'updateCustomerEarnings')
        .mockResolvedValue({
          ...mockCustomer,
          lifetimeEarnings: 1555, // 1500 + 25 base + 30 tier bonus
          tier: 'GOLD'
        } as any);

      jest.spyOn(TokenService.prototype, 'mintTokens')
        .mockResolvedValue({
          success: true,
          transactionHash: '0xdef456'
        } as any);

      const response = await request(app)
        .post(`/api/shops/${shopId}/issue-reward`)
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          customerAddress: mockCustomer.address,
          repairAmount: 250,
          serviceType: 'major_repair',
          description: 'Engine repair'
        });

      expect(response.body.data).toMatchObject({
        baseReward: 15,
        tierBonus: 30, // Gold tier bonus
        totalReward: 45,
        customerTier: 'GOLD'
      });
    });

    it('should reject repair amount below minimum', async () => {
      const response = await request(app)
        .post(`/api/shops/${shopId}/issue-reward`)
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          customerAddress: mockCustomer.address,
          repairAmount: 25, // Below $50 minimum
          serviceType: 'minor_repair'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Minimum repair amount');
    });

    it('should enforce daily earning limit', async () => {
      jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
        .mockResolvedValue({
          ...mockCustomer,
          dailyEarnings: 45 // Already earned 45 RCN today
        } as any);

      const response = await request(app)
        .post(`/api/shops/${shopId}/issue-reward`)
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          customerAddress: mockCustomer.address,
          repairAmount: 100,
          serviceType: 'repair'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('daily earning limit');
      expect(response.body.details).toMatchObject({
        dailyLimit: 50,
        alreadyEarned: 45,
        remaining: 5
      });
    });

    it('should enforce monthly earning limit', async () => {
      jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
        .mockResolvedValue({
          ...mockCustomer,
          monthlyEarnings: 480,
          dailyEarnings: 10
        } as any);

      const response = await request(app)
        .post(`/api/shops/${shopId}/issue-reward`)
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          customerAddress: mockCustomer.address,
          repairAmount: 100,
          serviceType: 'repair'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('monthly earning limit');
    });

    it('should reject inactive customers', async () => {
      jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
        .mockResolvedValue({
          ...mockCustomer,
          isActive: false,
          suspendedAt: new Date().toISOString(),
          suspensionReason: 'Terms violation'
        } as any);

      const response = await request(app)
        .post(`/api/shops/${shopId}/issue-reward`)
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          customerAddress: mockCustomer.address,
          repairAmount: 100,
          serviceType: 'repair'
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('suspended');
    });

    it('should process first repair referral bonus', async () => {
      const referrer = {
        address: '0x3456789012345678901234567890123456789012',
        referralCode: 'REF123'
      };

      jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
        .mockResolvedValue({
          ...mockCustomer,
          referredBy: referrer.referralCode,
          lifetimeEarnings: 0 // First repair
        } as any);

      jest.spyOn(CustomerRepository.prototype, 'getCustomerByReferralCode')
        .mockResolvedValue(referrer as any);

      jest.spyOn(CustomerRepository.prototype, 'updateCustomerEarnings')
        .mockResolvedValue(mockCustomer as any);

      const response = await request(app)
        .post(`/api/shops/${shopId}/issue-reward`)
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          customerAddress: mockCustomer.address,
          repairAmount: 75,
          serviceType: 'oil_change'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.referralBonusApplied).toBe(true);
      expect(response.body.data.referralDetails).toMatchObject({
        referrerReward: 25,
        refereeBonus: 10
      });
    });
  });

  describe('POST /api/shops/:shopId/redeem', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      jest.spyOn(ShopRepository.prototype, 'getShopById')
        .mockResolvedValue(mockShop as any);
    });

    it('should process redemption at home shop', async () => {
      jest.spyOn(VerificationService.prototype, 'verifyRedemption')
        .mockResolvedValue({
          canRedeem: true,
          earnedBalance: 100,
          isHomeShop: true,
          maxRedeemable: 100
        } as any);

      jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
        .mockResolvedValue(mockCustomer as any);

      jest.spyOn(TokenService.prototype, 'redeemTokens')
        .mockResolvedValue({
          success: true,
          transactionHash: '0xabc123'
        } as any);

      jest.spyOn(TransactionRepository.prototype, 'createTransaction')
        .mockResolvedValue({
          id: 1,
          transaction_type: 'shop_redemption'
        } as any);

      const response = await request(app)
        .post(`/api/shops/${shopId}/redeem`)
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          customerAddress: mockCustomer.address,
          amount: 50,
          serviceDescription: 'Brake repair service'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        amount: 50,
        valueInUsd: 50,
        isHomeShop: true,
        transactionHash: '0xabc123'
      });
    });

    it('should enforce 20% limit for cross-shop redemption', async () => {
      jest.spyOn(VerificationService.prototype, 'verifyRedemption')
        .mockResolvedValue({
          canRedeem: false,
          earnedBalance: 100,
          isHomeShop: false,
          maxRedeemable: 20,
          reason: 'Cross-shop limit exceeded'
        } as any);

      const response = await request(app)
        .post(`/api/shops/${shopId}/redeem`)
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          customerAddress: mockCustomer.address,
          amount: 50, // Trying to redeem 50% at non-home shop
          serviceDescription: 'Oil change'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Cross-shop limit');
      expect(response.body.details).toMatchObject({
        requestedAmount: 50,
        maxAllowed: 20,
        earnedBalance: 100
      });
    });

    it('should reject redemption of market-bought tokens', async () => {
      jest.spyOn(VerificationService.prototype, 'verifyRedemption')
        .mockResolvedValue({
          canRedeem: false,
          earnedBalance: 50,
          totalBalance: 200, // Has 150 market-bought tokens
          reason: 'Insufficient earned balance'
        } as any);

      const response = await request(app)
        .post(`/api/shops/${shopId}/redeem`)
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          customerAddress: mockCustomer.address,
          amount: 100,
          serviceDescription: 'Major repair'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('earned balance');
      expect(response.body.message).toContain('market-purchased');
    });

    it('should check shop has sufficient RCN balance', async () => {
      jest.spyOn(ShopRepository.prototype, 'getShopById')
        .mockResolvedValue({
          ...mockShop,
          purchased_rcn_balance: 10 // Only 10 RCN left
        } as any);

      jest.spyOn(VerificationService.prototype, 'verifyRedemption')
        .mockResolvedValue({
          canRedeem: true,
          earnedBalance: 100,
          isHomeShop: true
        } as any);

      const response = await request(app)
        .post(`/api/shops/${shopId}/redeem`)
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          customerAddress: mockCustomer.address,
          amount: 50,
          serviceDescription: 'Repair'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Insufficient shop RCN balance');
      expect(response.body.details).toMatchObject({
        shopBalance: 10,
        required: 50
      });
    });
  });

  describe('GET /api/shops/:shopId/customers', () => {
    it('should list shop customers with pagination', async () => {
      const mockCustomers = [
        { ...mockCustomer, lifetimeEarnings: 500, tier: 'GOLD' },
        { ...mockCustomer, address: '0x3456789012345678901234567890123456789012', lifetimeEarnings: 200 }
      ];

      jest.spyOn(ShopRepository.prototype, 'getShopCustomers')
        .mockResolvedValue({
          customers: mockCustomers,
          total: 25,
          page: 1,
          limit: 10
        } as any);

      const response = await request(app)
        .get(`/api/shops/${shopId}/customers?page=1&limit=10`)
        .set('Authorization', `Bearer ${shopToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.customers).toHaveLength(2);
      expect(response.body.data.pagination).toMatchObject({
        total: 25,
        page: 1,
        limit: 10,
        totalPages: 3
      });
    });

    it('should filter customers by tier', async () => {
      jest.spyOn(ShopRepository.prototype, 'getShopCustomers')
        .mockResolvedValue({
          customers: [],
          total: 0
        } as any);

      const response = await request(app)
        .get(`/api/shops/${shopId}/customers?tier=GOLD`)
        .set('Authorization', `Bearer ${shopToken}`);

      expect(response.status).toBe(200);
      expect(ShopRepository.prototype.getShopCustomers)
        .toHaveBeenCalledWith(shopId, expect.objectContaining({ tier: 'GOLD' }));
    });
  });

  describe('GET /api/shops/:shopId/analytics', () => {
    it('should return comprehensive shop analytics', async () => {
      const mockAnalytics = {
        totalCustomers: 150,
        activeCustomers: 120,
        totalRcnIssued: 15000,
        totalRcnRedeemed: 8000,
        averageTransactionValue: 125,
        topServiceTypes: [
          { type: 'oil_change', count: 45 },
          { type: 'tire_rotation', count: 38 }
        ],
        customersByTier: {
          BRONZE: 80,
          SILVER: 50,
          GOLD: 20
        },
        monthlyTrends: [
          { month: '2025-01', issued: 2000, redeemed: 1200 },
          { month: '2025-02', issued: 2500, redeemed: 1500 }
        ]
      };

      jest.spyOn(ShopRepository.prototype, 'getShopAnalytics')
        .mockResolvedValue(mockAnalytics as any);

      const response = await request(app)
        .get(`/api/shops/${shopId}/analytics`)
        .set('Authorization', `Bearer ${shopToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject(mockAnalytics);
    });
  });

  describe('Redemption Session Management', () => {
    it('should create and manage redemption session', async () => {
      // Step 1: Create session
      const sessionResponse = await request(app)
        .post(`/api/shops/${shopId}/redemption-session`)
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          customerAddress: mockCustomer.address,
          amount: 50
        });

      expect(sessionResponse.status).toBe(200);
      const { sessionId } = sessionResponse.body.data;
      expect(sessionId).toBeDefined();

      // Step 2: Customer should be able to view session
      jest.spyOn(ShopRepository.prototype, 'getRedemptionSession')
        .mockResolvedValue({
          id: sessionId,
          status: 'pending',
          amount: 50,
          shopId,
          customerAddress: mockCustomer.address
        } as any);

      // Step 3: Customer approves
      jest.spyOn(ShopRepository.prototype, 'updateRedemptionSession')
        .mockResolvedValue({
          id: sessionId,
          status: 'approved'
        } as any);

      const approveResponse = await request(app)
        .post(`/api/customers/${mockCustomer.address}/approve-redemption`)
        .send({
          sessionId,
          approved: true
        });

      expect(approveResponse.status).toBe(200);
      expect(approveResponse.body.message).toContain('approved');
    });
  });
});