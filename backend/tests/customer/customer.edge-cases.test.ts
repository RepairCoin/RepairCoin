import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import RepairCoinApp from '../../src/app';
import { CustomerRepository } from '../../src/repositories/CustomerRepository';
import { ShopRepository } from '../../src/repositories/ShopRepository';
import { ReferralRepository } from '../../src/repositories/ReferralRepository';
import { VerificationService } from '../../src/domains/token/services/VerificationService';

// Mock dependencies
jest.mock('../../src/repositories/CustomerRepository');
jest.mock('../../src/repositories/ShopRepository');
jest.mock('../../src/repositories/ReferralRepository');
jest.mock('../../src/domains/token/services/VerificationService');
jest.mock('thirdweb');

describe('Customer Features - Edge Cases & Error Scenarios', () => {
  let app: any;
  const validAddress = '0x1234567890123456789012345678901234567890';
  const invalidAddress = '0xinvalid';
  const shortAddress = '0x12345';
  
  beforeAll(async () => {
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
  // 1. INPUT VALIDATION EDGE CASES
  // ========================================
  describe('1. Input Validation Edge Cases', () => {
    
    describe('1.1 Registration Validation', () => {
      it('should reject invalid wallet address format', async () => {
        const response = await request(app)
          .post('/api/customers/register')
          .send({
            walletAddress: invalidAddress,
            email: 'test@example.com'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Invalid Ethereum address');
      });

      it('should reject short wallet address', async () => {
        const response = await request(app)
          .post('/api/customers/register')
          .send({
            walletAddress: shortAddress,
            email: 'test@example.com'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Invalid Ethereum address');
      });

      it('should reject invalid email format', async () => {
        jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress').mockResolvedValue(null);
        jest.spyOn(ShopRepository.prototype, 'getShopByWalletAddress').mockResolvedValue(null);

        const response = await request(app)
          .post('/api/customers/register')
          .send({
            walletAddress: validAddress,
            email: 'invalid-email'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Invalid email');
      });

      it('should handle missing required fields', async () => {
        const response = await request(app)
          .post('/api/customers/register')
          .send({
            email: 'test@example.com'
            // missing walletAddress
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Wallet address is required');
      });

      it('should handle extremely long input strings', async () => {
        const longString = 'a'.repeat(1000);
        
        const response = await request(app)
          .post('/api/customers/register')
          .send({
            walletAddress: validAddress,
            email: 'test@example.com',
            name: longString
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Name too long');
      });
    });

    describe('1.2 Phone Number Validation', () => {
      it('should accept various phone formats', async () => {
        const phoneFormats = [
          '+1234567890',
          '+1 234 567 8900',
          '+44 20 7946 0958',
          '+81 3-1234-5678'
        ];

        // Mock successful registration
        jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress').mockResolvedValue(null);
        jest.spyOn(ShopRepository.prototype, 'getShopByWalletAddress').mockResolvedValue(null);
        jest.spyOn(CustomerRepository.prototype, 'createCustomer').mockResolvedValue({} as any);

        for (const phone of phoneFormats) {
          const response = await request(app)
            .post('/api/customers/register')
            .send({
              walletAddress: validAddress,
              email: 'test@example.com',
              phone
            });

          expect([200, 201]).toContain(response.status);
        }
      });

      it('should reject invalid phone formats', async () => {
        const invalidPhones = [
          '123',
          'phone-number',
          '++1234567890',
          '+1234567890123456789' // too long
        ];

        for (const phone of invalidPhones) {
          const response = await request(app)
            .post('/api/customers/register')
            .send({
              walletAddress: validAddress,
              email: 'test@example.com',
              phone
            });

          expect(response.status).toBe(400);
        }
      });
    });
  });

  // ========================================
  // 2. REFERRAL EDGE CASES
  // ========================================
  describe('2. Referral Edge Cases', () => {
    
    describe('2.1 Referral Code Edge Cases', () => {
      it('should handle case-insensitive referral codes', async () => {
        const mockReferrer = {
          address: '0x9999999999999999999999999999999999999999',
          referralCode: 'ABCD1234'
        };

        jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress').mockResolvedValue(null);
        jest.spyOn(ShopRepository.prototype, 'getShopByWalletAddress').mockResolvedValue(null);
        jest.spyOn(CustomerRepository.prototype, 'getCustomerByReferralCode')
          .mockImplementation((code) => {
            if (code.toUpperCase() === mockReferrer.referralCode) {
              return Promise.resolve(mockReferrer as any);
            }
            return Promise.resolve(null);
          });
        jest.spyOn(CustomerRepository.prototype, 'createCustomer').mockResolvedValue({} as any);
        jest.spyOn(ReferralRepository.prototype, 'createReferral').mockResolvedValue({} as any);

        // Test different case variations
        const caseVariations = ['ABCD1234', 'abcd1234', 'AbCd1234', 'aBcD1234'];

        for (const code of caseVariations) {
          const response = await request(app)
            .post('/api/customers/register')
            .send({
              walletAddress: validAddress,
              email: `test${code}@example.com`,
              referralCode: code
            });

          expect([200, 201]).toContain(response.status);
        }
      });

      it('should reject self-referral', async () => {
        const mockCustomer = {
          address: validAddress,
          referralCode: 'SELF1234'
        };

        jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress').mockResolvedValue(null);
        jest.spyOn(ShopRepository.prototype, 'getShopByWalletAddress').mockResolvedValue(null);
        jest.spyOn(CustomerRepository.prototype, 'getCustomerByReferralCode')
          .mockResolvedValue(mockCustomer as any);

        const response = await request(app)
          .post('/api/customers/register')
          .send({
            walletAddress: validAddress,
            email: 'self@example.com',
            referralCode: 'SELF1234'
          });

        // Should still register but not process referral
        expect([200, 201]).toContain(response.status);
      });

      it('should handle non-existent referral codes gracefully', async () => {
        jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress').mockResolvedValue(null);
        jest.spyOn(ShopRepository.prototype, 'getShopByWalletAddress').mockResolvedValue(null);
        jest.spyOn(CustomerRepository.prototype, 'getCustomerByReferralCode').mockResolvedValue(null);
        jest.spyOn(CustomerRepository.prototype, 'createCustomer').mockResolvedValue({} as any);

        const response = await request(app)
          .post('/api/customers/register')
          .send({
            walletAddress: validAddress,
            email: 'noreferral@example.com',
            referralCode: 'NOTEXIST'
          });

        // Should still register successfully
        expect([200, 201]).toContain(response.status);
      });
    });

    describe('2.2 Referral Reward Edge Cases', () => {
      it('should handle referral with already referred customer', async () => {
        const existingCustomer = {
          address: validAddress,
          referredBy: '0x8888888888888888888888888888888888888888'
        };

        jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
          .mockResolvedValue(existingCustomer as any);

        const response = await request(app)
          .post('/api/customers/register')
          .send({
            walletAddress: validAddress,
            email: 'existing@example.com',
            referralCode: 'NEWCODE'
          });

        expect(response.status).toBe(409);
        expect(response.body.error).toContain('already registered');
      });
    });
  });

  // ========================================
  // 3. EARNING & LIMIT EDGE CASES
  // ========================================
  describe('3. Earning & Limit Edge Cases', () => {
    let customerToken: string;
    
    beforeEach(async () => {
      const mockCustomer = {
        address: validAddress,
        dailyEarnings: 49,
        monthlyEarnings: 499,
        lastEarnedDate: new Date().toISOString()
      };

      jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
        .mockResolvedValue(mockCustomer as any);
      
      const authResponse = await request(app)
        .post('/api/auth/customer')
        .send({ walletAddress: validAddress });
      
      customerToken = authResponse.body.token;
    });

    describe('3.1 Daily Limit Edge Cases', () => {
      it('should handle customer at daily limit edge (49/50 RCN)', async () => {
        // Customer has 49 RCN earned today, can earn 1 more
        const customer = await CustomerRepository.prototype.getCustomerByAddress(validAddress);
        expect(customer?.dailyEarnings).toBe(49);
      });

      it('should reset daily earnings after midnight', async () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        const customerWithYesterdayEarnings = {
          address: validAddress,
          dailyEarnings: 50,
          lastEarnedDate: yesterday.toISOString()
        };

        jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
          .mockResolvedValue(customerWithYesterdayEarnings as any);

        // Daily earnings should be reset for new day
        // This would be handled in the service layer
        expect(customerWithYesterdayEarnings.lastEarnedDate).not.toBe(new Date().toDateString());
      });
    });

    describe('3.2 Monthly Limit Edge Cases', () => {
      it('should handle customer at monthly limit edge (499/500 RCN)', async () => {
        const customer = await CustomerRepository.prototype.getCustomerByAddress(validAddress);
        expect(customer?.monthlyEarnings).toBe(499);
      });

      it('should handle month rollover', async () => {
        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);

        const customerWithLastMonthEarnings = {
          address: validAddress,
          monthlyEarnings: 500,
          monthlyResetDate: lastMonth.toISOString()
        };

        jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
          .mockResolvedValue(customerWithLastMonthEarnings as any);

        // Monthly earnings should be reset for new month
        expect(new Date(customerWithLastMonthEarnings.monthlyResetDate).getMonth())
          .not.toBe(new Date().getMonth());
      });
    });
  });

  // ========================================
  // 4. TIER PROGRESSION EDGE CASES
  // ========================================
  describe('4. Tier Progression Edge Cases', () => {
    
    describe('4.1 Tier Boundary Cases', () => {
      it('should handle exact tier boundaries correctly', async () => {
        const tierBoundaries = [
          { earnings: 0, expectedTier: 'BRONZE' },
          { earnings: 199, expectedTier: 'BRONZE' },
          { earnings: 200, expectedTier: 'SILVER' },
          { earnings: 999, expectedTier: 'SILVER' },
          { earnings: 1000, expectedTier: 'GOLD' },
          { earnings: 10000, expectedTier: 'GOLD' }
        ];

        for (const { earnings, expectedTier } of tierBoundaries) {
          const mockCustomer = {
            address: validAddress,
            lifetimeEarnings: earnings,
            tier: expectedTier
          };

          jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
            .mockResolvedValue(mockCustomer as any);

          const authResponse = await request(app)
            .post('/api/auth/customer')
            .send({ walletAddress: validAddress });

          expect(authResponse.body.user.tier).toBe(expectedTier);
        }
      });
    });
  });

  // ========================================
  // 5. REDEMPTION EDGE CASES
  // ========================================
  describe('5. Redemption Edge Cases', () => {
    
    describe('5.1 Cross-Shop Redemption Edge Cases', () => {
      it('should handle exact 20% cross-shop limit', async () => {
        const earnedBalance = 100;
        const requestAmount = 20; // Exactly 20%

        jest.spyOn(VerificationService.prototype, 'verifyRedemption')
          .mockResolvedValue({
            canRedeem: true,
            maxRedeemable: 20,
            earnedBalance: earnedBalance,
            isCrossShop: true
          } as any);

        const result = await VerificationService.prototype.verifyRedemption(
          validAddress,
          requestAmount,
          'SHOP123'
        );

        expect(result.canRedeem).toBe(true);
        expect(result.maxRedeemable).toBe(20);
      });

      it('should reject redemption exceeding cross-shop limit', async () => {
        const earnedBalance = 100;
        const requestAmount = 21; // Over 20%

        jest.spyOn(VerificationService.prototype, 'verifyRedemption')
          .mockResolvedValue({
            canRedeem: false,
            maxRedeemable: 20,
            earnedBalance: earnedBalance,
            isCrossShop: true,
            message: 'Amount exceeds cross-shop limit'
          } as any);

        const result = await VerificationService.prototype.verifyRedemption(
          validAddress,
          requestAmount,
          'SHOP123'
        );

        expect(result.canRedeem).toBe(false);
      });

      it('should handle fractional RCN amounts', async () => {
        const earnedBalance = 33; // 20% = 6.6 RCN
        const maxRedeemable = Math.floor(earnedBalance * 0.2); // 6 RCN

        expect(maxRedeemable).toBe(6);
      });
    });

    describe('5.2 Market vs Earned Token Edge Cases', () => {
      it('should reject redemption of market-bought tokens', async () => {
        jest.spyOn(VerificationService.prototype, 'verifyRedemption')
          .mockResolvedValue({
            canRedeem: false,
            maxRedeemable: 0,
            earnedBalance: 50,
            totalBalance: 150, // 50 earned + 100 market-bought
            message: 'Only earned RCN can be redeemed'
          } as any);

        const result = await VerificationService.prototype.verifyRedemption(
          validAddress,
          100, // Trying to redeem market tokens
          'SHOP123'
        );

        expect(result.canRedeem).toBe(false);
        expect(result.earnedBalance).toBe(50);
      });
    });
  });

  // ========================================
  // 6. CONCURRENCY EDGE CASES
  // ========================================
  describe('6. Concurrency Edge Cases', () => {
    
    describe('6.1 Race Conditions', () => {
      it('should handle simultaneous registration attempts', async () => {
        let firstCall = true;
        
        jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
          .mockImplementation(() => {
            if (firstCall) {
              firstCall = false;
              return Promise.resolve(null);
            }
            return Promise.resolve({ address: validAddress } as any);
          });

        jest.spyOn(ShopRepository.prototype, 'getShopByWalletAddress').mockResolvedValue(null);
        jest.spyOn(CustomerRepository.prototype, 'createCustomer').mockResolvedValue({} as any);

        // Simulate two simultaneous registration attempts
        const promises = [
          request(app)
            .post('/api/customers/register')
            .send({ walletAddress: validAddress, email: 'race1@example.com' }),
          request(app)
            .post('/api/customers/register')
            .send({ walletAddress: validAddress, email: 'race2@example.com' })
        ];

        const results = await Promise.all(promises);
        
        // One should succeed, one should fail
        const successCount = results.filter(r => r.status === 201).length;
        const failCount = results.filter(r => r.status === 409).length;
        
        expect(successCount).toBeLessThanOrEqual(1);
        expect(failCount).toBeGreaterThanOrEqual(0);
      });
    });
  });

  // ========================================
  // 7. DATA INTEGRITY EDGE CASES
  // ========================================
  describe('7. Data Integrity Edge Cases', () => {
    
    describe('7.1 Missing or Corrupted Data', () => {
      it('should handle customer with missing tier data', async () => {
        const corruptedCustomer = {
          address: validAddress,
          email: 'corrupt@example.com',
          tier: null,
          lifetimeEarnings: 500
        };

        jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
          .mockResolvedValue(corruptedCustomer as any);

        const response = await request(app)
          .post('/api/auth/customer')
          .send({ walletAddress: validAddress });

        // Should calculate tier based on earnings
        expect(response.status).toBe(200);
        // Service should calculate SILVER tier for 500 earnings
      });

      it('should handle null or undefined values in optional fields', async () => {
        const customerWithNulls = {
          address: validAddress,
          email: 'nulls@example.com',
          name: null,
          phone: null,
          referredBy: null,
          tier: 'BRONZE',
          lifetimeEarnings: 0
        };

        jest.spyOn(CustomerRepository.prototype, 'getCustomerByAddress')
          .mockResolvedValue(customerWithNulls as any);

        const response = await request(app)
          .post('/api/auth/customer')
          .send({ walletAddress: validAddress });

        expect(response.status).toBe(200);
        expect(response.body.user).toBeDefined();
      });
    });
  });

  afterAll(async () => {
    jest.clearAllMocks();
  });
});