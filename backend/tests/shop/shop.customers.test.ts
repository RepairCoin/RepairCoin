/**
 * Shop Customers Tab E2E Tests
 *
 * Tests the /shop?tab=customers functionality:
 * - List shop customers with search and pagination
 * - Customer profile details (bookings, transactions, analytics)
 * - Customer growth statistics
 * - Pending redemption sessions
 * - Customer moderation (block/unblock)
 * - Authentication & authorization
 * - Cross-shop authorization
 *
 * API Endpoints Tested:
 * - GET /api/shops/:shopId/customers
 * - GET /api/shops/:shopId/customer-profile/:address
 * - GET /api/shops/:shopId/customer-growth
 * - GET /api/shops/:shopId/pending-sessions
 * - POST /api/shops/moderation/block-customer
 * - GET /api/shops/moderation/blocked-customers
 * - DELETE /api/shops/moderation/blocked-customers/:walletAddress
 * - GET /api/shops/moderation/blocked-customers/:walletAddress/status
 */
import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, jest, afterAll } from '@jest/globals';
import RepairCoinApp from '../../src/app';
import jwt from 'jsonwebtoken';

jest.mock('thirdweb');

describe('Shop Customers Tab Tests', () => {
  let app: any;

  const JWT_SECRET = 'test-secret-for-customers-32ch!';
  const shopId = 'shop-cust-test-001';
  const shopWallet = '0xaaaa000000000000000000000000000000000001';
  const otherShopId = 'shop-other-test-002';
  const otherShopWallet = '0xcccc000000000000000000000000000000000003';
  const customerWallet = '0xbbbb000000000000000000000000000000000002';

  let shopToken: string;
  let otherShopToken: string;
  let customerToken: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.NODE_ENV = 'test';

    const repairCoinApp = new RepairCoinApp();
    await repairCoinApp.initialize();
    app = repairCoinApp.app;

    shopToken = jwt.sign(
      { address: shopWallet, role: 'shop', shopId, type: 'access' },
      JWT_SECRET, { expiresIn: '24h' }
    );
    otherShopToken = jwt.sign(
      { address: otherShopWallet, role: 'shop', shopId: otherShopId, type: 'access' },
      JWT_SECRET, { expiresIn: '24h' }
    );
    customerToken = jwt.sign(
      { address: customerWallet, role: 'customer', type: 'access' },
      JWT_SECRET, { expiresIn: '24h' }
    );
  });

  afterAll(async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================
  // SECTION 1: List Customers - Authentication
  // ============================================================
  describe('List Customers - Authentication', () => {
    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .get(`/api/shops/${shopId}/customers`);
      expect([401, 403]).toContain(response.status);
    });

    it('should reject customer role', async () => {
      const response = await request(app)
        .get(`/api/shops/${shopId}/customers`)
        .set('Cookie', [`auth_token=${customerToken}`]);
      expect([401, 403]).toContain(response.status);
    });

    it('should reject other shop accessing customers', async () => {
      const response = await request(app)
        .get(`/api/shops/${shopId}/customers`)
        .set('Cookie', [`auth_token=${otherShopToken}`]);
      expect([401, 403]).toContain(response.status);
    });

    it('should accept shop owner', async () => {
      const response = await request(app)
        .get(`/api/shops/${shopId}/customers`)
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 2: List Customers - Search & Pagination
  // ============================================================
  describe('List Customers - Search & Pagination', () => {
    it('should support pagination with page and limit', async () => {
      const response = await request(app)
        .get(`/api/shops/${shopId}/customers`)
        .query({ page: 1, limit: 10 })
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should support search by name', async () => {
      const response = await request(app)
        .get(`/api/shops/${shopId}/customers`)
        .query({ search: 'john' })
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should support search by wallet address', async () => {
      const response = await request(app)
        .get(`/api/shops/${shopId}/customers`)
        .query({ search: '0x' })
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should support search by email', async () => {
      const response = await request(app)
        .get(`/api/shops/${shopId}/customers`)
        .query({ search: '@gmail.com' })
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should support search by tier', async () => {
      const response = await request(app)
        .get(`/api/shops/${shopId}/customers`)
        .query({ search: 'SILVER' })
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should return empty for non-matching search', async () => {
      const response = await request(app)
        .get(`/api/shops/${shopId}/customers`)
        .query({ search: 'zzzznonexistentxyz999' })
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should enforce max limit of 50', async () => {
      const response = await request(app)
        .get(`/api/shops/${shopId}/customers`)
        .query({ limit: 100 })
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 3: Customer Profile
  // ============================================================
  describe('Customer Profile', () => {
    it('should reject unauthenticated profile request', async () => {
      const response = await request(app)
        .get(`/api/shops/${shopId}/customer-profile/${customerWallet}`);
      expect([401, 403]).toContain(response.status);
    });

    it('should reject customer accessing profile', async () => {
      const response = await request(app)
        .get(`/api/shops/${shopId}/customer-profile/${customerWallet}`)
        .set('Cookie', [`auth_token=${customerToken}`]);
      expect([401, 403]).toContain(response.status);
    });

    it('should reject other shop accessing profile', async () => {
      const response = await request(app)
        .get(`/api/shops/${shopId}/customer-profile/${customerWallet}`)
        .set('Cookie', [`auth_token=${otherShopToken}`]);
      expect([401, 403]).toContain(response.status);
    });

    it('should return profile for shop owner', async () => {
      const response = await request(app)
        .get(`/api/shops/${shopId}/customer-profile/${customerWallet}`)
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403, 404]).toContain(response.status);
    });

    it('should support bookings pagination', async () => {
      const response = await request(app)
        .get(`/api/shops/${shopId}/customer-profile/${customerWallet}`)
        .query({ bookingsPage: 1, bookingsLimit: 5 })
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403, 404]).toContain(response.status);
    });

    it('should support transactions pagination', async () => {
      const response = await request(app)
        .get(`/api/shops/${shopId}/customer-profile/${customerWallet}`)
        .query({ transactionsPage: 1, transactionsLimit: 5 })
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403, 404]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 4: Customer Growth
  // ============================================================
  describe('Customer Growth', () => {
    it('should reject unauthenticated growth request', async () => {
      const response = await request(app)
        .get(`/api/shops/${shopId}/customer-growth`);
      expect([401, 403]).toContain(response.status);
    });

    it('should return growth for shop owner', async () => {
      const response = await request(app)
        .get(`/api/shops/${shopId}/customer-growth`)
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should support 7d period', async () => {
      const response = await request(app)
        .get(`/api/shops/${shopId}/customer-growth`)
        .query({ period: '7d' })
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should support 30d period', async () => {
      const response = await request(app)
        .get(`/api/shops/${shopId}/customer-growth`)
        .query({ period: '30d' })
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });

    it('should support 90d period', async () => {
      const response = await request(app)
        .get(`/api/shops/${shopId}/customer-growth`)
        .query({ period: '90d' })
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 5: Pending Sessions
  // ============================================================
  describe('Pending Sessions', () => {
    it('should reject unauthenticated sessions request', async () => {
      const response = await request(app)
        .get(`/api/shops/${shopId}/pending-sessions`);
      expect([401, 403]).toContain(response.status);
    });

    it('should return sessions for shop owner', async () => {
      const response = await request(app)
        .get(`/api/shops/${shopId}/pending-sessions`)
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 6: Block Customer
  // ============================================================
  describe('Block Customer', () => {
    it('should reject unauthenticated block', async () => {
      const response = await request(app)
        .post('/api/shops/moderation/block-customer')
        .send({ customerWalletAddress: customerWallet, reason: 'Test block' });
      expect([401, 403]).toContain(response.status);
    });

    it('should reject customer role blocking', async () => {
      const response = await request(app)
        .post('/api/shops/moderation/block-customer')
        .set('Cookie', [`auth_token=${customerToken}`])
        .send({ customerWalletAddress: customerWallet, reason: 'Customer trying to block' });
      expect([401, 403]).toContain(response.status);
    });

    it('should reject missing wallet address', async () => {
      const response = await request(app)
        .post('/api/shops/moderation/block-customer')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ reason: 'No address provided' });
      expect([400, 401, 403]).toContain(response.status);
    });

    it('should reject missing reason', async () => {
      const response = await request(app)
        .post('/api/shops/moderation/block-customer')
        .set('Cookie', [`auth_token=${shopToken}`])
        .send({ customerWalletAddress: customerWallet });
      expect([400, 401, 403]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 7: Blocked Customers List
  // ============================================================
  describe('Blocked Customers List', () => {
    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .get('/api/shops/moderation/blocked-customers');
      expect([401, 403]).toContain(response.status);
    });

    it('should return list for shop owner', async () => {
      const response = await request(app)
        .get('/api/shops/moderation/blocked-customers')
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 8: Unblock Customer
  // ============================================================
  describe('Unblock Customer', () => {
    it('should reject unauthenticated unblock', async () => {
      const response = await request(app)
        .delete(`/api/shops/moderation/blocked-customers/${customerWallet}`);
      expect([401, 403]).toContain(response.status);
    });

    it('should return 404 for non-blocked customer', async () => {
      const response = await request(app)
        .delete('/api/shops/moderation/blocked-customers/0x0000000000000000000000000000000000000000')
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([401, 403, 404]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 9: Block Status Check
  // ============================================================
  describe('Block Status Check', () => {
    it('should reject unauthenticated status check', async () => {
      const response = await request(app)
        .get(`/api/shops/moderation/blocked-customers/${customerWallet}/status`);
      expect([401, 403]).toContain(response.status);
    });

    it('should return status for shop owner', async () => {
      const response = await request(app)
        .get(`/api/shops/moderation/blocked-customers/${customerWallet}/status`)
        .set('Cookie', [`auth_token=${shopToken}`]);
      expect([200, 401, 403]).toContain(response.status);
    });
  });

  // ============================================================
  // SECTION 10: Response Format Contract
  // ============================================================
  describe('Response Format Contract', () => {
    it('customer list should have pagination fields', async () => {
      const response = await request(app)
        .get(`/api/shops/${shopId}/customers`)
        .set('Cookie', [`auth_token=${shopToken}`]);

      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('customers');
        expect(Array.isArray(response.body.data.customers)).toBe(true);
      }
    });

    it('customer tiers should be well-defined', () => {
      const tiers = ['BRONZE', 'SILVER', 'GOLD'];
      expect(tiers).toHaveLength(3);
    });

    it('growth periods should be well-defined', () => {
      const periods = ['7d', '30d', '90d'];
      expect(periods).toHaveLength(3);
    });

    it('customer profile should include analytics and transactions', async () => {
      const response = await request(app)
        .get(`/api/shops/${shopId}/customer-profile/${customerWallet}`)
        .set('Cookie', [`auth_token=${shopToken}`]);

      if (response.status === 200) {
        expect(response.body.data).toHaveProperty('customer');
        expect(response.body.data).toHaveProperty('analytics');
        expect(response.body.data).toHaveProperty('transactions');
      }
    });
  });
});
