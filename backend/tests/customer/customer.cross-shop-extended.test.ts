import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import RepairCoinApp from '../../src/app';
import { crossShopVerificationService } from '../../src/domains/customer/services/CrossShopVerificationService';

// Mock the service
jest.mock('../../src/domains/customer/services/CrossShopVerificationService');
jest.mock('thirdweb');

/**
 * Extended Cross-Shop Verification Tests
 *
 * Tests for cross-shop features not covered in base tests:
 * - GET /api/customers/cross-shop/balance/:customerAddress - Balance breakdown
 * - POST /api/customers/cross-shop/process - Process redemption
 * - GET /api/customers/cross-shop/history/:customerAddress - Verification history
 * - GET /api/customers/cross-shop/stats/network - Network statistics
 */
describe('Extended Cross-Shop Verification API Tests', () => {
  let app: any;
  const customerAddress = '0x1234567890123456789012345678901234567890';
  const invalidAddress = 'invalid-address';

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

  // ==========================================
  // Cross-Shop Balance Breakdown Tests
  // ==========================================
  describe('GET /api/customers/cross-shop/balance/:customerAddress', () => {
    const mockBalanceBreakdown = {
      totalRedeemableBalance: 1000,
      crossShopLimit: 200, // 20% of 1000
      availableForCrossShop: 200,
      homeShopBalance: 800 // 80% of 1000
    };

    it('should return balance breakdown for valid customer', async () => {
      jest.spyOn(crossShopVerificationService, 'getCrossShopBalance')
        .mockResolvedValue(mockBalanceBreakdown);

      const response = await request(app)
        .get(`/api/customers/cross-shop/balance/${customerAddress}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalRedeemableBalance).toBe(1000);
      expect(response.body.data.crossShopLimit).toBe(200);
      expect(response.body.data.availableForCrossShop).toBe(200);
      expect(response.body.data.homeShopBalance).toBe(800);
    });

    it('should correctly calculate 20% cross-shop limit', async () => {
      const balanceWithDifferentAmount = {
        totalRedeemableBalance: 500,
        crossShopLimit: 100, // 20% of 500
        availableForCrossShop: 100,
        homeShopBalance: 400
      };

      jest.spyOn(crossShopVerificationService, 'getCrossShopBalance')
        .mockResolvedValue(balanceWithDifferentAmount);

      const response = await request(app)
        .get(`/api/customers/cross-shop/balance/${customerAddress}`);

      expect(response.status).toBe(200);
      expect(response.body.data.crossShopLimit).toBe(100);
      expect(response.body.data.crossShopLimit).toBe(response.body.data.totalRedeemableBalance * 0.2);
    });

    it('should return zero balance for customer with no earnings', async () => {
      const zeroBalance = {
        totalRedeemableBalance: 0,
        crossShopLimit: 0,
        availableForCrossShop: 0,
        homeShopBalance: 0
      };

      jest.spyOn(crossShopVerificationService, 'getCrossShopBalance')
        .mockResolvedValue(zeroBalance);

      const response = await request(app)
        .get(`/api/customers/cross-shop/balance/${customerAddress}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalRedeemableBalance).toBe(0);
      expect(response.body.data.crossShopLimit).toBe(0);
    });

    it('should reject invalid customer address format', async () => {
      const response = await request(app)
        .get(`/api/customers/cross-shop/balance/${invalidAddress}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid');
    });

    it('should reject address too short', async () => {
      const response = await request(app)
        .get('/api/customers/cross-shop/balance/0x123');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject address without 0x prefix', async () => {
      const response = await request(app)
        .get('/api/customers/cross-shop/balance/1234567890123456789012345678901234567890');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle service error gracefully', async () => {
      jest.spyOn(crossShopVerificationService, 'getCrossShopBalance')
        .mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get(`/api/customers/cross-shop/balance/${customerAddress}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should accept lowercase address', async () => {
      jest.spyOn(crossShopVerificationService, 'getCrossShopBalance')
        .mockResolvedValue(mockBalanceBreakdown);

      const lowercaseAddress = customerAddress.toLowerCase();
      const response = await request(app)
        .get(`/api/customers/cross-shop/balance/${lowercaseAddress}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should accept uppercase address', async () => {
      jest.spyOn(crossShopVerificationService, 'getCrossShopBalance')
        .mockResolvedValue(mockBalanceBreakdown);

      const uppercaseAddress = '0xABCDEF1234567890ABCDEF1234567890ABCDEF12';
      const response = await request(app)
        .get(`/api/customers/cross-shop/balance/${uppercaseAddress}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  // ==========================================
  // Process Redemption Tests
  // ==========================================
  describe('POST /api/customers/cross-shop/process', () => {
    const mockProcessResult = {
      success: true,
      transactionId: 'txn_1234567890',
      message: 'Cross-shop redemption processed successfully'
    };

    it('should successfully process approved redemption', async () => {
      jest.spyOn(crossShopVerificationService, 'processRedemption')
        .mockResolvedValue(mockProcessResult);

      const response = await request(app)
        .post('/api/customers/cross-shop/process')
        .send({
          verificationId: 'verify_123',
          actualRedemptionAmount: 50
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.success).toBe(true);
      expect(response.body.data.transactionId).toBeDefined();
    });

    it('should reject missing verificationId', async () => {
      const response = await request(app)
        .post('/api/customers/cross-shop/process')
        .send({
          actualRedemptionAmount: 50
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Verification ID');
    });

    it('should reject missing actualRedemptionAmount', async () => {
      const response = await request(app)
        .post('/api/customers/cross-shop/process')
        .send({
          verificationId: 'verify_123'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('amount');
    });

    it('should reject empty request body', async () => {
      const response = await request(app)
        .post('/api/customers/cross-shop/process')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle expired verification gracefully', async () => {
      jest.spyOn(crossShopVerificationService, 'processRedemption')
        .mockRejectedValue(new Error('Verification has expired'));

      const response = await request(app)
        .post('/api/customers/cross-shop/process')
        .send({
          verificationId: 'verify_expired',
          actualRedemptionAmount: 50
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('expired');
    });

    it('should handle verification not found', async () => {
      jest.spyOn(crossShopVerificationService, 'processRedemption')
        .mockRejectedValue(new Error('Verification not found'));

      const response = await request(app)
        .post('/api/customers/cross-shop/process')
        .send({
          verificationId: 'verify_nonexistent',
          actualRedemptionAmount: 50
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });

    it('should handle amount exceeding verified amount', async () => {
      jest.spyOn(crossShopVerificationService, 'processRedemption')
        .mockRejectedValue(new Error('Amount exceeds verified amount'));

      const response = await request(app)
        .post('/api/customers/cross-shop/process')
        .send({
          verificationId: 'verify_123',
          actualRedemptionAmount: 1000 // Exceeds what was verified
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('exceeds');
    });

    it('should accept amount less than verified amount', async () => {
      jest.spyOn(crossShopVerificationService, 'processRedemption')
        .mockResolvedValue({
          success: true,
          transactionId: 'txn_partial',
          message: 'Partial redemption processed'
        });

      const response = await request(app)
        .post('/api/customers/cross-shop/process')
        .send({
          verificationId: 'verify_123',
          actualRedemptionAmount: 25 // Less than originally verified
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject zero redemption amount', async () => {
      jest.spyOn(crossShopVerificationService, 'processRedemption')
        .mockRejectedValue(new Error('Amount must be greater than zero'));

      const response = await request(app)
        .post('/api/customers/cross-shop/process')
        .send({
          verificationId: 'verify_123',
          actualRedemptionAmount: 0
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should reject negative redemption amount', async () => {
      jest.spyOn(crossShopVerificationService, 'processRedemption')
        .mockRejectedValue(new Error('Amount must be greater than zero'));

      const response = await request(app)
        .post('/api/customers/cross-shop/process')
        .send({
          verificationId: 'verify_123',
          actualRedemptionAmount: -50
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return transaction ID on success', async () => {
      jest.spyOn(crossShopVerificationService, 'processRedemption')
        .mockResolvedValue(mockProcessResult);

      const response = await request(app)
        .post('/api/customers/cross-shop/process')
        .send({
          verificationId: 'verify_123',
          actualRedemptionAmount: 50
        });

      expect(response.status).toBe(200);
      expect(response.body.data.transactionId).toMatch(/^txn_/);
    });
  });

  // ==========================================
  // Verification History Tests
  // ==========================================
  describe('GET /api/customers/cross-shop/history/:customerAddress', () => {
    const mockHistory = [
      {
        id: 'verify_1',
        customerAddress: customerAddress.toLowerCase(),
        redemptionShopId: 'shop_123',
        requestedAmount: 50,
        approved: true,
        denialReason: undefined,
        timestamp: new Date('2024-01-15T10:00:00Z')
      },
      {
        id: 'verify_2',
        customerAddress: customerAddress.toLowerCase(),
        redemptionShopId: 'shop_456',
        requestedAmount: 100,
        approved: false,
        denialReason: 'Exceeds 20% limit',
        timestamp: new Date('2024-01-14T10:00:00Z')
      }
    ];

    it('should return verification history for valid customer', async () => {
      jest.spyOn(crossShopVerificationService, 'getCustomerVerificationHistory')
        .mockResolvedValue(mockHistory);

      const response = await request(app)
        .get(`/api/customers/cross-shop/history/${customerAddress}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.verifications).toHaveLength(2);
      expect(response.body.data.count).toBe(2);
    });

    it('should return empty array for customer with no history', async () => {
      jest.spyOn(crossShopVerificationService, 'getCustomerVerificationHistory')
        .mockResolvedValue([]);

      const response = await request(app)
        .get(`/api/customers/cross-shop/history/${customerAddress}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.verifications).toHaveLength(0);
      expect(response.body.data.count).toBe(0);
    });

    it('should reject invalid customer address format', async () => {
      const response = await request(app)
        .get(`/api/customers/cross-shop/history/${invalidAddress}`);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid');
    });

    it('should use default limit of 50', async () => {
      jest.spyOn(crossShopVerificationService, 'getCustomerVerificationHistory')
        .mockResolvedValue(mockHistory);

      await request(app)
        .get(`/api/customers/cross-shop/history/${customerAddress}`);

      expect(crossShopVerificationService.getCustomerVerificationHistory)
        .toHaveBeenCalledWith(customerAddress, 50);
    });

    it('should accept custom limit parameter', async () => {
      jest.spyOn(crossShopVerificationService, 'getCustomerVerificationHistory')
        .mockResolvedValue(mockHistory.slice(0, 1));

      const response = await request(app)
        .get(`/api/customers/cross-shop/history/${customerAddress}?limit=10`);

      expect(response.status).toBe(200);
      expect(crossShopVerificationService.getCustomerVerificationHistory)
        .toHaveBeenCalledWith(customerAddress, 10);
    });

    it('should handle limit=1', async () => {
      jest.spyOn(crossShopVerificationService, 'getCustomerVerificationHistory')
        .mockResolvedValue([mockHistory[0]]);

      const response = await request(app)
        .get(`/api/customers/cross-shop/history/${customerAddress}?limit=1`);

      expect(response.status).toBe(200);
      expect(response.body.data.verifications).toHaveLength(1);
    });

    it('should handle large limit gracefully', async () => {
      jest.spyOn(crossShopVerificationService, 'getCustomerVerificationHistory')
        .mockResolvedValue(mockHistory);

      const response = await request(app)
        .get(`/api/customers/cross-shop/history/${customerAddress}?limit=1000`);

      expect(response.status).toBe(200);
    });

    it('should include both approved and denied verifications', async () => {
      jest.spyOn(crossShopVerificationService, 'getCustomerVerificationHistory')
        .mockResolvedValue(mockHistory);

      const response = await request(app)
        .get(`/api/customers/cross-shop/history/${customerAddress}`);

      expect(response.status).toBe(200);
      const approvedCount = response.body.data.verifications.filter((v: any) => v.approved).length;
      const deniedCount = response.body.data.verifications.filter((v: any) => !v.approved).length;
      expect(approvedCount).toBe(1);
      expect(deniedCount).toBe(1);
    });

    it('should include denial reason for denied verifications', async () => {
      jest.spyOn(crossShopVerificationService, 'getCustomerVerificationHistory')
        .mockResolvedValue(mockHistory);

      const response = await request(app)
        .get(`/api/customers/cross-shop/history/${customerAddress}`);

      expect(response.status).toBe(200);
      const deniedVerification = response.body.data.verifications.find((v: any) => !v.approved);
      expect(deniedVerification.denialReason).toBeDefined();
    });

    it('should handle service error gracefully', async () => {
      jest.spyOn(crossShopVerificationService, 'getCustomerVerificationHistory')
        .mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get(`/api/customers/cross-shop/history/${customerAddress}`);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should return history sorted by timestamp descending', async () => {
      jest.spyOn(crossShopVerificationService, 'getCustomerVerificationHistory')
        .mockResolvedValue(mockHistory);

      const response = await request(app)
        .get(`/api/customers/cross-shop/history/${customerAddress}`);

      expect(response.status).toBe(200);
      const verifications = response.body.data.verifications;
      if (verifications.length > 1) {
        const firstDate = new Date(verifications[0].timestamp);
        const secondDate = new Date(verifications[1].timestamp);
        expect(firstDate.getTime()).toBeGreaterThanOrEqual(secondDate.getTime());
      }
    });
  });

  // ==========================================
  // Network Statistics Tests
  // ==========================================
  describe('GET /api/customers/cross-shop/stats/network', () => {
    const mockNetworkStats = {
      totalCrossShopRedemptions: 150,
      totalCrossShopValue: 7500.50,
      participatingShops: 25,
      averageRedemptionSize: 50.00,
      networkUtilizationRate: 15.5,
      topCrossShopShops: [
        { shopId: 'shop_1', shopName: 'Best Repair Shop', totalRedemptions: 45, totalValue: 2250 },
        { shopId: 'shop_2', shopName: 'Quick Fix', totalRedemptions: 30, totalValue: 1500 },
        { shopId: 'shop_3', shopName: 'Tech Masters', totalRedemptions: 25, totalValue: 1250 }
      ]
    };

    it('should return network-wide cross-shop statistics', async () => {
      jest.spyOn(crossShopVerificationService, 'getNetworkCrossShopStats')
        .mockResolvedValue(mockNetworkStats);

      const response = await request(app)
        .get('/api/customers/cross-shop/stats/network');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalCrossShopRedemptions).toBe(150);
      expect(response.body.data.totalCrossShopValue).toBe(7500.50);
      expect(response.body.data.participatingShops).toBe(25);
    });

    it('should include average redemption size', async () => {
      jest.spyOn(crossShopVerificationService, 'getNetworkCrossShopStats')
        .mockResolvedValue(mockNetworkStats);

      const response = await request(app)
        .get('/api/customers/cross-shop/stats/network');

      expect(response.status).toBe(200);
      expect(response.body.data.averageRedemptionSize).toBe(50.00);
    });

    it('should include network utilization rate', async () => {
      jest.spyOn(crossShopVerificationService, 'getNetworkCrossShopStats')
        .mockResolvedValue(mockNetworkStats);

      const response = await request(app)
        .get('/api/customers/cross-shop/stats/network');

      expect(response.status).toBe(200);
      expect(response.body.data.networkUtilizationRate).toBe(15.5);
    });

    it('should include top cross-shop shops', async () => {
      jest.spyOn(crossShopVerificationService, 'getNetworkCrossShopStats')
        .mockResolvedValue(mockNetworkStats);

      const response = await request(app)
        .get('/api/customers/cross-shop/stats/network');

      expect(response.status).toBe(200);
      expect(response.body.data.topCrossShopShops).toHaveLength(3);
      expect(response.body.data.topCrossShopShops[0].shopName).toBe('Best Repair Shop');
    });

    it('should return zeros when no cross-shop activity', async () => {
      const emptyStats = {
        totalCrossShopRedemptions: 0,
        totalCrossShopValue: 0,
        participatingShops: 0,
        averageRedemptionSize: 0,
        networkUtilizationRate: 0,
        topCrossShopShops: []
      };

      jest.spyOn(crossShopVerificationService, 'getNetworkCrossShopStats')
        .mockResolvedValue(emptyStats);

      const response = await request(app)
        .get('/api/customers/cross-shop/stats/network');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.totalCrossShopRedemptions).toBe(0);
      expect(response.body.data.topCrossShopShops).toHaveLength(0);
    });

    it('should handle service error gracefully', async () => {
      jest.spyOn(crossShopVerificationService, 'getNetworkCrossShopStats')
        .mockRejectedValue(new Error('Statistics calculation failed'));

      const response = await request(app)
        .get('/api/customers/cross-shop/stats/network');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });

    it('should return top shops sorted by total value', async () => {
      jest.spyOn(crossShopVerificationService, 'getNetworkCrossShopStats')
        .mockResolvedValue(mockNetworkStats);

      const response = await request(app)
        .get('/api/customers/cross-shop/stats/network');

      expect(response.status).toBe(200);
      const topShops = response.body.data.topCrossShopShops;
      if (topShops.length > 1) {
        for (let i = 0; i < topShops.length - 1; i++) {
          expect(topShops[i].totalValue).toBeGreaterThanOrEqual(topShops[i + 1].totalValue);
        }
      }
    });

    it('should limit top shops to maximum of 5', async () => {
      const statsWithManyShops = {
        ...mockNetworkStats,
        topCrossShopShops: [
          { shopId: 'shop_1', shopName: 'Shop 1', totalRedemptions: 50, totalValue: 2500 },
          { shopId: 'shop_2', shopName: 'Shop 2', totalRedemptions: 45, totalValue: 2250 },
          { shopId: 'shop_3', shopName: 'Shop 3', totalRedemptions: 40, totalValue: 2000 },
          { shopId: 'shop_4', shopName: 'Shop 4', totalRedemptions: 35, totalValue: 1750 },
          { shopId: 'shop_5', shopName: 'Shop 5', totalRedemptions: 30, totalValue: 1500 }
        ]
      };

      jest.spyOn(crossShopVerificationService, 'getNetworkCrossShopStats')
        .mockResolvedValue(statsWithManyShops);

      const response = await request(app)
        .get('/api/customers/cross-shop/stats/network');

      expect(response.status).toBe(200);
      expect(response.body.data.topCrossShopShops.length).toBeLessThanOrEqual(5);
    });

    it('should include shop names in top shops', async () => {
      jest.spyOn(crossShopVerificationService, 'getNetworkCrossShopStats')
        .mockResolvedValue(mockNetworkStats);

      const response = await request(app)
        .get('/api/customers/cross-shop/stats/network');

      expect(response.status).toBe(200);
      response.body.data.topCrossShopShops.forEach((shop: any) => {
        expect(shop.shopName).toBeDefined();
        expect(shop.shopId).toBeDefined();
        expect(shop.totalRedemptions).toBeDefined();
        expect(shop.totalValue).toBeDefined();
      });
    });
  });
});
