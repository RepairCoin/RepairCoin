/**
 * Customer Search Scope Test Suite
 *
 * Validates that the customer search endpoint in the Book Appointment modal
 * only returns customers who have placed orders at the requesting shop.
 *
 * Bug: Previously, the search returned ALL platform customers regardless of
 * shop affiliation, exposing PII (email, phone, wallet) across shops.
 *
 * Fix: Added EXISTS subquery filtering by service_orders.shop_id
 *
 * Endpoint: GET /api/services/shops/:shopId/customers/search?q=<query>
 * File: ManualBookingController.ts - searchCustomers()
 */
import { describe, it, expect, beforeAll, beforeEach, jest, afterAll } from '@jest/globals';
import request from 'supertest';
import RepairCoinApp from '../../src/app';
import jwt from 'jsonwebtoken';
import { ShopRepository } from '../../src/repositories/ShopRepository';
import { CustomerRepository } from '../../src/repositories/CustomerRepository';

// Mock repositories to bypass DB validation in auth middleware
jest.mock('../../src/repositories/ShopRepository');
jest.mock('../../src/repositories/CustomerRepository');
jest.mock('../../src/repositories/AdminRepository');
jest.mock('../../src/repositories/TransactionRepository');
jest.mock('../../src/repositories/TreasuryRepository');
jest.mock('../../src/repositories/RedemptionSessionRepository');
jest.mock('thirdweb');

// Mock the shared database pool used by ManualBookingController
// Create the mock fn inside the factory and expose it via the mock module
const mockDbPool = (() => {
  const fn = jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ rows: [] });
  return { query: fn };
})();

jest.mock('../../src/utils/database-pool', () => ({
  __esModule: true,
  getSharedPool: () => ({
    query: (...args: any[]) => mockDbPool.query(...args),
    connect: jest.fn().mockImplementation(async () => ({
      query: jest.fn().mockImplementation(async () => ({ rows: [] })),
      release: jest.fn()
    })),
    end: jest.fn(),
    on: jest.fn(),
    totalCount: 5,
    idleCount: 5,
    waitingCount: 0
  }),
  getPoolStats: () => ({
    totalCount: 5,
    idleCount: 5,
    waitingCount: 0
  })
}));

