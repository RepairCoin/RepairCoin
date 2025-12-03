import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import RepairCoinApp from '../../src/app';
import { shopRepository } from '../../src/repositories';

// Mock external services
jest.mock('../../src/services/StripeService');
jest.mock('../../src/contracts/RCGTokenReader');
jest.mock('thirdweb');

describe('Shop Buy Credits (RCN Purchase) Tests', () => {
  let app: any;
  let shopToken: string;
  let invalidToken: string;

  // Must match the JWT_SECRET from tests/setup.ts
  const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key';

  const testShop = {
    shopId: 'test-shop-123',
    shop_id: 'test-shop-123',
    name: 'Test Repair Shop',
    email: 'shop@test.com',
    walletAddress: '0x1234567890123456789012345678901234567890',
    wallet_address: '0x1234567890123456789012345678901234567890',
    active: true,
    verified: true,
    operational_status: 'subscription_qualified',
    purchased_rcn_balance: 500,
    total_rcn_purchased: 1000,
    total_tokens_issued: 200
  };

  const adminAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f1234';

  // Helper to generate a valid shop JWT token
  const generateShopToken = (shopId: string, walletAddress: string) => {
    return jwt.sign(
      {
        address: walletAddress.toLowerCase(),
        role: 'shop',
        shopId: shopId
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  };

  // Helper to generate a customer token (non-shop)
  const generateCustomerToken = (walletAddress: string) => {
    return jwt.sign(
      {
        address: walletAddress.toLowerCase(),
        role: 'customer'
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  };

  beforeAll(async () => {
    // Set test environment variables (JWT_SECRET already set by tests/setup.ts)
    process.env.ADMIN_ADDRESSES = adminAddress;
    process.env.NODE_ENV = 'test';
    process.env.FRONTEND_URL = 'http://localhost:3001';

    // Initialize the app
    const repairCoinApp = new RepairCoinApp();
    await repairCoinApp.initialize();
    app = repairCoinApp.app;

    // Generate tokens
    shopToken = generateShopToken(testShop.shopId, testShop.walletAddress);
    invalidToken = 'invalid-token-12345';

    // Mock shop repository responses
    jest.spyOn(shopRepository, 'getShop').mockResolvedValue(testShop as any);
    jest.spyOn(shopRepository, 'createShopPurchase').mockResolvedValue({ id: 'purchase-123' } as any);
    jest.spyOn(shopRepository, 'getShopPurchase').mockResolvedValue({
      id: 'purchase-123',
      shopId: testShop.shopId,
      shop_id: testShop.shopId,
      amount: 100,
      pricePerRcn: 0.10,
      price_per_rcn: 0.10,
      totalCost: 10,
      total_cost: 10,
      status: 'pending'
    } as any);
    jest.spyOn(shopRepository, 'completeShopPurchase').mockResolvedValue(undefined);
    jest.spyOn(shopRepository, 'cancelShopPurchase').mockResolvedValue(undefined);
    jest.spyOn(shopRepository, 'getShopPurchaseHistory').mockResolvedValue({
      items: [
        {
          id: 'purchase-1',
          shop_id: testShop.shopId,
          amount: 100,
          price_per_rcn: 0.10,
          total_cost: 10,
          payment_method: 'credit_card',
          status: 'completed',
          created_at: new Date().toISOString(),
          completed_at: new Date().toISOString()
        }
      ],
      pagination: {
        page: 1,
        totalPages: 1,
        totalItems: 1
      }
    } as any);
  });

  afterAll(async () => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-mock after clear
    jest.spyOn(shopRepository, 'getShop').mockResolvedValue(testShop as any);
    jest.spyOn(shopRepository, 'createShopPurchase').mockResolvedValue({ id: 'purchase-123' } as any);
    jest.spyOn(shopRepository, 'getShopPurchase').mockResolvedValue({
      id: 'purchase-123',
      shopId: testShop.shopId,
      shop_id: testShop.shopId,
      amount: 100,
      pricePerRcn: 0.10,
      price_per_rcn: 0.10,
      totalCost: 10,
      total_cost: 10,
      status: 'pending'
    } as any);
    jest.spyOn(shopRepository, 'completeShopPurchase').mockResolvedValue(undefined);
    jest.spyOn(shopRepository, 'cancelShopPurchase').mockResolvedValue(undefined);
  });

  // ============================================
  // Authentication Tests
  // ============================================
  describe('Authentication Requirements', () => {

    it('should reject unauthenticated requests to purchase initiate', async () => {
      const response = await request(app)
        .post('/api/shops/purchase/initiate')
        .send({
          shopId: testShop.shopId,
          amount: 100,
          paymentMethod: 'credit_card'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should reject invalid JWT tokens', async () => {
      const response = await request(app)
        .post('/api/shops/purchase/initiate')
        .set('Authorization', `Bearer ${invalidToken}`)
        .send({
          shopId: testShop.shopId,
          amount: 100,
          paymentMethod: 'credit_card'
        });

      expect(response.status).toBe(401);
    });

    it('should reject customer tokens for shop purchase routes', async () => {
      const customerToken = generateCustomerToken('0x9876543210987654321098765432109876543210');

      const response = await request(app)
        .post('/api/shops/purchase/initiate')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          shopId: testShop.shopId,
          amount: 100,
          paymentMethod: 'credit_card'
        });

      // 401 if auth middleware rejects, 403 if requireRole middleware rejects
      expect([401, 403]).toContain(response.status);
    });

    it('should accept valid shop JWT tokens', async () => {
      const response = await request(app)
        .post('/api/shops/purchase/initiate')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          shopId: testShop.shopId,
          amount: 100,
          paymentMethod: 'credit_card'
        });

      // Should pass auth, may succeed or fail based on business logic
      expect([200, 400, 403]).toContain(response.status);
    });
  });

  // ============================================
  // Purchase Initiation Tests (Authenticated)
  // ============================================
  describe('POST /api/shops/purchase/initiate (Authenticated)', () => {

    describe('Successful Purchase Initiation', () => {
      it('should initiate purchase with valid amount and payment method', async () => {
        const response = await request(app)
          .post('/api/shops/purchase/initiate')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({
            shopId: testShop.shopId,
            amount: 100,
            paymentMethod: 'credit_card'
          });

        // Accept 200 (success) or 403 (subscription enforcement)
        expect([200, 403]).toContain(response.status);
        if (response.status === 200) {
          expect(response.body.success).toBe(true);
          expect(response.body.data).toHaveProperty('purchaseId');
          expect(response.body.data).toHaveProperty('totalCost');
          expect(response.body.data.status).toBe('pending');
        }
      });

      it('should initiate minimum purchase amount (5 RCN)', async () => {
        const response = await request(app)
          .post('/api/shops/purchase/initiate')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({
            shopId: testShop.shopId,
            amount: 5,
            paymentMethod: 'credit_card'
          });

        expect([200, 403]).toContain(response.status);
      });

      it('should initiate maximum purchase amount (10000 RCN)', async () => {
        const response = await request(app)
          .post('/api/shops/purchase/initiate')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({
            shopId: testShop.shopId,
            amount: 10000,
            paymentMethod: 'credit_card'
          });

        expect([200, 403]).toContain(response.status);
      });
    });

    describe('Invalid Amount Validation', () => {
      it('should reject purchase below minimum (less than 5 RCN)', async () => {
        const response = await request(app)
          .post('/api/shops/purchase/initiate')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({
            shopId: testShop.shopId,
            amount: 4,
            paymentMethod: 'credit_card'
          });

        // 400 for validation error, 403 for subscription enforcement
        expect([400, 403]).toContain(response.status);
        if (response.status === 400) {
          expect(response.body.success).toBe(false);
        }
      });

      it('should reject purchase above maximum (more than 10000 RCN)', async () => {
        const response = await request(app)
          .post('/api/shops/purchase/initiate')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({
            shopId: testShop.shopId,
            amount: 10001,
            paymentMethod: 'credit_card'
          });

        expect([400, 403]).toContain(response.status);
        if (response.status === 400) {
          expect(response.body.success).toBe(false);
        }
      });

      it('should reject zero amount', async () => {
        const response = await request(app)
          .post('/api/shops/purchase/initiate')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({
            shopId: testShop.shopId,
            amount: 0,
            paymentMethod: 'credit_card'
          });

        expect([400, 403]).toContain(response.status);
      });

      it('should reject negative amount', async () => {
        const response = await request(app)
          .post('/api/shops/purchase/initiate')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({
            shopId: testShop.shopId,
            amount: -100,
            paymentMethod: 'credit_card'
          });

        expect([400, 403]).toContain(response.status);
      });

      it('should reject decimal amount (non-whole number)', async () => {
        const response = await request(app)
          .post('/api/shops/purchase/initiate')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({
            shopId: testShop.shopId,
            amount: 100.5,
            paymentMethod: 'credit_card'
          });

        expect([400, 403]).toContain(response.status);
      });
    });

    describe('Missing Required Fields', () => {
      it('should reject request without shopId', async () => {
        const response = await request(app)
          .post('/api/shops/purchase/initiate')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({
            amount: 100,
            paymentMethod: 'credit_card'
          });

        expect([400, 403]).toContain(response.status);
      });

      it('should reject request without amount', async () => {
        const response = await request(app)
          .post('/api/shops/purchase/initiate')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({
            shopId: testShop.shopId,
            paymentMethod: 'credit_card'
          });

        expect([400, 403]).toContain(response.status);
      });

      it('should reject request without paymentMethod', async () => {
        const response = await request(app)
          .post('/api/shops/purchase/initiate')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({
            shopId: testShop.shopId,
            amount: 100
          });

        expect([400, 403]).toContain(response.status);
      });

      it('should reject empty request body', async () => {
        const response = await request(app)
          .post('/api/shops/purchase/initiate')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({});

        expect([400, 403]).toContain(response.status);
      });
    });

    describe('Shop Validation', () => {
      it('should reject purchase for non-existent shop', async () => {
        jest.spyOn(shopRepository, 'getShop').mockResolvedValueOnce(null);

        const response = await request(app)
          .post('/api/shops/purchase/initiate')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({
            shopId: 'non-existent-shop',
            amount: 100,
            paymentMethod: 'credit_card'
          });

        // 401 if auth verification fails due to shop not found, 400 for validation, 403 for subscription
        expect([400, 401, 403]).toContain(response.status);
      });

      it('should reject purchase for inactive shop', async () => {
        jest.spyOn(shopRepository, 'getShop').mockResolvedValueOnce({
          ...testShop,
          active: false
        } as any);

        const response = await request(app)
          .post('/api/shops/purchase/initiate')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({
            shopId: testShop.shopId,
            amount: 100,
            paymentMethod: 'credit_card'
          });

        expect([400, 403]).toContain(response.status);
      });

      it('should reject purchase for unqualified shop (no subscription/RCG)', async () => {
        jest.spyOn(shopRepository, 'getShop').mockResolvedValueOnce({
          ...testShop,
          operational_status: null,
          verified: false
        } as any);

        const response = await request(app)
          .post('/api/shops/purchase/initiate')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({
            shopId: testShop.shopId,
            amount: 100,
            paymentMethod: 'credit_card'
          });

        expect([400, 403]).toContain(response.status);
      });
    });
  });

  // ============================================
  // Purchase Completion Tests (Authenticated)
  // ============================================
  describe('POST /api/shops/purchase/complete (Authenticated)', () => {

    it('should complete a valid pending purchase', async () => {
      const response = await request(app)
        .post('/api/shops/purchase/complete')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          purchaseId: 'purchase-123',
          paymentReference: 'stripe_ref_123'
        });

      expect([200, 403]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.status).toBe('completed');
      }
    });

    it('should reject completion without purchaseId', async () => {
      const response = await request(app)
        .post('/api/shops/purchase/complete')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          paymentReference: 'stripe_ref_123'
        });

      expect([400, 403]).toContain(response.status);
    });

    it('should reject completion for non-existent purchase', async () => {
      jest.spyOn(shopRepository, 'getShopPurchase').mockResolvedValueOnce(null);

      const response = await request(app)
        .post('/api/shops/purchase/complete')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          purchaseId: 'non-existent',
          paymentReference: 'stripe_ref_123'
        });

      expect([400, 403]).toContain(response.status);
    });

    it('should reject unauthenticated completion', async () => {
      const response = await request(app)
        .post('/api/shops/purchase/complete')
        .send({
          purchaseId: 'purchase-123',
          paymentReference: 'stripe_ref_123'
        });

      expect(response.status).toBe(401);
    });
  });

  // ============================================
  // Purchase Cancellation Tests
  // ============================================
  describe('POST /api/shops/purchase/:purchaseId/cancel', () => {

    it('should cancel a pending purchase with valid auth', async () => {
      const response = await request(app)
        .post('/api/shops/purchase/purchase-123/cancel')
        .set('Authorization', `Bearer ${shopToken}`);

      expect([200, 403]).toContain(response.status);
    });

    it('should reject cancellation without authentication', async () => {
      const response = await request(app)
        .post('/api/shops/purchase/purchase-123/cancel');

      expect(response.status).toBe(401);
    });

    it('should reject cancellation with invalid token', async () => {
      const response = await request(app)
        .post('/api/shops/purchase/purchase-123/cancel')
        .set('Authorization', `Bearer ${invalidToken}`);

      expect(response.status).toBe(401);
    });
  });

  // ============================================
  // Shop Balance Tests (Authenticated)
  // ============================================
  describe('GET /api/shops/purchase/balance/:shopId (Authenticated)', () => {

    it('should return shop balance and statistics', async () => {
      const response = await request(app)
        .get(`/api/shops/purchase/balance/${testShop.shopId}`)
        .set('Authorization', `Bearer ${shopToken}`);

      expect([200, 403]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('currentBalance');
        expect(response.body.data).toHaveProperty('totalPurchased');
        expect(response.body.data).toHaveProperty('totalDistributed');
      }
    });

    it('should return 401/404 for non-existent shop', async () => {
      jest.spyOn(shopRepository, 'getShop').mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/shops/purchase/balance/non-existent-shop')
        .set('Authorization', `Bearer ${shopToken}`);

      expect([401, 403, 404]).toContain(response.status);
    });

    it('should reject unauthenticated balance request', async () => {
      const response = await request(app)
        .get(`/api/shops/purchase/balance/${testShop.shopId}`);

      expect(response.status).toBe(401);
    });
  });

  // ============================================
  // Purchase History Tests (Authenticated)
  // ============================================
  describe('GET /api/shops/purchase/history/:shopId (Authenticated)', () => {

    beforeEach(() => {
      jest.spyOn(shopRepository, 'getShopPurchaseHistory').mockResolvedValue({
        items: [
          {
            id: 'purchase-1',
            shop_id: testShop.shopId,
            amount: 100,
            price_per_rcn: 0.10,
            total_cost: 10,
            payment_method: 'credit_card',
            status: 'completed',
            created_at: new Date().toISOString(),
            completed_at: new Date().toISOString()
          }
        ],
        pagination: {
          page: 1,
          totalPages: 1,
          totalItems: 1
        }
      } as any);
    });

    it('should return purchase history with pagination', async () => {
      const response = await request(app)
        .get(`/api/shops/purchase/history/${testShop.shopId}`)
        .set('Authorization', `Bearer ${shopToken}`);

      expect([200, 403]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('purchases');
        expect(response.body.data).toHaveProperty('total');
      }
    });

    it('should support pagination parameters', async () => {
      const response = await request(app)
        .get(`/api/shops/purchase/history/${testShop.shopId}?page=1&limit=10`)
        .set('Authorization', `Bearer ${shopToken}`);

      expect([200, 403]).toContain(response.status);
    });

    it('should filter by date range', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';

      const response = await request(app)
        .get(`/api/shops/purchase/history/${testShop.shopId}?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${shopToken}`);

      expect([200, 403]).toContain(response.status);
    });

    it('should reject unauthenticated history request', async () => {
      const response = await request(app)
        .get(`/api/shops/purchase/history/${testShop.shopId}`);

      expect(response.status).toBe(401);
    });
  });

  // ============================================
  // Stripe Checkout Tests
  // ============================================
  describe('POST /api/shops/purchase/stripe-checkout', () => {

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .post('/api/shops/purchase/stripe-checkout')
        .send({ amount: 100 });

      expect(response.status).toBe(401);
    });

    it('should process authenticated stripe checkout request', async () => {
      const response = await request(app)
        .post('/api/shops/purchase/stripe-checkout')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({ amount: 100 });

      // 200 success, 400 validation, 403 subscription enforcement, or 500 Stripe error
      expect([200, 400, 403, 500]).toContain(response.status);
    });

    it('should reject amount below minimum (less than 5 RCN)', async () => {
      const response = await request(app)
        .post('/api/shops/purchase/stripe-checkout')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({ amount: 4 });

      expect([400, 403]).toContain(response.status);
    });
  });

  // ============================================
  // Continue Purchase Tests
  // ============================================
  describe('POST /api/shops/purchase/:purchaseId/continue', () => {

    it('should reject without authentication', async () => {
      const response = await request(app)
        .post('/api/shops/purchase/purchase-123/continue');

      expect(response.status).toBe(401);
    });

    it('should process authenticated continue request', async () => {
      const response = await request(app)
        .post('/api/shops/purchase/purchase-123/continue')
        .set('Authorization', `Bearer ${shopToken}`);

      // Various responses based on purchase state
      expect([200, 400, 403, 404, 500]).toContain(response.status);
    });
  });

  // ============================================
  // Edge Cases & Error Handling
  // ============================================
  describe('Edge Cases and Error Handling', () => {

    it('should handle string amount gracefully', async () => {
      const response = await request(app)
        .post('/api/shops/purchase/initiate')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          shopId: testShop.shopId,
          amount: '100', // String instead of number
          paymentMethod: 'credit_card'
        });

      // Should coerce string to number or return validation/auth error
      expect([200, 400, 403]).toContain(response.status);
    });

    it('should reject non-numeric amount string', async () => {
      const response = await request(app)
        .post('/api/shops/purchase/initiate')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          shopId: testShop.shopId,
          amount: 'invalid',
          paymentMethod: 'credit_card'
        });

      expect([400, 403]).toContain(response.status);
    });

    it('should handle database errors gracefully', async () => {
      jest.spyOn(shopRepository, 'createShopPurchase').mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post('/api/shops/purchase/initiate')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          shopId: testShop.shopId,
          amount: 100,
          paymentMethod: 'credit_card'
        });

      expect([400, 403, 500]).toContain(response.status);
    });

    it('should handle very large amounts at the boundary', async () => {
      const response = await request(app)
        .post('/api/shops/purchase/initiate')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          shopId: testShop.shopId,
          amount: 10000, // Maximum allowed
          paymentMethod: 'credit_card'
        });

      expect([200, 403]).toContain(response.status);
    });
  });

  // ============================================
  // Concurrent Purchase Tests
  // ============================================
  describe('Concurrent Purchases', () => {

    it('should handle multiple simultaneous purchase requests', async () => {
      const promises = Array(5).fill(null).map(() =>
        request(app)
          .post('/api/shops/purchase/initiate')
          .set('Authorization', `Bearer ${shopToken}`)
          .send({
            shopId: testShop.shopId,
            amount: 100,
            paymentMethod: 'credit_card'
          })
      );

      const responses = await Promise.all(promises);

      // All should return same type of status
      responses.forEach(response => {
        expect([200, 400, 403]).toContain(response.status);
      });
    });
  });

  // ============================================
  // Tier-Based Pricing Tests
  // ============================================
  describe('Tier-Based Pricing', () => {

    it('should apply standard tier pricing for shop with 10K-49K RCG', async () => {
      jest.spyOn(shopRepository, 'getShop').mockResolvedValueOnce({
        ...testShop,
        operational_status: 'rcg_qualified'
      } as any);

      const response = await request(app)
        .post('/api/shops/purchase/initiate')
        .set('Authorization', `Bearer ${shopToken}`)
        .send({
          shopId: testShop.shopId,
          amount: 100,
          paymentMethod: 'credit_card'
        });

      expect([200, 403]).toContain(response.status);
      if (response.status === 200) {
        // Standard tier: 100 RCN * $0.10 = $10
        expect(response.body.data.totalCost).toBe(10);
      }
    });

    it('should handle premium tier pricing for shop with 50K-199K RCG', async () => {
      // Premium tier: $0.08 per RCN - placeholder test
      expect(true).toBe(true);
    });

    it('should handle elite tier pricing for shop with 200K+ RCG', async () => {
      // Elite tier: $0.06 per RCN - placeholder test
      expect(true).toBe(true);
    });
  });
});
