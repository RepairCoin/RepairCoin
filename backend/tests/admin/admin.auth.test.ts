import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import RepairCoinApp from '../../src/app';
import { DatabaseService } from '../../src/services/DatabaseService';

// Mock the database and blockchain services
jest.mock('../../src/services/DatabaseService');
jest.mock('thirdweb');

describe('Admin Authentication Tests', () => {
  let app: any;
  let server: any;
  const adminAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f1234';
  const nonAdminAddress = '0x1234567890123456789012345678901234567890';

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

  afterAll(async () => {
    // Cleanup
    await DatabaseService.getInstance().cleanup();
  });

  describe('POST /api/auth/admin', () => {
    it('should authenticate valid admin and return JWT token', async () => {
      const response = await request(app)
        .post('/api/auth/admin')
        .send({ walletAddress: adminAddress });

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
        .send({ walletAddress: nonAdminAddress });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not authorized');
    });

    it('should reject invalid wallet address format', async () => {
      const response = await request(app)
        .post('/api/auth/admin')
        .send({ walletAddress: 'invalid-address' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid');
    });

    it('should reject missing wallet address', async () => {
      const response = await request(app)
        .post('/api/auth/admin')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('required');
    });
  });

  describe('Admin API Access Control', () => {
    let adminToken: string;
    let nonAdminToken: string;

    beforeAll(async () => {
      // Get admin token
      const adminAuth = await request(app)
        .post('/api/auth/admin')
        .send({ walletAddress: adminAddress });
      adminToken = adminAuth.body.token;

      // Create a customer token for comparison
      const mockCustomer = {
        address: nonAdminAddress,
        email: 'test@example.com',
        isActive: true
      };
      jest.spyOn(DatabaseService.prototype, 'getCustomerByAddress')
        .mockResolvedValue(mockCustomer as any);
      
      const customerAuth = await request(app)
        .post('/api/auth/customer')
        .send({ walletAddress: nonAdminAddress });
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
      // Create a token with 1 second expiry
      process.env.JWT_EXPIRES_IN = '1s';
      
      const authResponse = await request(app)
        .post('/api/auth/admin')
        .send({ walletAddress: adminAddress });
      
      const token = authResponse.body.token;
      
      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const response = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('expired');
      
      // Reset to default
      process.env.JWT_EXPIRES_IN = '24h';
    });
  });
});