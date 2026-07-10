import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import RepairCoinApp from '../../src/app';
import { AdminService } from '../../src/domains/admin/services/AdminService';
import { adminRepository, refreshTokenRepository } from '../../src/repositories';
import { closeSharedPool } from '../../src/utils/database-pool';

jest.mock('thirdweb');

describe('Admin Shop Management Tests', () => {
  let app: any;
  let adminToken: string;
  const adminAddress = '0x1111111111111111111111111111111111111111';

  // Shops as the current service returns them: camelCase ShopData plus the
  // pendingMintAmount the admin getShops decorates each row with.
  const pendingShop = {
    shopId: 'test-pending-shop',
    walletAddress: '0x1234567890123456789012345678901234567890',
    name: 'Test Auto Repair',
    email: 'shop@test.com',
    phone: '+1234567890',
    address: '123 Main St',
    verified: false,
    active: true,
    purchasedRcnBalance: 0,
    pendingMintAmount: 0
  };

  const verifiedShop = {
    ...pendingShop,
    shopId: 'test-verified-shop',
    walletAddress: '0x2345678901234567890123456789012345678901',
    verified: true,
    purchasedRcnBalance: 5000
  };

  const adminRecord = {
    id: 1,
    walletAddress: adminAddress,
    name: 'Test Admin',
    permissions: ['all'],
    isActive: true,
    isSuperAdmin: true,
    role: 'super_admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  beforeAll(async () => {
    process.env.ADMIN_ADDRESSES = adminAddress;
    process.env.JWT_SECRET = 'test-secret';
    process.env.NODE_ENV = 'test';

    const repairCoinApp = new RepairCoinApp();
    await repairCoinApp.initialize();
    app = repairCoinApp.app;
  });

  // jest config restores mocks before each test, so (re)install the auth
  // data-layer mocks and re-mint the admin token every test. These keep the
  // auth/permission middleware off the real database; each test then stubs the
  // AdminService method it exercises.
  beforeEach(async () => {
    jest
      .spyOn(adminRepository, 'getAdminByWalletAddress')
      .mockImplementation(async (addr: string) =>
        addr.toLowerCase() === adminAddress.toLowerCase() ? (adminRecord as any) : null
      );
    jest.spyOn(adminRepository, 'updateAdminLastLogin').mockResolvedValue(undefined as any);
    jest.spyOn(adminRepository, 'updateAdmin').mockResolvedValue(undefined as any);
    jest.spyOn(refreshTokenRepository, 'hasRecentRevocation').mockResolvedValue(null as any);
    jest.spyOn(refreshTokenRepository, 'revokeActiveByDevice').mockResolvedValue(undefined as any);
    jest.spyOn(refreshTokenRepository, 'createRefreshToken').mockResolvedValue({} as any);
    jest.spyOn(refreshTokenRepository, 'isTokenRevoked').mockResolvedValue(false as any);

    const authResponse = await request(app)
      .post('/api/auth/admin')
      .send({ address: adminAddress });
    adminToken = authResponse.body.token;
  });

  afterAll(async () => {
    await closeSharedPool();
  });

  describe('GET /api/admin/shops', () => {
    it('should list all active verified shops by default', async () => {
      jest
        .spyOn(AdminService.prototype, 'getShops')
        .mockResolvedValue({ shops: [verifiedShop], count: 1 } as any);

      const response = await request(app)
        .get('/api/admin/shops')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.shops).toHaveLength(1);
      expect(response.body.data.shops[0].verified).toBe(true);
      expect(response.body.data.shops[0].active).toBe(true);
    });

    it('should list pending shops when verified=false', async () => {
      jest
        .spyOn(AdminService.prototype, 'getShops')
        .mockImplementation(async (filters: any) =>
          filters?.verified === false
            ? ({ shops: [pendingShop], count: 1 } as any)
            : ({ shops: [verifiedShop], count: 1 } as any)
        );

      const response = await request(app)
        .get('/api/admin/shops?verified=false')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.shops).toHaveLength(1);
      expect(response.body.data.shops[0].verified).toBe(false);
    });
  });

  describe('POST /api/admin/shops/:shopId/approve', () => {
    it('should approve a pending shop application', async () => {
      const approveSpy = jest
        .spyOn(AdminService.prototype, 'approveShop')
        .mockResolvedValue({
          success: true,
          message: 'Shop approved and activated successfully',
          shop: { shopId: pendingShop.shopId, name: pendingShop.name, verified: true, active: true }
        } as any);

      const response = await request(app)
        .post(`/api/admin/shops/${pendingShop.shopId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('approved');
      expect(approveSpy).toHaveBeenCalledWith(pendingShop.shopId, expect.any(String));
    });

    it('should reject approval of an already verified & active shop', async () => {
      // Current service message for an operational shop.
      jest
        .spyOn(AdminService.prototype, 'approveShop')
        .mockRejectedValue(new Error('Shop already verified and active'));

      const response = await request(app)
        .post(`/api/admin/shops/${verifiedShop.shopId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Intended: a client error (400) for an already-verified shop.
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already verified');
    });

    it('should handle non-existent shop', async () => {
      jest
        .spyOn(AdminService.prototype, 'approveShop')
        .mockRejectedValue(new Error('Shop not found'));

      const response = await request(app)
        .post('/api/admin/shops/non-existent/approve')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Shop not found');
    });
  });

  describe('POST /api/admin/shops/:shopId/sell-rcn', () => {
    it('should process RCN sale to shop at $0.10 per token', async () => {
      jest
        .spyOn(AdminService.prototype, 'sellRcnToShop')
        .mockResolvedValue({
          success: true,
          message: 'Successfully sold 1000 RCN to shop',
          purchase: { id: 1, amount: 1000, totalCost: 100, newBalance: 6000 }
        } as any);

      const response = await request(app)
        .post(`/api/admin/shops/${verifiedShop.shopId}/sell-rcn`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amount: 1000, paymentReference: 'STRIPE-123' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.purchase).toMatchObject({ amount: 1000, totalCost: 100 });
    });

    it('should reject sale to unverified shop', async () => {
      jest
        .spyOn(AdminService.prototype, 'sellRcnToShop')
        .mockRejectedValue(new Error('Shop is not verified'));

      const response = await request(app)
        .post(`/api/admin/shops/${pendingShop.shopId}/sell-rcn`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amount: 1000, paymentReference: 'STRIPE-123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('not verified');
    });

    it('should validate minimum purchase amount', async () => {
      const response = await request(app)
        .post(`/api/admin/shops/${verifiedShop.shopId}/sell-rcn`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amount: 50, paymentReference: 'STRIPE-123' }); // Below minimum of 100

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('at least');
    });
  });

  describe('POST /api/admin/create-shop', () => {
    it('should create a new shop with complete details', async () => {
      const created = {
        id: 'new-test-shop',
        shopId: 'new-test-shop',
        walletAddress: '0x3456789012345678901234567890123456789012',
        name: 'New Auto Shop',
        verified: true,
        active: true
      };
      jest.spyOn(AdminService.prototype, 'createShop').mockResolvedValue(created as any);

      const response = await request(app)
        .post('/api/admin/create-shop')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          shop_id: 'new-test-shop',
          name: 'New Auto Shop',
          address: '456 Oak Ave',
          phone: '+19876543210',
          email: 'new@shop.com',
          wallet_address: '0x3456789012345678901234567890123456789012',
          verified: true
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({ shopId: 'new-test-shop', verified: true });
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/admin/create-shop')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ shop_id: 'incomplete-shop' }); // Missing required fields

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should reject a duplicate shop ID', async () => {
      jest
        .spyOn(AdminService.prototype, 'createShop')
        .mockRejectedValue(new Error('Shop ID already exists'));

      const response = await request(app)
        .post('/api/admin/create-shop')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          shop_id: verifiedShop.shopId,
          name: 'Duplicate Shop',
          address: '1 Dup St',
          phone: '+11234567890',
          email: 'dup@shop.com',
          wallet_address: '0x4567890123456789012345678901234567890123'
        });

      // Intended: a conflict (409) for a duplicate shop id.
      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already exists');
    });
  });
});
