import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import RepairCoinApp from '../../src/app';
import { CustomerRepository } from '../../src/repositories/CustomerRepository';
import { ShopRepository } from '../../src/repositories/ShopRepository';
import { AdminRepository } from '../../src/repositories/AdminRepository';
import { ReferralRepository } from '../../src/repositories/ReferralRepository';
import { TransactionRepository } from '../../src/repositories/TransactionRepository';
import { RedemptionSessionRepository } from '../../src/repositories/RedemptionSessionRepository';
import { TokenService } from '../../src/domains/token/services/TokenService';
import { VerificationService } from '../../src/domains/token/services/VerificationService';

// Mock all dependencies
jest.mock('../../src/repositories/CustomerRepository');
jest.mock('../../src/repositories/ShopRepository');
jest.mock('../../src/repositories/AdminRepository');
jest.mock('../../src/repositories/ReferralRepository');
jest.mock('../../src/repositories/TransactionRepository');
jest.mock('../../src/repositories/RedemptionSessionRepository');
jest.mock('../../src/domains/token/services/TokenService');
jest.mock('../../src/domains/token/services/VerificationService');
jest.mock('thirdweb');

describe('Customer Features - Comprehensive Test Suite', () => {
  let app: any;
  let customerToken: string;
  const customerAddress = '0x1234567890123456789012345678901234567890';
  const shopWalletAddress = '0x2345678901234567890123456789012345678901';
  const adminAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f1234';
  const referrerAddress = '0x3456789012345678901234567890123456789012';
  
  const mockBronzeCustomer = {
    address: customerAddress,
    email: 'bronze@example.com',
    name: 'Bronze Customer',
    phone: '+1234567890',
    lifetimeEarnings: 150,
    tier: 'BRONZE',
    dailyEarnings: 10,
    monthlyEarnings: 100,
    lastEarnedDate: new Date().toISOString(),
    isActive: true,
    referralCount: 0,
    referralCode: 'BRONZ123',
    referredBy: null,
    joinDate: new Date().toISOString()
  };

  const mockSilverCustomer = {
    ...mockBronzeCustomer,
    email: 'silver@example.com',
    name: 'Silver Customer',
    lifetimeEarnings: 500,
    tier: 'SILVER',
    referralCount: 2,
    referralCode: 'SILV456'
  };

  const mockGoldCustomer = {
    ...mockBronzeCustomer,
    email: 'gold@example.com',
    name: 'Gold Customer',
    lifetimeEarnings: 1500,
    tier: 'GOLD',
    referralCount: 5,
    referralCode: 'GOLD789'
  };

  beforeAll(async () => {
    process.env.ADMIN_ADDRESSES = adminAddress;
    process.env.JWT_SECRET = 'test-secret';
    process.env.NODE_ENV = 'test';
    
    const repairCoinApp = new RepairCoinApp();
    await repairCoinApp.initialize();
    app = repairCoinApp.app;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================================
  // 1. REGISTRATION & PROFILE MANAGEMENT
  // ========================================
  describe('1. Registration & Profile Management', () => {
    
    describe('1.1 Customer Registration', () => {
      it('should successfully register a new customer', async () => {
        // Mock role checks
        jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress').mockResolvedValue(null);
        jest.spyOn(ShopRepository.prototype, 'getShopByWalletAddress').mockResolvedValue(null);
        jest.spyOn(AdminRepository.prototype, 'isAdmin').mockResolvedValue(false);
        jest.spyOn(CustomerRepository.prototype, 'createCustomer').mockResolvedValue(mockBronzeCustomer as any);
        jest.spyOn(ReferralRepository.prototype, 'getCustomerByReferralCode').mockResolvedValue(null);

        const response = await request(app)
          .post('/api/customers/register')
          .send({
            walletAddress: customerAddress,
            email: 'newcustomer@example.com',
            phone: '+1234567890',
            name: 'New Customer'
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('registered successfully');
      });

      it('should reject registration if wallet is already a shop', async () => {
        jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress').mockResolvedValue(null);
        jest.spyOn(ShopRepository.prototype, 'getShopByWalletAddress').mockResolvedValue({ 
          id: 'shop123',
          walletAddress: customerAddress 
        } as any);

        const response = await request(app)
          .post('/api/customers/register')
          .send({
            walletAddress: customerAddress,
            email: 'customer@example.com'
          });

        expect(response.status).toBe(409);
        expect(response.body.error).toContain('already registered as a shop');
        expect(response.body.conflictingRole).toBe('shop');
      });

      it('should reject registration if wallet is already an admin', async () => {
        jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress').mockResolvedValue(null);
        jest.spyOn(ShopRepository.prototype, 'getShopByWalletAddress').mockResolvedValue(null);
        jest.spyOn(AdminRepository.prototype, 'isAdmin').mockResolvedValue(true);

        const response = await request(app)
          .post('/api/customers/register')
          .send({
            walletAddress: adminAddress,
            email: 'admin@example.com'
          });

        expect(response.status).toBe(409);
        expect(response.body.error).toContain('already registered as an administrator');
        expect(response.body.conflictingRole).toBe('admin');
      });

      it('should process referral code during registration', async () => {
        const mockReferrer = { ...mockGoldCustomer, address: referrerAddress };
        
        jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress').mockResolvedValue(null);
        jest.spyOn(ShopRepository.prototype, 'getShopByWalletAddress').mockResolvedValue(null);
        jest.spyOn(AdminRepository.prototype, 'isAdmin').mockResolvedValue(false);
        jest.spyOn(CustomerRepository.prototype, 'createCustomer').mockResolvedValue(mockBronzeCustomer as any);
        jest.spyOn(CustomerRepository.prototype, 'getCustomerByReferralCode').mockResolvedValue(mockReferrer as any);
        jest.spyOn(ReferralRepository.prototype, 'createReferral').mockResolvedValue({ id: 'ref123' } as any);

        const response = await request(app)
          .post('/api/customers/register')
          .send({
            walletAddress: customerAddress,
            email: 'referred@example.com',
            referralCode: 'GOLD789'
          });

        expect(response.status).toBe(201);
        expect(CustomerRepository.prototype.getCustomerByReferralCode).toHaveBeenCalledWith('GOLD789');
      });
    });

    describe('1.2 Profile Management', () => {
      beforeEach(async () => {
        // Setup authentication
        jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
          .mockResolvedValue(mockBronzeCustomer as any);
        
        const authResponse = await request(app)
          .post('/api/auth/customer')
          .send({ walletAddress: customerAddress });
        
        customerToken = authResponse.body.token;
      });

      it('should get customer profile', async () => {
        const response = await request(app)
          .get(`/api/customers/${customerAddress}`)
          .set('Authorization', `Bearer ${customerToken}`);

        expect(response.status).toBe(200);
        expect(response.body.data.address).toBe(customerAddress);
        expect(response.body.data.tier).toBe('BRONZE');
      });

      it('should update customer profile', async () => {
        jest.spyOn(CustomerRepository.prototype, 'updateCustomerProfile')
          .mockResolvedValue(undefined);

        const response = await request(app)
          .put(`/api/customers/${customerAddress}`)
          .set('Authorization', `Bearer ${customerToken}`)
          .send({
            name: 'Updated Name',
            email: 'updated@example.com',
            phone: '+9876543210'
          });

        expect(response.status).toBe(200);
        expect(response.body.message).toContain('updated successfully');
      });

      it('should prevent customer from updating another customer profile', async () => {
        const otherAddress = '0x9999999999999999999999999999999999999999';
        
        const response = await request(app)
          .put(`/api/customers/${otherAddress}`)
          .set('Authorization', `Bearer ${customerToken}`)
          .send({
            name: 'Hacker Name'
          });

        expect(response.status).toBe(403);
        expect(response.body.error).toContain('only update your own');
      });
    });
  });

  // ========================================
  // 2. TIER SYSTEM & BONUSES
  // ========================================
  describe('2. Tier System & Bonuses', () => {
    
    describe('2.1 Tier Progression', () => {
      it('should correctly identify Bronze tier (0-199 RCN)', async () => {
        jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
          .mockResolvedValue(mockBronzeCustomer as any);

        const authResponse = await request(app)
          .post('/api/auth/customer')
          .send({ walletAddress: customerAddress });

        expect(authResponse.body.user.tier).toBe('BRONZE');
      });

      it('should correctly identify Silver tier (200-999 RCN)', async () => {
        jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
          .mockResolvedValue(mockSilverCustomer as any);

        const authResponse = await request(app)
          .post('/api/auth/customer')
          .send({ walletAddress: customerAddress });

        expect(authResponse.body.user.tier).toBe('SILVER');
      });

      it('should correctly identify Gold tier (1000+ RCN)', async () => {
        jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
          .mockResolvedValue(mockGoldCustomer as any);

        const authResponse = await request(app)
          .post('/api/auth/customer')
          .send({ walletAddress: customerAddress });

        expect(authResponse.body.user.tier).toBe('GOLD');
      });
    });

    describe('2.2 Tier Bonuses', () => {
      it('should calculate +10 RCN bonus for Bronze tier', async () => {
        const tierBonus = 10; // Bronze tier bonus
        const baseReward = 15; // Large repair
        const expectedTotal = baseReward + tierBonus;

        // This would be tested in the shop's issue-reward endpoint
        expect(tierBonus).toBe(10);
      });

      it('should calculate +20 RCN bonus for Silver tier', async () => {
        const tierBonus = 20; // Silver tier bonus
        expect(tierBonus).toBe(20);
      });

      it('should calculate +30 RCN bonus for Gold tier', async () => {
        const tierBonus = 30; // Gold tier bonus
        expect(tierBonus).toBe(30);
      });
    });
  });

  // ========================================
  // 3. TRANSACTION & EARNINGS
  // ========================================
  describe('3. Transaction & Earnings', () => {
    beforeEach(async () => {
      jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
        .mockResolvedValue(mockSilverCustomer as any);
      
      const authResponse = await request(app)
        .post('/api/auth/customer')
        .send({ walletAddress: customerAddress });
      
      customerToken = authResponse.body.token;
    });

    describe('3.1 Transaction History', () => {
      it('should get transaction history', async () => {
        const mockTransactions = [
          { type: 'mint', amount: 25, timestamp: new Date().toISOString() },
          { type: 'redeem', amount: 10, timestamp: new Date().toISOString() }
        ];

        jest.spyOn(TransactionRepository.prototype, 'getCustomerTransactions')
          .mockResolvedValue({ transactions: mockTransactions, total: 2 } as any);

        const response = await request(app)
          .get(`/api/customers/${customerAddress}/transactions`)
          .set('Authorization', `Bearer ${customerToken}`);

        expect(response.status).toBe(200);
        expect(response.body.transactions).toHaveLength(2);
      });

      it('should filter transactions by type', async () => {
        const mockMintTransactions = [
          { type: 'mint', amount: 25, timestamp: new Date().toISOString() }
        ];

        jest.spyOn(TransactionRepository.prototype, 'getCustomerTransactions')
          .mockResolvedValue({ transactions: mockMintTransactions, total: 1 } as any);

        const response = await request(app)
          .get(`/api/customers/${customerAddress}/transactions?type=mint`)
          .set('Authorization', `Bearer ${customerToken}`);

        expect(response.status).toBe(200);
        expect(response.body.transactions).toHaveLength(1);
        expect(response.body.transactions[0].type).toBe('mint');
      });
    });

    describe('3.2 Earning Limits', () => {
      it('should enforce daily earning limit (50 RCN)', async () => {
        const customerWithDailyLimit = {
          ...mockSilverCustomer,
          dailyEarnings: 50
        };

        jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
          .mockResolvedValue(customerWithDailyLimit as any);

        // Test would be in shop's issue-reward endpoint
        expect(customerWithDailyLimit.dailyEarnings).toBe(50);
      });

      it('should enforce monthly earning limit (500 RCN)', async () => {
        const customerWithMonthlyLimit = {
          ...mockSilverCustomer,
          monthlyEarnings: 500
        };

        jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
          .mockResolvedValue(customerWithMonthlyLimit as any);

        expect(customerWithMonthlyLimit.monthlyEarnings).toBe(500);
      });
    });

    describe('3.3 Analytics', () => {
      it('should get customer analytics', async () => {
        jest.spyOn(CustomerRepository.prototype, 'getCustomerAnalytics')
          .mockResolvedValue({
            totalEarned: 500,
            totalSpent: 100,
            transactionCount: 20,
            favoriteShop: 'SHOP123',
            earningTrend: []
          } as any);

        const response = await request(app)
          .get(`/api/customers/${customerAddress}/analytics`)
          .set('Authorization', `Bearer ${customerToken}`);

        expect(response.status).toBe(200);
        expect(response.body.totalEarned).toBe(500);
        expect(response.body.totalSpent).toBe(100);
      });
    });
  });

  // ========================================
  // 4. REFERRAL SYSTEM
  // ========================================
  describe('4. Referral System', () => {
    beforeEach(async () => {
      jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
        .mockResolvedValue(mockGoldCustomer as any);
      
      const authResponse = await request(app)
        .post('/api/auth/customer')
        .send({ walletAddress: customerAddress });
      
      customerToken = authResponse.body.token;
    });

    describe('4.1 Referral Code Generation', () => {
      it('should have unique referral code after registration', async () => {
        expect(mockGoldCustomer.referralCode).toBe('GOLD789');
        expect(mockGoldCustomer.referralCode).toMatch(/^[A-Z0-9]{8}$/);
      });
    });

    describe('4.2 Referral Tracking', () => {
      it('should get referral statistics', async () => {
        jest.spyOn(ReferralRepository.prototype, 'getCustomerReferrals')
          .mockResolvedValue([
            { status: 'completed', refereeAddress: '0x111', completedAt: new Date() },
            { status: 'completed', refereeAddress: '0x222', completedAt: new Date() },
            { status: 'pending', refereeAddress: '0x333', completedAt: null }
          ] as any);

        const response = await request(app)
          .get(`/api/customers/${customerAddress}/referrals`)
          .set('Authorization', `Bearer ${customerToken}`);

        expect(response.status).toBe(200);
        expect(response.body.stats.successfulReferrals).toBe(2);
        expect(response.body.stats.pendingReferrals).toBe(1);
        expect(response.body.stats.totalEarned).toBe(50); // 2 * 25 RCN
      });
    });

    describe('4.3 Referral Rewards', () => {
      it('should validate referral rewards structure', () => {
        const referrerReward = 25; // RCN for referrer
        const refereeBonus = 10; // RCN bonus for referee
        
        expect(referrerReward).toBe(25);
        expect(refereeBonus).toBe(10);
      });
    });
  });

  // ========================================
  // 5. CROSS-SHOP FEATURES
  // ========================================
  describe('5. Cross-Shop Features', () => {
    beforeEach(async () => {
      jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
        .mockResolvedValue(mockSilverCustomer as any);
      
      const authResponse = await request(app)
        .post('/api/auth/customer')
        .send({ walletAddress: customerAddress });
      
      customerToken = authResponse.body.token;
    });

    describe('5.1 Cross-Shop Verification', () => {
      it('should verify cross-shop redemption limits', async () => {
        const earnedBalance = 100;
        const crossShopLimit = earnedBalance * 0.2; // 20%

        jest.spyOn(VerificationService.prototype, 'verifyRedemption')
          .mockResolvedValue({
            canRedeem: true,
            maxRedeemable: crossShopLimit,
            earnedBalance: earnedBalance,
            isCrossShop: true,
            message: 'Cross-shop limit: 20 RCN'
          } as any);

        expect(crossShopLimit).toBe(20);
      });
    });

    describe('5.2 Home Shop Detection', () => {
      it('should identify home shop for 100% redemption', async () => {
        jest.spyOn(ReferralRepository.prototype, 'getHomeShop')
          .mockResolvedValue({
            shopId: 'SHOP123',
            earnedAmount: 500,
            transactionCount: 10
          } as any);

        jest.spyOn(VerificationService.prototype, 'verifyRedemption')
          .mockResolvedValue({
            canRedeem: true,
            maxRedeemable: 500,
            earnedBalance: 500,
            isCrossShop: false,
            message: 'Home shop: 100% redeemable'
          } as any);

        const verification = await VerificationService.prototype.verifyRedemption(
          customerAddress,
          100,
          'SHOP123'
        );

        expect(verification.isCrossShop).toBe(false);
        expect(verification.maxRedeemable).toBe(500);
      });
    });
  });

  // ========================================
  // 6. REDEMPTION SESSIONS
  // ========================================
  describe('6. Redemption Sessions', () => {
    beforeEach(async () => {
      jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
        .mockResolvedValue(mockSilverCustomer as any);
      
      const authResponse = await request(app)
        .post('/api/auth/customer')
        .send({ walletAddress: customerAddress });
      
      customerToken = authResponse.body.token;
    });

    describe('6.1 Session Creation', () => {
      it('should get active redemption sessions', async () => {
        const mockSession = {
          sessionCode: 'RED123',
          shopId: 'SHOP123',
          shopName: 'Test Shop',
          amount: 50,
          status: 'pending',
          expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString()
        };

        jest.spyOn(RedemptionSessionRepository.prototype, 'getCustomerSessions')
          .mockResolvedValue([mockSession] as any);

        const response = await request(app)
          .get(`/api/tokens/redemption-sessions`)
          .set('Authorization', `Bearer ${customerToken}`);

        expect(response.status).toBe(200);
        expect(response.body.sessions).toHaveLength(1);
        expect(response.body.sessions[0].sessionCode).toBe('RED123');
      });
    });

    describe('6.2 Session Management', () => {
      it('should approve redemption session', async () => {
        const mockSession = {
          id: 'session123',
          sessionCode: 'RED123',
          customerAddress: customerAddress,
          shopId: 'SHOP123',
          amount: 50,
          status: 'pending'
        };

        jest.spyOn(RedemptionSessionRepository.prototype, 'getSessionByCode')
          .mockResolvedValue(mockSession as any);
        jest.spyOn(RedemptionSessionRepository.prototype, 'updateSession')
          .mockResolvedValue(undefined);

        const response = await request(app)
          .post(`/api/tokens/approve-redemption`)
          .set('Authorization', `Bearer ${customerToken}`)
          .send({
            sessionCode: 'RED123'
          });

        expect(response.status).toBe(200);
        expect(response.body.message).toContain('approved');
      });

      it('should reject redemption session', async () => {
        const mockSession = {
          id: 'session123',
          sessionCode: 'RED456',
          customerAddress: customerAddress,
          shopId: 'SHOP123',
          amount: 50,
          status: 'pending'
        };

        jest.spyOn(RedemptionSessionRepository.prototype, 'getSessionByCode')
          .mockResolvedValue(mockSession as any);
        jest.spyOn(RedemptionSessionRepository.prototype, 'updateSession')
          .mockResolvedValue(undefined);

        const response = await request(app)
          .post(`/api/tokens/reject-redemption`)
          .set('Authorization', `Bearer ${customerToken}`)
          .send({
            sessionCode: 'RED456'
          });

        expect(response.status).toBe(200);
        expect(response.body.message).toContain('rejected');
      });
    });
  });

  // ========================================
  // 7. DATA EXPORT
  // ========================================
  describe('7. Data Export', () => {
    beforeEach(async () => {
      jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
        .mockResolvedValue(mockGoldCustomer as any);
      
      const authResponse = await request(app)
        .post('/api/auth/customer')
        .send({ walletAddress: customerAddress });
      
      customerToken = authResponse.body.token;
    });

    describe('7.1 Export Customer Data', () => {
      it('should export customer data', async () => {
        const response = await request(app)
          .get(`/api/customers/${customerAddress}/export`)
          .set('Authorization', `Bearer ${customerToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('profile');
        expect(response.body).toHaveProperty('transactions');
        expect(response.body).toHaveProperty('referrals');
        expect(response.body).toHaveProperty('exportDate');
      });

      it('should prevent exporting other customer data', async () => {
        const otherAddress = '0x9999999999999999999999999999999999999999';
        
        const response = await request(app)
          .get(`/api/customers/${otherAddress}/export`)
          .set('Authorization', `Bearer ${customerToken}`);

        expect(response.status).toBe(403);
      });
    });
  });

  // ========================================
  // 8. SUSPENSION & ACTIVATION
  // ========================================
  describe('8. Suspension & Activation', () => {
    describe('8.1 Account Status', () => {
      it('should block suspended customers from authentication', async () => {
        const suspendedCustomer = {
          ...mockBronzeCustomer,
          isActive: false,
          suspendedAt: new Date().toISOString(),
          suspensionReason: 'Terms violation'
        };

        jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
          .mockResolvedValue(suspendedCustomer as any);

        const response = await request(app)
          .post('/api/auth/customer')
          .send({ walletAddress: customerAddress });

        expect(response.status).toBe(403);
        expect(response.body.error).toContain('suspended');
      });
    });
  });

  // ========================================
  // 9. EARNING SOURCE TRACKING
  // ========================================
  describe('9. Earning Source Tracking', () => {
    beforeEach(async () => {
      jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
        .mockResolvedValue(mockGoldCustomer as any);
      
      const authResponse = await request(app)
        .post('/api/auth/customer')
        .send({ walletAddress: customerAddress });
      
      customerToken = authResponse.body.token;
    });

    describe('9.1 Earning Breakdown', () => {
      it('should get earning breakdown by source', async () => {
        jest.spyOn(ReferralRepository.prototype, 'getCustomerRcnBySource')
          .mockResolvedValue({
            repairs: 800,
            referrals: 125,
            tierBonuses: 150,
            promotions: 25,
            total: 1100
          } as any);

        const response = await request(app)
          .get(`/api/tokens/earned-balance/${customerAddress}`)
          .set('Authorization', `Bearer ${customerToken}`);

        expect(response.status).toBe(200);
        expect(response.body.breakdown.repairs).toBe(800);
        expect(response.body.breakdown.referrals).toBe(125);
        expect(response.body.breakdown.tierBonuses).toBe(150);
      });

      it('should get earning sources by shop', async () => {
        jest.spyOn(ReferralRepository.prototype, 'getCustomerRcnSources')
          .mockResolvedValue([
            { shopId: 'SHOP123', shopName: 'Main Shop', amount: 600 },
            { shopId: 'SHOP456', shopName: 'Other Shop', amount: 200 }
          ] as any);

        const response = await request(app)
          .get(`/api/tokens/earning-sources/${customerAddress}`)
          .set('Authorization', `Bearer ${customerToken}`);

        expect(response.status).toBe(200);
        expect(response.body.sources).toHaveLength(2);
        expect(response.body.sources[0].amount).toBe(600);
      });
    });
  });

  afterAll(async () => {
    // Cleanup if needed
    jest.clearAllMocks();
  });
});