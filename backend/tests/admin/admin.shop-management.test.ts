import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import RepairCoinApp from '../../src/app';
import { ShopRepository } from '../../src/repositories/ShopRepository';
import { AdminRepository } from '../../src/repositories/AdminRepository';

jest.mock('../../src/repositories/ShopRepository');
jest.mock('../../src/repositories/AdminRepository');
jest.mock('thirdweb');

describe('Admin Shop Management Tests', () => {
  let app: any;
  let adminToken: string;
  const adminAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f1234';
  
  const mockPendingShop = {
    id: 'test-pending-shop',
    wallet_address: '0x1234567890123456789012345678901234567890',
    company_name: 'Test Auto Repair',
    owner_name: 'John Doe',
    email: 'shop@test.com',
    phone: '+1234567890',
    business_address: '123 Main St',
    is_verified: false,
    is_active: true,
    join_date: new Date().toISOString(),
    purchased_rcn_balance: 0,
    distributed_rcn: 0
  };

  const mockVerifiedShop = {
    ...mockPendingShop,
    id: 'test-verified-shop',
    wallet_address: '0x2345678901234567890123456789012345678901',
    is_verified: true,
    purchased_rcn_balance: 5000
  };

  beforeAll(async () => {
    process.env.ADMIN_ADDRESSES = adminAddress;
    process.env.JWT_SECRET = 'test-secret';
    process.env.NODE_ENV = 'test';
    
    const repairCoinApp = new RepairCoinApp();
    await repairCoinApp.initialize();
    app = repairCoinApp.app;

    // Get admin token
    const authResponse = await request(app)
      .post('/api/auth/admin')
      .send({ walletAddress: adminAddress });
    adminToken = authResponse.body.token;
  });

  describe('GET /api/admin/shops', () => {
    it('should list all active verified shops by default', async () => {
      jest.spyOn(ShopRepository.prototype, 'getShops')
        .mockResolvedValue([mockVerifiedShop] as any);

      const response = await request(app)
        .get('/api/admin/shops')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.shops).toHaveLength(1);
      expect(response.body.data.shops[0].is_verified).toBe(true);
      expect(response.body.data.shops[0].is_active).toBe(true);
    });

    it('should list pending shops when verified=false', async () => {
      jest.spyOn(ShopRepository.prototype, 'getShops')
        .mockResolvedValue([mockPendingShop] as any);

      const response = await request(app)
        .get('/api/admin/shops?verified=false')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.shops).toHaveLength(1);
      expect(response.body.data.shops[0].is_verified).toBe(false);
    });

    it('should support pagination', async () => {
      const manyShops = Array(25).fill(null).map((_, i) => ({
        ...mockVerifiedShop,
        id: `shop-${i}`,
        wallet_address: `0x${i.toString().padStart(40, '0')}`
      }));

      jest.spyOn(ShopRepository.prototype, 'getShops')
        .mockResolvedValue(manyShops.slice(0, 10) as any);

      const response = await request(app)
        .get('/api/admin/shops?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.shops).toHaveLength(10);
      expect(response.body.data.pagination).toMatchObject({
        page: 1,
        limit: 10,
        hasMore: true
      });
    });
  });

  describe('POST /api/admin/shops/:shopId/approve', () => {
    it('should approve a pending shop application', async () => {
      jest.spyOn(ShopRepository.prototype, 'getShopById')
        .mockResolvedValue(mockPendingShop as any);
      
      jest.spyOn(ShopRepository.prototype, 'verifyShop')
        .mockResolvedValue({ ...mockPendingShop, is_verified: true } as any);

      const response = await request(app)
        .post(`/api/admin/shops/${mockPendingShop.id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('approved successfully');
      expect(ShopRepository.prototype.verifyShop).toHaveBeenCalledWith(mockPendingShop.id);
    });

    it('should reject approval of already verified shop', async () => {
      jest.spyOn(ShopRepository.prototype, 'getShopById')
        .mockResolvedValue(mockVerifiedShop as any);

      const response = await request(app)
        .post(`/api/admin/shops/${mockVerifiedShop.id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already verified');
    });

    it('should handle non-existent shop', async () => {
      jest.spyOn(ShopRepository.prototype, 'getShopById')
        .mockResolvedValue(null);

      const response = await request(app)
        .post('/api/admin/shops/non-existent/approve')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Shop not found');
    });
  });

  describe('POST /api/admin/shops/:shopId/sell-rcn', () => {
    it('should process RCN sale to shop at $0.10 per token', async () => {
      jest.spyOn(ShopRepository.prototype, 'getShopById')
        .mockResolvedValue(mockVerifiedShop as any);
      
      jest.spyOn(AdminRepository.prototype, 'processShopRcnPurchase')
        .mockResolvedValue({
          shopId: mockVerifiedShop.id,
          amount: 1000,
          totalCost: 100,
          transactionHash: '0xabc123',
          paymentReference: 'STRIPE-123'
        } as any);

      const response = await request(app)
        .post(`/api/admin/shops/${mockVerifiedShop.id}/sell-rcn`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 1000,
          paymentReference: 'STRIPE-123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        amount: 1000,
        totalCost: 100,
        pricePerRcn: 0.1
      });
    });

    it('should reject sale to unverified shop', async () => {
      jest.spyOn(ShopRepository.prototype, 'getShopById')
        .mockResolvedValue(mockPendingShop as any);

      const response = await request(app)
        .post(`/api/admin/shops/${mockPendingShop.id}/sell-rcn`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 1000,
          paymentReference: 'STRIPE-123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('not verified');
    });

    it('should validate minimum purchase amount', async () => {
      jest.spyOn(ShopRepository.prototype, 'getShopById')
        .mockResolvedValue(mockVerifiedShop as any);

      const response = await request(app)
        .post(`/api/admin/shops/${mockVerifiedShop.id}/sell-rcn`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: 50, // Below minimum
          paymentReference: 'STRIPE-123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Minimum purchase');
    });
  });

  describe('POST /api/admin/create-shop', () => {
    it('should create a new shop with complete details', async () => {
      const newShopData = {
        shopId: 'new-test-shop',
        walletAddress: '0x3456789012345678901234567890123456789012',
        companyName: 'New Auto Shop',
        ownerName: 'Jane Smith',
        email: 'new@shop.com',
        phone: '+19876543210',
        businessAddress: '456 Oak Ave',
        city: 'Los Angeles',
        country: 'USA',
        website: 'https://newshop.com',
        autoVerify: true
      };

      jest.spyOn(ShopRepository.prototype, 'createShop')
        .mockResolvedValue({
          id: newShopData.shopId,
          wallet_address: newShopData.walletAddress,
          company_name: newShopData.companyName,
          is_verified: true,
          is_active: true
        } as any);

      const response = await request(app)
        .post('/api/admin/create-shop')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newShopData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.shop).toMatchObject({
        id: newShopData.shopId,
        wallet_address: newShopData.walletAddress,
        is_verified: true
      });
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/admin/create-shop')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          shopId: 'incomplete-shop'
          // Missing required fields
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should check for duplicate shop ID', async () => {
      jest.spyOn(ShopRepository.prototype, 'getShopById')
        .mockResolvedValue(mockVerifiedShop as any);

      const response = await request(app)
        .post('/api/admin/create-shop')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          shopId: mockVerifiedShop.id,
          walletAddress: '0x4567890123456789012345678901234567890123',
          companyName: 'Duplicate Shop',
          ownerName: 'Test Owner',
          email: 'dup@shop.com',
          phone: '+11234567890'
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already exists');
    });
  });

  describe('GET /api/admin/shops/:shopId/purchase-history', () => {
    it('should retrieve shop RCN purchase history', async () => {
      const mockPurchaseHistory = [
        {
          purchase_id: 1,
          shop_id: mockVerifiedShop.id,
          amount: 5000,
          total_cost: 500,
          payment_reference: 'STRIPE-001',
          purchase_date: new Date('2025-01-01'),
          transaction_hash: '0xabc123'
        },
        {
          purchase_id: 2,
          shop_id: mockVerifiedShop.id,
          amount: 3000,
          total_cost: 300,
          payment_reference: 'STRIPE-002',
          purchase_date: new Date('2025-01-15'),
          transaction_hash: '0xdef456'
        }
      ];

      jest.spyOn(AdminRepository.prototype, 'getShopPurchaseHistory')
        .mockResolvedValue(mockPurchaseHistory as any);

      const response = await request(app)
        .get(`/api/admin/shops/${mockVerifiedShop.id}/purchase-history`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.purchases).toHaveLength(2);
      expect(response.body.data.summary).toMatchObject({
        totalPurchases: 2,
        totalRcnBought: 8000,
        totalSpent: 800
      });
    });
  });
});