describe('Customer Search Scope - Shop Isolation', () => {
  let app: any;

  const JWT_SECRET = 'test-secret-for-customer-search-32!';

  // Shop A
  const shopAId = 'shop-a-test-001';
  const shopAWallet = '0xaaaa000000000000000000000000000000000001';
  let shopAToken: string;

  // Shop B
  const shopBId = 'shop-b-test-002';
  const shopBWallet = '0xbbbb000000000000000000000000000000000002';
  let shopBToken: string;

  // Customer-only user
  const customerWallet = '0xdddd000000000000000000000000000000000004';
  let customerToken: string;

  // Mock customer data
  const mockCustomerShopA = {
    address: '0xc001000000000000000000000000000000000001',
    wallet_address: '0xc001000000000000000000000000000000000001',
    email: 'alice@example.com',
    name: 'Alice Johnson',
    phone: '+1111111111',
    no_show_count: 0,
    no_show_tier: 'good',
    created_at: '2026-01-01T00:00:00.000Z'
  };

  const mockCustomerShopB = {
    address: '0xc002000000000000000000000000000000000002',
    wallet_address: '0xc002000000000000000000000000000000000002',
    email: 'bob@example.com',
    name: 'Bob Smith',
    phone: '+2222222222',
    no_show_count: 1,
    no_show_tier: 'warning',
    created_at: '2026-02-01T00:00:00.000Z'
  };

  const mockShopA = {
    shopId: shopAId,
    walletAddress: shopAWallet,
    name: 'Shop A Auto Repair',
    email: 'shopa@test.com',
    verified: true,
    active: true,
    subscriptionActive: true
  };

  const mockShopB = {
    shopId: shopBId,
    walletAddress: shopBWallet,
    name: 'Shop B Garage',
    email: 'shopb@test.com',
    verified: true,
    active: true,
    subscriptionActive: true
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.NODE_ENV = 'test';

    // Mock ShopRepository to return our test shops
    jest.spyOn(ShopRepository.prototype, 'getShop').mockImplementation(async (shopId: string) => {
      if (shopId === shopAId) return mockShopA as any;
      if (shopId === shopBId) return mockShopB as any;
      return null;
    });
    jest.spyOn(ShopRepository.prototype, 'getShopByWallet').mockImplementation(async (wallet: string) => {
      if (wallet === shopAWallet) return mockShopA as any;
      if (wallet === shopBWallet) return mockShopB as any;
      return null;
    });

    const repairCoinApp = new RepairCoinApp();
    await repairCoinApp.initialize();
    app = repairCoinApp.app;

    // Generate JWT tokens
    shopAToken = jwt.sign(
      { address: shopAWallet, role: 'shop', shopId: shopAId, type: 'access' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    shopBToken = jwt.sign(
      { address: shopBWallet, role: 'shop', shopId: shopBId, type: 'access' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    customerToken = jwt.sign(
      { address: customerWallet, role: 'customer', type: 'access' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
  });

  afterAll(async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  beforeEach(() => {
    mockDbPool.query.mockReset();
  });

  // ============================================================
  // SECTION 1: Authentication & Authorization
  // ============================================================
  describe('Authentication & Authorization', () => {
    it('should reject unauthenticated requests', async () => {
      const response = await request(app)
        .get(`/api/services/shops/${shopAId}/customers/search`)
        .query({ q: 'john' });

      expect([401, 403]).toContain(response.status);
    });

    it('should reject requests from customer role', async () => {
      const response = await request(app)
        .get(`/api/services/shops/${shopAId}/customers/search`)
        .query({ q: 'john' })
        .set('Cookie', [`auth_token=${customerToken}`]);

      expect([401, 403]).toContain(response.status);
    });

    it('should reject shop accessing another shops customer search', async () => {
      const response = await request(app)
        .get(`/api/services/shops/${shopBId}/customers/search`)
        .query({ q: 'john' })
        .set('Cookie', [`auth_token=${shopAToken}`]);

      // shopId mismatch between JWT (shopAId) and URL param (shopBId)
      expect(response.status).toBe(403);
    });
  });

  // ============================================================
  // SECTION 2: Input Validation
  // ============================================================
  describe('Input Validation', () => {
    it('should reject missing search query', async () => {
      const response = await request(app)
        .get(`/api/services/shops/${shopAId}/customers/search`)
        .set('Cookie', [`auth_token=${shopAToken}`]);

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should reject empty search query string', async () => {
      const response = await request(app)
        .get(`/api/services/shops/${shopAId}/customers/search`)
        .query({ q: '' })
        .set('Cookie', [`auth_token=${shopAToken}`]);

      expect(response.status).toBe(400);
    });
  });

  // ============================================================
  // SECTION 3: Shop-Scoped Query Verification (Core Fix)
  // ============================================================
  describe('Shop-Scoped Query Verification', () => {
    it('should pass shopId as parameter to the SQL query', async () => {
      mockDbPool.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .get(`/api/services/shops/${shopAId}/customers/search`)
        .query({ q: 'alice' })
        .set('Cookie', [`auth_token=${shopAToken}`]);

      expect(response.status).toBe(200);

      // Verify that pool.query was called with shopId as second parameter
      expect(mockDbPool.query).toHaveBeenCalled();
      const [sql, params] = mockDbPool.query.mock.calls[0];

      // The query must include the EXISTS subquery with shop_id filter
      expect(sql).toContain('EXISTS');
      expect(sql).toContain('service_orders');
      expect(sql).toContain('shop_id');
      expect(sql).toContain('$2');

      // Parameters: $1 = search pattern, $2 = shopId
      expect(params).toHaveLength(2);
      expect(params[0]).toBe('%alice%');
      expect(params[1]).toBe(shopAId);
    });

    it('should use the correct shopId for Shop B', async () => {
      mockDbPool.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .get(`/api/services/shops/${shopBId}/customers/search`)
        .query({ q: 'bob' })
        .set('Cookie', [`auth_token=${shopBToken}`]);

      expect(response.status).toBe(200);

      const [sql, params] = mockDbPool.query.mock.calls[0];
      expect(params[1]).toBe(shopBId);
    });

    it('should only return customers with orders at the requesting shop', async () => {
      // Mock: Shop A search returns only Alice (who has orders at Shop A)
      mockDbPool.query.mockResolvedValue({
        rows: [mockCustomerShopA]
      });

      const response = await request(app)
        .get(`/api/services/shops/${shopAId}/customers/search`)
        .query({ q: 'alice' })
        .set('Cookie', [`auth_token=${shopAToken}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.customers).toHaveLength(1);
      expect(response.body.customers[0].name).toBe('Alice Johnson');
      expect(response.body.customers[0].email).toBe('alice@example.com');
    });

    it('should NOT include customers from other shops', async () => {
      // Mock: Shop A search for "bob" returns empty (Bob only has orders at Shop B)
      mockDbPool.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .get(`/api/services/shops/${shopAId}/customers/search`)
        .query({ q: 'bob' })
        .set('Cookie', [`auth_token=${shopAToken}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.customers).toHaveLength(0);
    });

    it('SQL query must filter by customer_address and shop_id in EXISTS', async () => {
      mockDbPool.query.mockResolvedValue({ rows: [] });

      await request(app)
        .get(`/api/services/shops/${shopAId}/customers/search`)
        .query({ q: 'test' })
        .set('Cookie', [`auth_token=${shopAToken}`]);

      const [sql] = mockDbPool.query.mock.calls[0];

      // Verify the EXISTS subquery joins on customer_address and filters by shop_id
      expect(sql).toContain('so.customer_address = c.address');
      expect(sql).toContain('so.shop_id = $2');
    });
  });

  // ============================================================
  // SECTION 4: Response Format
  // ============================================================
  describe('Response Format', () => {
    it('should return correct customer fields (camelCase)', async () => {
      mockDbPool.query.mockResolvedValue({
        rows: [mockCustomerShopA]
      });

      const response = await request(app)
        .get(`/api/services/shops/${shopAId}/customers/search`)
        .query({ q: 'alice' })
        .set('Cookie', [`auth_token=${shopAToken}`]);

      expect(response.status).toBe(200);
      const customer = response.body.customers[0];

      // Should have camelCase keys
      expect(customer).toHaveProperty('address');
      expect(customer).toHaveProperty('email');
      expect(customer).toHaveProperty('name');
      expect(customer).toHaveProperty('phone');
      expect(customer).toHaveProperty('noShowCount');
      expect(customer).toHaveProperty('noShowTier');
      expect(customer).toHaveProperty('createdAt');

      // Should NOT leak snake_case or raw DB fields
      expect(customer).not.toHaveProperty('wallet_address');
      expect(customer).not.toHaveProperty('no_show_count');
      expect(customer).not.toHaveProperty('no_show_tier');
      expect(customer).not.toHaveProperty('created_at');
    });

    it('should limit results to 20', async () => {
      mockDbPool.query.mockResolvedValue({ rows: [] });

      await request(app)
        .get(`/api/services/shops/${shopAId}/customers/search`)
        .query({ q: 'a' })
        .set('Cookie', [`auth_token=${shopAToken}`]);

      const [sql] = mockDbPool.query.mock.calls[0];
      expect(sql).toContain('LIMIT 20');
    });
  });

  // ============================================================
  // SECTION 5: Search Functionality
  // ============================================================
  describe('Search Functionality', () => {
    it('should lowercase the search query for case-insensitive matching', async () => {
      mockDbPool.query.mockResolvedValue({ rows: [] });

      await request(app)
        .get(`/api/services/shops/${shopAId}/customers/search`)
        .query({ q: 'ALICE' })
        .set('Cookie', [`auth_token=${shopAToken}`]);

      const [, params] = mockDbPool.query.mock.calls[0];
      expect(params[0]).toBe('%alice%');
    });

    it('should wrap search query with % wildcards for LIKE matching', async () => {
      mockDbPool.query.mockResolvedValue({ rows: [] });

      await request(app)
        .get(`/api/services/shops/${shopAId}/customers/search`)
        .query({ q: 'john' })
        .set('Cookie', [`auth_token=${shopAToken}`]);

      const [, params] = mockDbPool.query.mock.calls[0];
      expect(params[0]).toBe('%john%');
    });

    it('should search across name, email, phone, and address fields', async () => {
      mockDbPool.query.mockResolvedValue({ rows: [] });

      await request(app)
        .get(`/api/services/shops/${shopAId}/customers/search`)
        .query({ q: 'test' })
        .set('Cookie', [`auth_token=${shopAToken}`]);

      const [sql] = mockDbPool.query.mock.calls[0];
      expect(sql).toContain('LOWER(c.name) LIKE $1');
      expect(sql).toContain('LOWER(c.email) LIKE $1');
      expect(sql).toContain('LOWER(c.phone) LIKE $1');
      expect(sql).toContain('LOWER(c.address) LIKE $1');
    });

    it('should return empty array for no matching results', async () => {
      mockDbPool.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .get(`/api/services/shops/${shopAId}/customers/search`)
        .query({ q: 'nonexistentxyz999' })
        .set('Cookie', [`auth_token=${shopAToken}`]);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.customers).toEqual([]);
    });
  });

  // ============================================================
  // SECTION 6: Error Handling
  // ============================================================
  describe('Error Handling', () => {
    it('should return 500 on database error', async () => {
      mockDbPool.query.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get(`/api/services/shops/${shopAId}/customers/search`)
        .query({ q: 'alice' })
        .set('Cookie', [`auth_token=${shopAToken}`]);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Failed to search customers');
    });
  });

  // ============================================================
  // SECTION 7: SQL Injection Prevention
  // ============================================================
  describe('SQL Injection Prevention', () => {
    it('should use parameterized queries (no string interpolation in SQL)', async () => {
      mockDbPool.query.mockResolvedValue({ rows: [] });

      const malicious = "'; DROP TABLE customers; --";

      await request(app)
        .get(`/api/services/shops/${shopAId}/customers/search`)
        .query({ q: malicious })
        .set('Cookie', [`auth_token=${shopAToken}`]);

      // Verify query uses $1, $2 placeholders - the malicious string goes into params, not SQL
      const [sql, params] = mockDbPool.query.mock.calls[0];
      expect(sql).not.toContain('DROP TABLE');
      expect(sql).toContain('$1');
      expect(sql).toContain('$2');
      expect(params[0]).toContain(malicious.toLowerCase());
    });
  });
});
