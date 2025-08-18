import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import RepairCoinApp from '../../src/app';
import { TreasuryRepository } from '../../src/repositories/TreasuryRepository';
import { TokenService } from '../../src/domains/token/services/TokenService';

jest.mock('../../src/repositories/TreasuryRepository');
jest.mock('../../src/domains/token/services/TokenService');
jest.mock('thirdweb');

describe('Admin Treasury Management Tests', () => {
  let app: any;
  let adminToken: string;
  const adminAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f1234';

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

  describe('GET /api/admin/treasury', () => {
    it('should return comprehensive treasury statistics', async () => {
      const mockTreasuryStats = {
        totalSupply: 1000000000, // 1 billion
        totalSoldToShops: 500000,
        availableBalance: 999500000,
        totalRevenue: 50000, // $50,000 at $0.10 per RCN
        shopCount: 25,
        lastUpdated: new Date().toISOString()
      };

      jest.spyOn(TreasuryRepository.prototype, 'getTreasuryStats')
        .mockResolvedValue(mockTreasuryStats as any);

      const response = await request(app)
        .get('/api/admin/treasury')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        totalSupply: 1000000000,
        totalSoldToShops: 500000,
        availableBalance: 999500000,
        totalRevenue: 50000,
        pricePerRcn: 0.1
      });
    });

    it('should calculate correct percentages', async () => {
      jest.spyOn(TreasuryRepository.prototype, 'getTreasuryStats')
        .mockResolvedValue({
          totalSupply: 1000000000,
          totalSoldToShops: 100000000, // 10% sold
          availableBalance: 900000000,
          totalRevenue: 10000000,
          shopCount: 100
        } as any);

      const response = await request(app)
        .get('/api/admin/treasury')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.body.data.soldPercentage).toBeCloseTo(10, 1);
      expect(response.body.data.availablePercentage).toBeCloseTo(90, 1);
    });
  });

  describe('POST /api/admin/treasury/update', () => {
    it('should update treasury after RCN sale', async () => {
      const updateData = {
        shopId: 'test-shop',
        amount: 10000,
        paymentReference: 'STRIPE-123',
        transactionHash: '0xabc123'
      };

      jest.spyOn(TreasuryRepository.prototype, 'recordRcnSale')
        .mockResolvedValue({
          success: true,
          newTotalSold: 510000,
          newRevenue: 51000
        } as any);

      const response = await request(app)
        .post('/api/admin/treasury/update')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Treasury updated');
      expect(TreasuryRepository.prototype.recordRcnSale).toHaveBeenCalledWith(
        updateData.shopId,
        updateData.amount,
        1000, // amount * 0.1
        updateData.paymentReference,
        updateData.transactionHash
      );
    });

    it('should validate minimum sale amount', async () => {
      const response = await request(app)
        .post('/api/admin/treasury/update')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          shopId: 'test-shop',
          amount: 50, // Below minimum
          paymentReference: 'STRIPE-123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Minimum');
    });

    it('should require all fields', async () => {
      const response = await request(app)
        .post('/api/admin/treasury/update')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          shopId: 'test-shop',
          amount: 1000
          // Missing paymentReference
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });
  });

  describe('GET /api/admin/treasury/transactions', () => {
    it('should list recent treasury transactions with pagination', async () => {
      const mockTransactions = [
        {
          id: 1,
          shop_id: 'shop-1',
          amount: 5000,
          total_cost: 500,
          payment_reference: 'STRIPE-001',
          transaction_date: new Date('2025-01-01'),
          transaction_hash: '0xabc123'
        },
        {
          id: 2,
          shop_id: 'shop-2',
          amount: 3000,
          total_cost: 300,
          payment_reference: 'STRIPE-002',
          transaction_date: new Date('2025-01-02'),
          transaction_hash: '0xdef456'
        }
      ];

      jest.spyOn(TreasuryRepository.prototype, 'getRecentTransactions')
        .mockResolvedValue({
          transactions: mockTransactions,
          total: 50,
          page: 1,
          limit: 20
        } as any);

      const response = await request(app)
        .get('/api/admin/treasury/transactions?page=1&limit=20')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.transactions).toHaveLength(2);
      expect(response.body.data.pagination).toMatchObject({
        total: 50,
        page: 1,
        limit: 20,
        totalPages: 3
      });
    });

    it('should filter by date range', async () => {
      jest.spyOn(TreasuryRepository.prototype, 'getRecentTransactions')
        .mockResolvedValue({
          transactions: [],
          total: 0,
          page: 1,
          limit: 20
        } as any);

      const response = await request(app)
        .get('/api/admin/treasury/transactions?startDate=2025-01-01&endDate=2025-01-31')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(TreasuryRepository.prototype.getRecentTransactions)
        .toHaveBeenCalledWith(expect.objectContaining({
          startDate: '2025-01-01',
          endDate: '2025-01-31'
        }));
    });
  });

  describe('POST /api/admin/mint', () => {
    it('should mint tokens to customer address', async () => {
      const mintData = {
        customerAddress: '0x1234567890123456789012345678901234567890',
        amount: 100,
        reason: 'Manual reward for loyalty'
      };

      jest.spyOn(TokenService.prototype, 'mintTokens')
        .mockResolvedValue({
          success: true,
          transactionHash: '0xabc123',
          amount: 100
        } as any);

      const response = await request(app)
        .post('/api/admin/mint')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(mintData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        amount: 100,
        transactionHash: '0xabc123'
      });
    });

    it('should validate ethereum address format', async () => {
      const response = await request(app)
        .post('/api/admin/mint')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerAddress: 'invalid-address',
          amount: 100,
          reason: 'Test'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Invalid');
    });

    it('should enforce maximum mint amount', async () => {
      const response = await request(app)
        .post('/api/admin/mint')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerAddress: '0x1234567890123456789012345678901234567890',
          amount: 10000, // Above maximum
          reason: 'Test'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Maximum');
    });
  });

  describe('Treasury Alerts', () => {
    it('should trigger alert when available balance is low', async () => {
      jest.spyOn(TreasuryRepository.prototype, 'getTreasuryStats')
        .mockResolvedValue({
          totalSupply: 1000000000,
          totalSoldToShops: 950000000, // 95% sold
          availableBalance: 50000000, // Only 5% left
          totalRevenue: 95000000,
          shopCount: 500
        } as any);

      const response = await request(app)
        .get('/api/admin/treasury')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.alerts).toContainEqual(
        expect.objectContaining({
          type: 'LOW_BALANCE',
          message: expect.stringContaining('low')
        })
      );
    });

    it('should show revenue milestone alerts', async () => {
      jest.spyOn(TreasuryRepository.prototype, 'getTreasuryStats')
        .mockResolvedValue({
          totalSupply: 1000000000,
          totalSoldToShops: 100000000,
          availableBalance: 900000000,
          totalRevenue: 10000000, // $10M milestone
          shopCount: 100
        } as any);

      const response = await request(app)
        .get('/api/admin/treasury')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.body.data.milestones).toContainEqual(
        expect.objectContaining({
          milestone: '$10M Revenue',
          achieved: true
        })
      );
    });
  });
});