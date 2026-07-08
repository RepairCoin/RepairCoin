import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import RepairCoinApp from '../../src/app';
import { adminRepository, customerRepository, refreshTokenRepository } from '../../src/repositories';
import { closeSharedPool } from '../../src/utils/database-pool';

// Mock blockchain services
jest.mock('thirdweb');

describe('Admin Authentication Tests', () => {
  let app: any;
  // Valid 42-char (0x + 40 hex) wallet addresses. adminAddress is registered
  // via ADMIN_ADDRESSES below; nonAdminAddress represents a plain customer.
  const adminAddress = '0x1111111111111111111111111111111111111111';
  const nonAdminAddress = '0x2222222222222222222222222222222222222222';

  const adminRecord = {
    id: 1,
    walletAddress: adminAddress,
    name: 'Test Admin',
    email: 'admin@example.com',
    permissions: ['all'],
    isActive: true,
    isSuperAdmin: true,
    role: 'super_admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const mockCustomer = {
    address: nonAdminAddress.toLowerCase(),
    email: 'test@example.com',
    name: 'Test Customer',
    tier: 'BRONZE',
    isActive: true,
    joinDate: new Date().toISOString()
  };

  beforeAll(async () => {
    // Set test environment variables
    process.env.ADMIN_ADDRESSES = adminAddress;
    process.env.JWT_SECRET = 'test-secret-key-for-jwt-signing';
    process.env.NODE_ENV = 'test';

    // Initialize the app
    const repairCoinApp = new RepairCoinApp();
    await repairCoinApp.initialize();
    app = repairCoinApp.app;
  });

  // jest config sets restoreMocks: true, which restores spies before every
  // test — so (re)install the data-layer mocks in beforeEach. These isolate
  // the auth/RBAC middleware from the real database: the routes and middleware
  // read admin/customer identity through these repositories.
  beforeEach(() => {
    jest
      .spyOn(adminRepository, 'getAdminByWalletAddress')
      .mockImplementation(async (addr: string) =>
        addr.toLowerCase() === adminAddress.toLowerCase() ? (adminRecord as any) : null
      );
    jest.spyOn(adminRepository, 'updateAdminLastLogin').mockResolvedValue(undefined as any);
    jest.spyOn(adminRepository, 'updateAdmin').mockResolvedValue(undefined as any);

    jest
      .spyOn(customerRepository, 'getCustomer')
      .mockImplementation(async (addr: string) =>
        addr.toLowerCase() === nonAdminAddress.toLowerCase() ? (mockCustomer as any) : null
      );

    // Keep token issuance off the real database.
    jest.spyOn(refreshTokenRepository, 'hasRecentRevocation').mockResolvedValue(null as any);
    jest.spyOn(refreshTokenRepository, 'revokeActiveByDevice').mockResolvedValue(undefined as any);
    jest.spyOn(refreshTokenRepository, 'createRefreshToken').mockResolvedValue({} as any);
    // Freshly-issued tokenIds aren't persisted (createRefreshToken is mocked),
    // so treat every session as live rather than letting the middleware's
    // "unknown tokenId => revoked" DB lookup reject it.
    jest.spyOn(refreshTokenRepository, 'isTokenRevoked').mockResolvedValue(false as any);
  });

  afterAll(async () => {
    // Cleanup — close the shared connection pool
    await closeSharedPool();
  });

  describe('POST /api/auth/admin', () => {
    it('should authenticate valid admin and return JWT token', async () => {
      const response = await request(app)
        .post('/api/auth/admin')
        .send({ address: adminAddress });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.user).toMatchObject({
        address: adminAddress.toLowerCase(),
        role: 'admin'
      });
    });

    it('should reject non-admin wallet address', async () => {
      const response = await request(app)
        .post('/api/auth/admin')
        .send({ address: nonAdminAddress });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('not authorized');
    });

    it('should reject missing wallet address', async () => {
      const response = await request(app)
        .post('/api/auth/admin')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });
  });

  describe('Admin API Access Control', () => {
    let adminToken: string;
    let nonAdminToken: string;

    beforeEach(async () => {
      // Get admin token
      const adminAuth = await request(app)
        .post('/api/auth/admin')
        .send({ address: adminAddress });
      adminToken = adminAuth.body.token;

      // Create a customer token for comparison
      const customerAuth = await request(app)
        .post('/api/auth/customer')
        .send({ address: nonAdminAddress });
      nonAdminToken = customerAuth.body.token;
    });

    it('should allow admin to access admin-only endpoints', async () => {
      const response = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should reject non-admin from accessing admin endpoints', async () => {
      const response = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${nonAdminToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Insufficient permissions');
    });

    it('should reject unauthenticated requests to admin endpoints', async () => {
      const response = await request(app)
        .get('/api/admin/stats');

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Authentication required');
    });

    it('should reject invalid JWT tokens', async () => {
      const response = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid token');
    });
  });

  describe('Token Expiration', () => {
    it('should reject expired tokens', async () => {
      // Access-token lifetime is controlled by ACCESS_TOKEN_EXPIRES_IN
      // (see generateAccessToken in middleware/auth.ts).
      process.env.ACCESS_TOKEN_EXPIRES_IN = '1s';

      const authResponse = await request(app)
        .post('/api/auth/admin')
        .send({ address: adminAddress });

      const token = authResponse.body.token;

      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 2000));

      const response = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('expired');

      // Reset to default
      delete process.env.ACCESS_TOKEN_EXPIRES_IN;
    });
  });
});
